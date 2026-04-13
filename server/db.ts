import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'rolescene.db');

export const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    created_at    INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id               TEXT PRIMARY KEY,
    room_code        TEXT UNIQUE NOT NULL,
    host_id          TEXT,
    created_at       INTEGER DEFAULT (unixepoch()),
    playback_state   TEXT    DEFAULT 'idle',
    current_position REAL    DEFAULT 0,
    current_segment  INTEGER DEFAULT 0,
    host_slider      INTEGER DEFAULT 5,
    guest_slider     INTEGER DEFAULT 5,
    last_sync_ts     INTEGER DEFAULT 0
  );
`);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: number;
}

export interface Session {
  id: string;
  room_code: string;
  host_id: string | null;
  created_at: number;
  playback_state: string;
  current_position: number;
  current_segment: number;
  host_slider: number;
  guest_slider: number;
  last_sync_ts: number;
}

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  // --- users ---
  insertUser: db.prepare<[string, string, string, string]>(
    'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
  ),
  getUserByEmail: db.prepare<[string]>(
    'SELECT * FROM users WHERE email = ?'
  ),
  getUserById: db.prepare<[string]>(
    'SELECT * FROM users WHERE id = ?'
  ),

  // --- sessions ---
  insertSession: db.prepare<[string, string, string | null]>(
    'INSERT INTO sessions (id, room_code, host_id) VALUES (?, ?, ?)'
  ),
  getByCode: db.prepare<[string]>(
    'SELECT * FROM sessions WHERE room_code = ?'
  ),
  updatePlayback: db.prepare<[string, number, number, string]>(
    'UPDATE sessions SET playback_state = ?, current_position = ?, last_sync_ts = ? WHERE room_code = ?'
  ),
  updateSegment: db.prepare<[number, number, string]>(
    'UPDATE sessions SET current_segment = ?, current_position = ? WHERE room_code = ?'
  ),
  updateHostSlider: db.prepare<[number, string]>(
    'UPDATE sessions SET host_slider = ? WHERE room_code = ?'
  ),
  updateGuestSlider: db.prepare<[number, string]>(
    'UPDATE sessions SET guest_slider = ? WHERE room_code = ?'
  ),
};

// ── User functions ────────────────────────────────────────────────────────────

export function createUser(
  email: string,
  passwordHash: string,
  displayName: string,
): User {
  const id = randomUUID();
  stmts.insertUser.run(id, email, passwordHash, displayName);
  return stmts.getUserById.get(id) as User;
}

export function getUserByEmail(email: string): User | undefined {
  return stmts.getUserByEmail.get(email) as User | undefined;
}

export function getUserById(id: string): User | undefined {
  return stmts.getUserById.get(id) as User | undefined;
}

// ── Session functions ─────────────────────────────────────────────────────────

export function createSession(hostId?: string): { id: string; roomCode: string } {
  const id = randomUUID();
  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
  stmts.insertSession.run(id, roomCode, hostId ?? null);
  return { id, roomCode };
}

export function getSessionByCode(roomCode: string): Session | undefined {
  return stmts.getByCode.get(roomCode) as Session | undefined;
}

export function updatePlayback(
  roomCode: string,
  state: string,
  position: number,
  ts: number,
) {
  stmts.updatePlayback.run(state, position, ts, roomCode);
}

export function updateSegment(roomCode: string, segment: number) {
  stmts.updateSegment.run(segment, 0, roomCode);
}

export function updateSlider(roomCode: string, role: 'host' | 'guest', value: number) {
  if (role === 'host') stmts.updateHostSlider.run(value, roomCode);
  else                 stmts.updateGuestSlider.run(value, roomCode);
}
