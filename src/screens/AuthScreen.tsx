import React, { useState } from 'react';
import { useAuthStore, type AuthUser } from '../store/authStore';

const API = 'http://localhost:3001';

type Tab = 'login' | 'register';

interface Props {
  onAuth: () => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [tab, setTab]               = useState<Tab>('login');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [displayName, setDisplay]   = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);

  function resetForm() {
    setEmail(''); setPassword(''); setDisplay(''); setError('');
  }

  function switchTab(t: Tab) {
    setTab(t); resetForm();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setError(data.error ?? 'Login failed. Please try again.');
        return;
      }
      setAuth(data.user, data.token);
      onAuth();
    } catch {
      setError('Cannot reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !displayName) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setError(data.error ?? 'Registration failed. Please try again.');
        return;
      }
      setAuth(data.user, data.token);
      onAuth();
    } catch {
      setError('Cannot reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* Logo */}
        <div style={s.logo}>
          <span style={s.logoText}>RoleScene</span>
          <span style={s.logoSub}>Premium dual-device audio experience</span>
        </div>

        {/* Tab switcher */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === 'login' ? s.tabActive : {}) }}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            style={{ ...s.tab, ...(tab === 'register' ? s.tabActive : {}) }}
            onClick={() => switchTab('register')}
          >
            Create Account
          </button>
        </div>

        {/* Form card */}
        <div style={s.card}>
          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={s.form}>
              <div style={s.cardTitle}>Welcome back</div>
              <div style={s.cardSub}>Sign in to your RoleScene account</div>

              <label style={s.label}>Email</label>
              <input
                style={s.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
              />

              <label style={s.label}>Password</label>
              <input
                style={s.input}
                type="password"
                placeholder="••••••••"
                value={password}
                autoComplete="current-password"
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />

              {error && <div style={s.error}>{error}</div>}

              <button type="submit" style={{ ...s.btn, ...s.btnPurple }} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <button
                type="button"
                style={s.switchLink}
                onClick={() => switchTab('register')}
              >
                Don't have an account? <span style={{ color: '#A855F7' }}>Create one</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={s.form}>
              <div style={s.cardTitle}>Create your account</div>
              <div style={s.cardSub}>Start your RoleScene journey</div>

              <label style={s.label}>Display Name</label>
              <input
                style={s.input}
                type="text"
                placeholder="Your name"
                value={displayName}
                autoComplete="name"
                onChange={(e) => { setDisplay(e.target.value); setError(''); }}
              />

              <label style={s.label}>Email</label>
              <input
                style={s.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
              />

              <label style={s.label}>Password</label>
              <input
                style={s.input}
                type="password"
                placeholder="At least 6 characters"
                value={password}
                autoComplete="new-password"
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />

              {error && <div style={s.error}>{error}</div>}

              <button type="submit" style={{ ...s.btn, ...s.btnPink }} disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>

              <button
                type="button"
                style={s.switchLink}
                onClick={() => switchTab('login')}
              >
                Already have an account? <span style={{ color: '#EC4899' }}>Sign in</span>
              </button>
            </form>
          )}
        </div>

        <div style={s.hint}>
          Your session is encrypted and stored locally.
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#0B0B14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  logo: {
    textAlign: 'center',
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  logoSub: {
    color: '#6B6B8A',
    fontSize: 13,
  },
  tabs: {
    display: 'flex',
    backgroundColor: '#13131F',
    borderRadius: 14,
    padding: 4,
    border: '1px solid #1E1E30',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 11,
    border: 'none',
    background: 'transparent',
    color: '#6B6B8A',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    backgroundColor: '#1E1E30',
    color: '#FFF',
  },
  card: {
    backgroundColor: '#13131F',
    borderRadius: 18,
    padding: 24,
    border: '1px solid #1E1E30',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  cardTitle: {
    color: '#FFF',
    fontWeight: 700,
    fontSize: 18,
    marginBottom: 4,
  },
  cardSub: {
    color: '#6B6B8A',
    fontSize: 13,
    marginBottom: 20,
  },
  label: {
    color: '#9999BB',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    marginBottom: 6,
    display: 'block',
  },
  input: {
    backgroundColor: '#0B0B14',
    border: '1px solid #2A2A3A',
    borderRadius: 12,
    padding: '13px 16px',
    color: '#FFF',
    fontSize: 15,
    width: '100%',
    outline: 'none',
    marginBottom: 16,
    fontFamily: 'inherit',
  },
  btn: {
    borderRadius: 12,
    padding: '14px 0',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 15,
    color: '#FFF',
    marginTop: 4,
  },
  btnPurple: { backgroundColor: '#A855F7' },
  btnPink:   { backgroundColor: '#EC4899' },
  error: {
    backgroundColor: '#FF44441A',
    border: '1px solid #FF444440',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#FF6666',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#6B6B8A',
    fontSize: 13,
    cursor: 'pointer',
    marginTop: 16,
    textAlign: 'center',
    width: '100%',
    padding: 0,
    fontFamily: 'inherit',
  },
  hint: {
    color: '#444460',
    fontSize: 11,
    textAlign: 'center',
  },
};
