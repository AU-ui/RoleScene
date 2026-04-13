/**
 * Demo track lists.
 * Replace these URLs with your real hosted audio files.
 * Host and Guest play DIFFERENT narratives that are time-aligned.
 *
 * Example real structure:
 *   host: ['/audio/host-seg-1.mp3', '/audio/host-seg-2.mp3', ...]
 *   guest: ['/audio/guest-seg-1.mp3', '/audio/guest-seg-2.mp3', ...]
 */

export interface TrackDef {
  url: string;
  title: string;
  durationHint?: number; // seconds, optional — used when audio metadata unavailable
}

// ── Host tracks ─────────────────────────────────────────────────────────────
export const HOST_TRACKS: TrackDef[] = [
  { title: 'Chapter 1 — Arrival',    url: '', durationHint: 120 },
  { title: 'Chapter 2 — Discovery',  url: '', durationHint: 150 },
  { title: 'Chapter 3 — Resolution', url: '', durationHint: 180 },
];

// ── Guest tracks ─────────────────────────────────────────────────────────────
export const GUEST_TRACKS: TrackDef[] = [
  { title: 'Chapter 1 — The Meeting', url: '', durationHint: 120 },
  { title: 'Chapter 2 — The Reveal',  url: '', durationHint: 150 },
  { title: 'Chapter 3 — Together',    url: '', durationHint: 180 },
];
