import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createSession, getSessionByCode, getAllSessions, getSessionById,
  getSessionCount, deleteSessionById,
  updatePlayback, updateSegment, updateSlider,
  createUser, getUserByEmail, getUserById,
  getAllUsers, getUserCount, getAdminCount, updateUserRole,
  incrementLoginAttempts, lockUser, resetLoginAttempts,
  type UserRole,
} from './db.js';

// ── Config ────────────────────────────────────────────────────────────────

const JWT_SECRET     = process.env.JWT_SECRET ?? 'rolescene-dev-secret-change-in-prod';
const JWT_EXPIRES    = '7d';
const BCRYPT_ROUNDS  = 10;
const ADMIN_CODE     = process.env.ADMIN_CODE; // must be set in .env to enable admin reg

// Lockout policy
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ── Validation helpers ────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(v: unknown, maxLen = 200): string {
  return String(v ?? '').trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

// ── In-memory rate limiter ────────────────────────────────────────────────
// Keyed by IP + endpoint group.  Rejects when count exceeds limit per window.

interface RateEntry { count: number; resetAt: number }
const rateLimiter = new Map<string, RateEntry>();

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= limit) return true;
  entry.count++;
  return false;
}

// Clean stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, e] of rateLimiter) {
    if (now > e.resetAt) rateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

// ── Express ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '32kb' })); // cap body size

// ── Auth middleware ───────────────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string; role: UserRole };
    req.userId   = payload.sub;
    req.userRole = payload.role ?? 'user';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.userRole !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  });
}

// ── Rate-limit middleware factories ───────────────────────────────────────

/** 15 req / 15 min per IP — used on auth endpoints (login, register) */
function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip  = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
            ?? req.socket.remoteAddress
            ?? 'unknown';
  if (isRateLimited(`auth:${ip}`, 15, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many requests. Please wait 15 minutes before trying again.' });
    return;
  }
  next();
}

/** 100 req / min per IP — broad API protection */
function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip  = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
            ?? req.socket.remoteAddress
            ?? 'unknown';
  if (isRateLimited(`api:${ip}`, 100, 60 * 1000)) {
    res.status(429).json({ error: 'Rate limit exceeded. Slow down.' });
    return;
  }
  next();
}

app.use('/api', apiRateLimit);

// ── Auth routes ───────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const email       = sanitizeText(req.body?.email, 254).toLowerCase();
  const password    = sanitizeText(req.body?.password, 128);
  const displayName = sanitizeText(req.body?.displayName, 50);
  const adminCode   = sanitizeText(req.body?.adminCode, 64);

  // Input validation
  if (!email || !password || !displayName) {
    res.status(400).json({ error: 'email, password and displayName are required' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  if (password.length > 72) {
    res.status(400).json({ error: 'Password must be at most 72 characters' });
    return;
  }
  if (displayName.length < 2) {
    res.status(400).json({ error: 'Display name must be at least 2 characters' });
    return;
  }

  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  // Determine role: admin only if ADMIN_CODE is configured and matches
  let role: UserRole = 'user';
  if (ADMIN_CODE && adminCode === ADMIN_CODE) {
    role = 'admin';
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = createUser(email, passwordHash, displayName, role);
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
  });
});

// POST /api/auth/login
app.post('/api/auth/login', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const email    = sanitizeText(req.body?.email, 254).toLowerCase();
  const password = sanitizeText(req.body?.password, 128);

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  const user = getUserByEmail(email);
  if (!user) {
    // Do not reveal whether email exists
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Account lockout check
  if (user.locked_until && Date.now() < user.locked_until) {
    const remaining = Math.ceil((user.locked_until - Date.now()) / 60000);
    res.status(423).json({
      error: `Account temporarily locked. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    incrementLoginAttempts(email);
    const attempts = user.login_attempts + 1;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      lockUser(email, Date.now() + LOCKOUT_DURATION_MS);
      res.status(423).json({
        error: `Too many failed attempts. Account locked for 15 minutes.`,
      });
      return;
    }
    const remaining = MAX_LOGIN_ATTEMPTS - attempts;
    res.status(401).json({
      error: `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
    });
    return;
  }

  // Success — reset lockout state
  resetLoginAttempts(email);

  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({
    token,
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
  });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response): void => {
  const user = getUserById(req.userId!);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user.id, email: user.email, displayName: user.display_name, role: user.role });
});

// ── Session routes (authenticated) ────────────────────────────────────────

app.post('/api/sessions', requireAuth, (req: AuthRequest, res: Response): void => {
  const s = createSession(req.userId);
  res.json({ id: s.id, roomCode: s.roomCode });
});

app.get('/api/sessions/:roomCode', requireAuth, (req: Request, res: Response): void => {
  if (!/^\d{6}$/.test(req.params.roomCode)) {
    res.status(400).json({ error: 'Room code must be 6 digits' });
    return;
  }
  const session = getSessionByCode(req.params.roomCode);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(session);
});

