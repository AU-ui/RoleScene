export type PlaybackState = 'idle' | 'playing' | 'paused';
export type SyncStatus   = 'disconnected' | 'connecting' | 'synced' | 'drifting';
export type Role         = 'host' | 'guest';

// ── Server → Client messages ────────────────────────────────────────────────
export type ServerMsg =
  | { type: 'partner_joined' }
  | { type: 'partner_left' }
  | { type: 'session_state'
      playbackState: string
      position: number
      serverTimestamp: number
      hostSlider: number
      guestSlider: number
      segment: number }
  | { type: 'play';          position: number; serverTimestamp: number }
  | { type: 'pause';         position: number }
  | { type: 'seek';          position: number; serverTimestamp: number }
  | { type: 'heartbeat';     position: number; serverTimestamp: number }
  | { type: 'partner_slider'; value: number }
  | { type: 'next_segment';  segment: number };

// ── Client → Server messages ────────────────────────────────────────────────
export type ClientMsg =
  | { type: 'play';         position: number }
  | { type: 'pause';        position: number }
  | { type: 'seek';         position: number }
  | { type: 'heartbeat';    position: number }
  | { type: 'slider';       value: number }
  | { type: 'next_segment'; segment: number };
