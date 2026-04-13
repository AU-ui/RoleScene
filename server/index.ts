import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createSession,
  getSessionByCode,
  updatePlayback,
  updateSegment,
  updateSlider,
  createUser,
  getUserByEmail,
  getUserById,
} from './db.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'rolescene-dev-secret-change-in-prod';
const JWT_EXPIRES = '7d';
const BCRYPT_ROUNDS = 10;

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// ── Auth middleware ───────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Auth routes ───────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName } = req.body as {
    email?: string; password?: string; displayName?: string;
  };

  if (!email || !password || !displayName) {
    res.status(400).json({ error: 'email, password and displayName are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  const existing = getUserByEmail(email.toLowerCase());
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = createUser(email.toLowerCase(), passwordHash, displayName.trim());
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, displayName: user.display_name },
  });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const user = getUserByEmail(email.toLowerCase());
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({
    token,
    user: { id: user.id, email: user.email, displayName: user.display_name },
  });
});

// GET /api/auth/me  — verify token, return current user
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response): void => {
  const user = getUserById(req.userId!);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user.id, email: user.email, displayName: user.display_name });
});

// ── Session routes ────────────────────────────────────────────────────────────

app.post('/api/sessions', requireAuth, (req: AuthRequest, res: Response): void => {
  const s = createSession(req.userId);
  res.json({ id: s.id, roomCode: s.roomCode });
});

app.get('/api/sessions/:roomCode', requireAuth, (req: Request, res: Response): void => {
  const session = getSessionByCode(req.params.roomCode);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(session);
});

// ─── WebSocket ────────────────────────────────────────────────────────────────

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

  if (!code || (role !== 'host' && role !== 'guest')) {
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
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
httpServer.listen(PORT, () =>
  console.log(`\n  RoleScene server  →  http://localhost:${PORT}\n`)
);
