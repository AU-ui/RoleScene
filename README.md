# RoleScene

Synchronized dual-device audio storytelling platform for couples.

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 19 + TypeScript + Vite      |
| State      | Zustand                           |
| Backend    | Node.js + Express                 |
| Database   | SQLite (via `better-sqlite3`)     |
| Realtime   | WebSocket (`ws`)                  |
| Auth       | JWT (`jsonwebtoken`) + bcryptjs   |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
```

### 3. Run (server + client together)

```bash
npm run dev
```

- Client → http://localhost:5173  
- Server → http://localhost:3001  

---

## Architecture

```
Browser (React)
  ↓  REST  (auth + session create/join)
Express API  →  SQLite (rolescene.db)
  ↓  WebSocket  (real-time sync)
Both peers connected to same WS room
```

### Auth Flow
1. Register / Login → server returns JWT
2. JWT stored in `localStorage` (key: `rs_token`)
3. All REST calls include `Authorization: Bearer <token>`
4. WebSocket connections do **not** require auth (room code is the credential)

### Session Flow
1. Host calls `POST /api/sessions` → gets 6-digit room code
2. Guest calls `GET /api/sessions/:roomCode` → verifies room exists
3. Both open a WebSocket to `ws://localhost:3001?roomCode=<code>&role=<host|guest>`
4. Host is the time authority — sends `heartbeat` every 5 s
5. Guest calculates drift and self-corrects

### Drift Correction (Guest)
| Drift      | Action                        |
|------------|-------------------------------|
| < 150 ms   | ignore                        |
| ≥ 150 ms   | hard seek to corrected time   |

---

## API Reference

### Auth

```
POST /api/auth/register   { email, password, displayName }  → { token, user }
POST /api/auth/login      { email, password }               → { token, user }
GET  /api/auth/me         (Bearer token)                    → { id, email, displayName }
```

### Sessions  *(require Bearer token)*

```
POST /api/sessions              → { id, roomCode }
GET  /api/sessions/:roomCode    → session object
```

### WebSocket events

```
Client → Server              Server → Client
──────────────────────────   ────────────────────────────
play  { position }           play  { position, serverTimestamp }
pause { position }           pause { position }
seek  { position }           seek  { position, serverTimestamp }
heartbeat { position }       heartbeat { position, serverTimestamp }
slider { value }             partner_slider { value }
next_segment { segment }     next_segment { segment }
                             partner_joined
                             partner_left
                             session_state { ... }
```

---

## Adding Real Audio

Edit `src/tracks.ts` and fill in the `url` field for each track:

```ts
export const HOST_TRACKS: TrackDef[] = [
  { title: 'Chapter 1', url: '/audio/host-ch1.mp3', durationHint: 120 },
  ...
];
export const GUEST_TRACKS: TrackDef[] = [
  { title: 'Chapter 1', url: '/audio/guest-ch1.mp3', durationHint: 120 },
  ...
];
```

Place audio files in the `public/audio/` folder (Vite serves `public/` at root).

---

## Project Structure

```
rolescene/
├── server/
│   ├── db.ts          SQLite schema + query helpers
│   └── index.ts       Express REST API + WebSocket server
├── src/
│   ├── screens/
│   │   ├── AuthScreen.tsx      Login / Register (tabbed)
│   │   ├── LandingScreen.tsx   Host or Join a session
│   │   ├── HostScreen.tsx      Full playback controls
│   │   └── GuestScreen.tsx     Synchronized listener view
│   ├── store/
│   │   ├── authStore.ts        JWT + user state (Zustand)
│   │   └── sessionStore.ts     Session + playback state (Zustand)
│   ├── hooks/
│   │   ├── useSync.ts          WebSocket sync engine
│   │   └── useAudio.ts         HTML5 Audio + simulation fallback
│   ├── tracks.ts               Track definitions (HOST_TRACKS / GUEST_TRACKS)
│   ├── types.ts                Shared TypeScript types
│   └── main.tsx                React entry point
├── App.tsx                     Root component + navigation
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.server.json
├── .env.example
└── rolescene.db                Auto-created on first server start
```
