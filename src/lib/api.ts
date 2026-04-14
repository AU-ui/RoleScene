/**
 * Central API/WS base URLs.
 *
 * In dev: Vite proxies /api and /ws → localhost:3001
 * In prod: VITE_API_URL must point to the Railway backend
 */

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '';

// ws:// in dev (proxied), wss:// in prod
export const WS_BASE: string = import.meta.env.VITE_WS_URL
  ?? (import.meta.env.DEV ? 'ws://localhost:3001' : '');

export function apiUrl(path: string): string {
  return API_BASE + path;
}
