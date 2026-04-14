import dotenv from 'dotenv';
dotenv.config({ override: true }); // must be first — .env values override OS env vars
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import {
  createSession, getSessionByCode, getAllSessions, getSessionById,
  getSessionCount, deleteSessionById,
  updatePlayback, updateSegment, updateSlider,
  createUser, getUserByEmail, getUserById,
  getUserByVerificationToken, verifyUser, setVerificationToken,
  getAllUsers, getUserCount, getAdminCount, updateUserRole,
  incrementLoginAttempts, lockUser, resetLoginAttempts,
  type UserRole,
} from './db.js';

// ── Config ────────────────────────────────────────────────────────────────

const JWT_SECRET    = process.env.JWT_SECRET    ?? 'rolescene-dev-secret-change-in-prod';
const JWT_EXPIRES   = '7d';
const BCRYPT_ROUNDS = 10;
const ADMIN_CODE    = process.env.ADMIN_CODE === 'disabled' ? undefined : process.env.ADMIN_CODE;
const FRONTEND_URL  = process.env.FRONTEND_URL  ?? 'http://localhost:3000';

// Nodemailer — Gmail SMTP
const EMAIL_HOST     = process.env.EMAIL_HOST     ?? 'smtp.gmail.com';
const EMAIL_PORT     = parseInt(process.env.EMAIL_PORT ?? '587', 10);
const EMAIL_USER     = process.env.EMAIL_USER     ?? '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD ?? '';
const EMAIL_FROM     = process.env.EMAIL_FROM
  ? (process.env.EMAIL_FROM.includes('@') && !process.env.EMAIL_FROM.includes('<')
      ? `RoleScene <${process.env.EMAIL_FROM}>`  // plain email → wrap with name
      : process.env.EMAIL_FROM)                   // already formatted
  : `RoleScene <${EMAIL_USER}>`;

const mailer = nodemailer.createTransport({
  host:   EMAIL_HOST,
  port:   EMAIL_PORT,
  secure: EMAIL_PORT === 465, // true for 465, false for 587 (STARTTLS)
  auth:   { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  tls:    { rejectUnauthorized: false }, // allows self-signed certs in dev
});

// Lockout policy
const MAX_LOGIN_ATTEMPTS  = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min
const TOKEN_EXPIRY_MS     = 24 * 60 * 60 * 1000; // 24 hours

// ── Helpers ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(v: unknown, maxLen = 200): string {
  return String(v ?? '').trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

function generateToken(): string {
  return randomBytes(32).toString('hex'); // 64-char hex
}

// ── Email sender ──────────────────────────────────────────────────────────

async function sendVerificationEmail(email: string, displayName: string, token: string): Promise<void> {
  const verifyUrl = `${FRONTEND_URL}?verify=${token}`;

  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    // Dev fallback: print link to console when email is not configured
    console.log(`\n  [DEV] Verification link for ${email}:\n  ${verifyUrl}\n`);
    return;
  }

  await mailer.sendMail({
    from:    EMAIL_FROM,
    to:      email,
    subject: 'Verify your RoleScene account',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0B0B14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#13131F;border-radius:18px;border:1px solid #1E1E30;">
              <tr><td style="padding:40px;">

                <div style="text-align:center;margin-bottom:32px;">
                  <span style="font-size:28px;font-weight:800;color:#fff;letter-spacing:1px;">RoleScene</span>
                </div>

                <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 12px;text-align:center;">
                  Verify your email address
                </h1>
                <p style="color:#6B6B8A;font-size:15px;line-height:1.6;text-align:center;margin:0 0 32px;">
                  Hi ${displayName}, thanks for joining RoleScene!<br>
                  Click the button below to verify your email and activate your account.
                </p>

                <div style="text-align:center;margin-bottom:32px;">
                  <a href="${verifyUrl}"
                     style="display:inline-block;background:#A855F7;color:#fff;font-size:16px;
                            font-weight:700;text-decoration:none;padding:16px 40px;border-radius:14px;">
                    Verify Email Address
                  </a>
                </div>

                <p style="color:#6B6B8A;font-size:12px;text-align:center;margin:0 0 8px;">
                  Or copy this link into your browser:
                </p>
                <p style="color:#A855F7;font-size:11px;text-align:center;word-break:break-all;margin:0 0 32px;">
                  ${verifyUrl}
                </p>

                <p style="color:#444460;font-size:11px;text-align:center;margin:0;">
                  This link expires in 24 hours. If you didn't create an account, ignore this email.
                </p>

              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
}

// ── Rate limiter ──────────────────────────────────────────────────────────

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

setInterval(() => {
  const now = Date.now();
  for (const [key, e] of rateLimiter) {
    if (now > e.resetAt) rateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

// ── Express ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return cb(null, true);
    const allowed = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://role-scene.vercel.app',
      FRONTEND_URL,
    ];
    if (allowed.includes(origin)) return cb(null, true);
    // Also allow any vercel.app preview deployments
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '32kb' }));

// ── Auth middleware ───────────────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' }); return;
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
      res.status(403).json({ error: 'Admin access required' }); return;
    }
    next();
  });
}