// ── Admin routes ──────────────────────────────────────────────────────────
//  All routes below require an authenticated user with role = 'admin'.

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, (_req: Request, res: Response): void => {
  res.json({
    userCount:    getUserCount(),
    sessionCount: getSessionCount(),
    activeRooms:  rooms.size,
  });
});

// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, (_req: Request, res: Response): void => {
  res.json(getAllUsers());
});

// PATCH /api/admin/users/:id/role
app.patch('/api/admin/users/:id/role', requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const role = sanitizeText(req.body?.role, 10) as UserRole;
  if (role !== 'user' && role !== 'admin') {
    res.status(400).json({ error: 'role must be "user" or "admin"' });
    return;
  }
  // Prevent self-demotion
  if (id === req.userId && role !== 'admin') {
    res.status(400).json({ error: 'You cannot remove your own admin role' });
    return;
  }
  updateUserRole(id, role);
  res.json({ id, role });
});

// GET /api/admin/sessions
app.get('/api/admin/sessions', requireAdmin, (_req: Request, res: Response): void => {
  const sessions = getAllSessions().map(s => ({
    ...s,
    isActive: rooms.has(s.room_code),
  }));
  res.json(sessions);
});

// DELETE /api/admin/sessions/:id
app.delete('/api/admin/sessions/:id', requireAdmin, (req: Request, res: Response): void => {
  const session = getSessionById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  // Close any live WS connections for this room
  const room = rooms.get(session.room_code);
  if (room) {
    const notice = JSON.stringify({ type: 'session_deleted' });
    room.host?.send(notice);
    room.guest?.send(notice);
    room.host?.close(4002, 'Session deleted by admin');
    room.guest?.close(4002, 'Session deleted by admin');
    rooms.delete(session.room_code);
  }

  deleteSessionById(req.params.id);
  res.status(204).send();
});

// ── WebSocket ─────────────────────────────────────────────────────────────

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

interface RoomPeer { host: WebSocket | null; guest: WebSocket | null }
const rooms = new Map<string, RoomPeer>();

function getRoom(code: string): RoomPeer {
  if (!rooms.has(code)) rooms.set(code, { host: null, guest: null });
  return rooms.get(code)!;
}

function send(ws: WebSocket | null, msg: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws, req) => {
  if (!req.url) { ws.close(); return; }

  const url  = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('roomCode');
  const role = url.searchParams.get('role') as 'host' | 'guest' | null;

  if (!code || !/^\d{6}$/.test(code) || (role !== 'host' && role !== 'guest')) {
    ws.close(4000, 'Missing or invalid roomCode / role');
    return;
  }

  const session = getSessionByCode(code);
  if (!session) { ws.close(4001, 'Session not found'); return; }

  const room = getRoom(code);

  if (role === 'host') {
    room.host = ws;
    if (room.guest) send(ws, { type: 'partner_joined' });
  } else {
    room.guest = ws;
    send(room.host, { type: 'partner_joined' });
    // Send current session state so a late-joining guest syncs immediately
    send(ws, {
      type: 'session_state',
      playbackState:   session.playback_state,
      position:        session.current_position,
      serverTimestamp: Date.now(),
      hostSlider:      session.host_slider,
      guestSlider:     session.guest_slider,
      segment:         session.current_segment,
    });
  }

  ws.on('message', (raw) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const partner = role === 'host' ? room.guest : room.host;
    const now = Date.now();

    switch (msg.type) {
      case 'play': {
        const pos = Number(msg.position ?? 0);
        updatePlayback(code, 'playing', pos, now);
        send(partner, { type: 'play', position: pos, serverTimestamp: now });
        break;
      }
      case 'pause': {
        const pos = Number(msg.position ?? 0);
        updatePlayback(code, 'paused', pos, now);
        send(partner, { type: 'pause', position: pos });
        break;
      }
      case 'seek': {
        const pos = Number(msg.position ?? 0);
        send(partner, { type: 'seek', position: pos, serverTimestamp: now });
        break;
      }
      case 'heartbeat': {
        const pos = Number(msg.position ?? 0);
        updatePlayback(code, 'playing', pos, now);
        if (role === 'host') {
          send(room.guest, { type: 'heartbeat', position: pos, serverTimestamp: now });
        }
        break;
      }
      case 'slider': {
        const value = Math.min(10, Math.max(1, Number(msg.value ?? 5)));
        updateSlider(code, role, value);
        send(partner, { type: 'partner_slider', value });
        break;
      }
      case 'next_segment': {
        if (role !== 'host') break;
        const segment = Number(msg.segment ?? 0);
        updateSegment(code, segment);
        updatePlayback(code, 'paused', 0, now);
        send(room.guest, { type: 'next_segment', segment });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (role === 'host') room.host = null;
    else                 room.guest = null;

    const partner = role === 'host' ? room.guest : room.host;
    send(partner, { type: 'partner_left' });

    if (!room.host && !room.guest) rooms.delete(code);
  });

  ws.onerror = () => {
    if (role === 'host') room.host = null;
    else                 room.guest = null;
  };
});

// ── Start ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
httpServer.listen(PORT, () =>
  console.log(`\n  RoleScene server  →  http://localhost:${PORT}\n`)
);
