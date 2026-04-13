import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'rolescene.db');

export const db = new Database(DB_PATH);

// WAL mode: better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              TEXT    PRIMARY KEY,
    email           TEXT    UNIQUE NOT NULL,
    password_hash   TEXT    NOT NULL,
    display_name    TEXT    NOT NULL,
    role            TEXT    NOT NULL DEFAULT 'user',
    login_attempts  INTEGER NOT NULL DEFAULT 0,
    locked_until    INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id               TEXT    PRIMARY KEY,
    room_code        TEXT    UNIQUE NOT NULL,
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

// ── Safe migrations for existing databases ─────────────────────────────────
// ALTER TABLE ADD COLUMN is idempotent-guarded by reading existing columns.

const userCols = (db.pragma('table_info(users)') as { name: string }[]).map(c => c.name);
if (!userCols.includes('role'))           db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
if (!userCols.includes('login_attempts')) db.exec(`ALTER TABLE users ADD COLUMN login_attempts INTEGER NOT NULL DEFAULT 0`);
if (!userCols.includes('locked_until'))  db.exec(`ALTER TABLE users ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0`);

// ── Types ──────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  login_attempts: number;
  locked_until: number;
  created_at: number;
}

export type SafeUser = Omit<User, 'password_hash'>;

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

// ── Prepared statements ────────────────────────────────────────────────────

const stmts = {
  // ── users ──
  insertUser: db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, role)
     VALUES (?, ?, ?, ?, ?)`
  ),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  getUserById:    db.prepare(`SELECT * FROM users WHERE id = ?`),
  getAllUsers:    db.prepare(
    `SELECT id, email, display_name, role, login_attempts, locked_until, created_at
     FROM users ORDER BY created_at DESC`
  ),
  countUsers:    db.prepare(`SELECT COUNT(*) as count FROM users`),
  countAdmins:   db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`),
  updateRole:    db.prepare(`UPDATE users SET role = ? WHERE id = ?`),

  // login-protection
  incrementAttempts: db.prepare(`UPDATE users SET login_attempts = login_attempts + 1 WHERE email = ?`),
  lockUser:          db.prepare(`UPDATE users SET locked_until = ? WHERE email = ?`),
  resetAttempts:     db.prepare(`UPDATE users SET login_attempts = 0, locked_until = 0 WHERE email = ?`),

  // ── sessions ──
  insertSession: db.prepare(
    `INSERT INTO sessions (id, room_code, host_id) VALUES (?, ?, ?)`
  ),
  getByCode:       db.prepare(`SELECT * FROM sessions WHERE room_code = ?`),
  getById:         db.prepare(`SELECT * FROM sessions WHERE id = ?`),
  getAllSessions:  db.prepare(`SELECT * FROM sessions ORDER BY created_at DESC`),
  countSessions:   db.prepare(`SELECT COUNT(*) as count FROM sessions`),
  deleteSession:   db.prepare(`DELETE FROM sessions WHERE id = ?`),
  updatePlayback:  db.prepare(
    `UPDATE sessions SET playback_state = ?, current_position = ?, last_sync_ts = ? WHERE room_code = ?`
  ),
  updateSegment:    db.prepare(`UPDATE sessions SET current_segment = ?, current_position = ? WHERE room_code = ?`),
  updateHostSlider: db.prepare(`UPDATE sessions SET host_slider = ? WHERE room_code = ?`),
  updateGuestSlider:db.prepare(`UPDATE sessions SET guest_slider = ? WHERE room_code = ?`),
};

// ── User helpers ───────────────────────────────────────────────────────────

export function createUser(
  email: string,
  passwordHash: string,
  displayName: string,
  role: UserRole = 'user',
): User {
  const id = randomUUID();
  stmts.insertUser.run(id, email, passwordHash, displayName, role);
  return stmts.getUserById.get(id) as User;
}

export function getUserByEmail(email: string): User | undefined {
  return stmts.getUserByEmail.get(email) as User | undefined;
}

export function getUserById(id: string): User | undefined {
  return stmts.getUserById.get(id) as User | undefined;
}

export function getAllUsers(): SafeUser[] {
  return stmts.getAllUsers.all() as SafeUser[];
}

export function getUserCount(): number {
  return (stmts.countUsers.get() as { count: number }).count;
}

export function getAdminCount(): number {
  return (stmts.countAdmins.get() as { count: number }).count;
}

export function updateUserRole(userId: string, role: UserRole): void {
  stmts.updateRole.run(role, userId);
}

// Brute-force protection
export function incrementLoginAttempts(email: string): void {
  stmts.incrementAttempts.run(email);
}
export function lockUser(email: string, until: number): void {
  stmts.lockUser.run(until, email);
}
export function resetLoginAttempts(email: string): void {
  stmts.resetAttempts.run(email);
}

// ── Session helpers ────────────────────────────────────────────────────────

export function createSession(hostId?: string): { id: string; roomCode: string } {
  const id = randomUUID();
  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
  stmts.insertSession.run(id, roomCode, hostId ?? null);
  return { id, roomCode };
}

export function getSessionByCode(roomCode: string): Session | undefined {
  return stmts.getByCode.get(roomCode) as Session | undefined;
}

export function getSessionById(id: string): Session | undefined {
  return stmts.getById.get(id) as Session | undefined;
}

export function getAllSessions(): Session[] {
  return stmts.getAllSessions.all() as Session[];
}

export function getSessionCount(): number {
  return (stmts.countSessions.get() as { count: number }).count;
}

export function deleteSessionById(id: string): void {
  stmts.deleteSession.run(id);
}

export function updatePlayback(roomCode: string, state: string, position: number, ts: number) {
  stmts.updatePlayback.run(state, position, ts, roomCode);
}

export function updateSegment(roomCode: string, segment: number) {
  stmts.updateSegment.run(segment, 0, roomCode);
}

export function updateSlider(roomCode: string, role: 'host' | 'guest', value: number) {
  if (role === 'host') stmts.updateHostSlider.run(value, roomCode);
  else                 stmts.updateGuestSlider.run(value, roomCode);
}