// ── Rate-limit middleware ─────────────────────────────────────────────────

function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
           ?? req.socket.remoteAddress ?? 'unknown';
  if (isRateLimited(`auth:${ip}`, 15, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many requests. Please wait 15 minutes before trying again.' }); return;
  }
  next();
}

function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
           ?? req.socket.remoteAddress ?? 'unknown';
  if (isRateLimited(`api:${ip}`, 100, 60 * 1000)) {
    res.status(429).json({ error: 'Rate limit exceeded. Slow down.' }); return;
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

  if (!email || !password || !displayName) {
    res.status(400).json({ error: 'email, password and displayName are required' }); return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' }); return;
  }
  if (password.length > 72) {
    res.status(400).json({ error: 'Password must be at most 72 characters' }); return;
  }
  if (displayName.length < 2) {
    res.status(400).json({ error: 'Display name must be at least 2 characters' }); return;
  }

  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' }); return;
  }

  let role: UserRole = 'user';
  if (ADMIN_CODE && adminCode === ADMIN_CODE) role = 'admin';

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verToken     = generateToken();
  const expiresAt    = Date.now() + TOKEN_EXPIRY_MS;

  const user = createUser(email, passwordHash, displayName, role, verToken, expiresAt);

  // Send verification email (admins are auto-verified)
  if (role !== 'admin') {
    try {
      await sendVerificationEmail(email, displayName, verToken);
    } catch (err) {
      console.error('[EMAIL] Failed to send verification email:', err);
      // Don't block registration if email fails — user can resend
    }
    res.status(201).json({
      message: 'Account created. Please check your email to verify your account.',
      email: user.email,
    });
    return;
  }

  // Admin: skip verification, issue token immediately
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
  });
});

// GET /api/auth/verify?token=xxx
app.get('/api/auth/verify', async (req: Request, res: Response): Promise<void> => {
  const token = sanitizeText(req.query.token, 128);
  if (!token) {
    res.status(400).json({ error: 'Verification token is required' }); return;
  }

  const user = getUserByVerificationToken(token);
  if (!user) {
    res.status(400).json({ error: 'Invalid or already used verification link' }); return;
  }

  if (user.token_expires_at && Date.now() > user.token_expires_at) {
    res.status(400).json({ error: 'Verification link has expired. Please request a new one.' }); return;
  }

  verifyUser(user.id);

  const jwtToken = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({
    token: jwtToken,
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
  });
});

// POST /api/auth/resend-verification
app.post('/api/auth/resend-verification', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const email = sanitizeText(req.body?.email, 254).toLowerCase();
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: 'Valid email is required' }); return;
  }

  const user = getUserByEmail(email);
  // Always respond with success to prevent email enumeration
  if (!user || user.is_verified) {
    res.json({ message: 'If your email is registered and unverified, a new link has been sent.' });
    return;
  }

  const verToken  = generateToken();
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  setVerificationToken(user.id, verToken, expiresAt);

  try {
    await sendVerificationEmail(email, user.display_name, verToken);
  } catch (err) {
    console.error('[EMAIL] Failed to send verification email:', err);
  }

  res.json({ message: 'If your email is registered and unverified, a new link has been sent.' });
});

