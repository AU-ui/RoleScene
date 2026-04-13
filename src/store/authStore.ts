import { create } from 'zustand';

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;

  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}

// Rehydrate from localStorage on first load
const storedToken = localStorage.getItem('rs_token');
const storedUser = (() => {
  try {
    const raw = localStorage.getItem('rs_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch { return null; }
})();

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:  storedUser,
  token: storedToken,

  setAuth(user, token) {
    localStorage.setItem('rs_token', token);
    localStorage.setItem('rs_user', JSON.stringify(user));
    set({ user, token });
  },

  logout() {
    localStorage.removeItem('rs_token');
    localStorage.removeItem('rs_user');
    set({ user: null, token: null });
  },

  isAuthenticated: () => !!(get().token && get().user),
  isAdmin:         () => get().user?.role === 'admin',
}));

/** Attach Bearer token to fetch calls automatically. */
export function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token;
  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
