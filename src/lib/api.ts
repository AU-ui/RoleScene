/**
 * Central API/WS base URLs.
 *
 * In dev: Vite proxies /api and /ws → localhost:3001
 *   WS uses current window host so ngrok / LAN access works automatically.
 * In prod: VITE_API_URL / VITE_WS_URL must point to the Railway backend.
 */

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '';

// Derive WS base from the current page origin so tunnels (ngrok, LAN) work.
function devWsBase(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export const WS_BASE: string = import.meta.env.VITE_WS_URL
  ?? (import.meta.env.DEV ? devWsBase() : '');

export function apiUrl(path: string): string {
  return API_BASE + path;
}