// POST /api/auth/login
app.post('/api/auth/login', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const email    = sanitizeText(req.body?.email, 254).toLowerCase();
  const password = sanitizeText(req.body?.password, 128);

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' }); return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' }); return;
  }

  const user = getUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' }); return;
  }

  // Lockout check
  if (user.locked_until && Date.now() < user.locked_until) {
    const remaining = Math.ceil((user.locked_until - Date.now()) / 60000);
    res.status(423).json({
      error: `Account temporarily locked. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
    }); return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    incrementLoginAttempts(email);
    const attempts = user.login_attempts + 1;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      lockUser(email, Date.now() + LOCKOUT_DURATION_MS);
      res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' }); return;
    }
    const left = MAX_LOGIN_ATTEMPTS - attempts;
    res.status(401).json({
      error: `Invalid email or password. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
    }); return;
  }

  // Email not verified
  if (!user.is_verified) {
    res.status(403).json({
      error: 'Please verify your email before signing in.',
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email,
    }); return;
  }

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

// ── Session routes ────────────────────────────────────────────────────────

app.post('/api/sessions', requireAuth, (req: AuthRequest, res: Response): void => {
  const s = createSession(req.userId);
  res.json({ id: s.id, roomCode: s.roomCode });
});

app.get('/api/sessions/:roomCode', requireAuth, (req: Request, res: Response): void => {
  if (!/^\d{6}$/.test(req.params.roomCode)) {
    res.status(400).json({ error: 'Room code must be 6 digits' }); return;
  }
  const session = getSessionByCode(req.params.roomCode);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(session);
});

// ── Admin routes ──────────────────────────────────────────────────────────

app.get('/api/admin/stats', requireAdmin, (_req: Request, res: Response): void => {
  res.json({ userCount: getUserCount(), sessionCount: getSessionCount(), activeRooms: rooms.size });
});

app.get('/api/admin/users', requireAdmin, (_req: Request, res: Response): void => {
  res.json(getAllUsers());
});

app.patch('/api/admin/users/:id/role', requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const role = sanitizeText(req.body?.role, 10) as UserRole;
  if (role !== 'user' && role !== 'admin') {
    res.status(400).json({ error: 'role must be "user" or "admin"' }); return;
  }
  if (id === req.userId && role !== 'admin') {
    res.status(400).json({ error: 'You cannot remove your own admin role' }); return;
  }
  updateUserRole(id, role);
  res.json({ id, role });
});

app.get('/api/admin/sessions', requireAdmin, (_req: Request, res: Response): void => {
  const sessions = getAllSessions().map(s => ({ ...s, isActive: rooms.has(s.room_code) }));
  res.json(sessions);
});

app.delete('/api/admin/sessions/:id', requireAdmin, (req: Request, res: Response): void => {
  const session = getSessionById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

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
    ws.close(4000, 'Missing or invalid roomCode / role'); return;
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
        if (role === 'host') send(room.guest, { type: 'heartbeat', position: pos, serverTimestamp: now });
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
httpServer.listen(PORT, () => {
  console.log(`\n  RoleScene server  →  http://localhost:${PORT}\n`);

  // Verify SMTP connection on startup so misconfiguration is caught immediately
  if (EMAIL_USER && EMAIL_PASSWORD) {
    mailer.verify((err) => {
      if (err) {
        console.error('  [EMAIL] SMTP connection FAILED:', err.message);
        console.error('  [EMAIL] Emails will not be sent. Check EMAIL_USER / EMAIL_PASSWORD in .env\n');
      } else {
        console.log(`  [EMAIL] SMTP ready — sending from ${EMAIL_FROM}\n`);
      }
    });
  } else {
    console.log('  [EMAIL] No credentials set — verification links will print to console\n');
  }
});
