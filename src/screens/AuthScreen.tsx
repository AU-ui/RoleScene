/**
 * AuthScreen — Login + Register with real-time client-side validation,
 * password strength meter, and rate-limit-aware error messages.
 *
 * All API calls use relative paths so Vite's proxy routes them to the server.
 */
import React, { useState, useCallback } from 'react';
import { useAuthStore, type AuthUser } from '../store/authStore';

type Tab = 'login' | 'register';

interface Props {
  onAuth: (role: 'user' | 'admin') => void;
  onBack: () => void;
}

// ── Validation ─────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(v: string): string {
  if (!v) return 'Email is required';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
  if (v.length > 254) return 'Email is too long';
  return '';
}

function validatePassword(v: string): string {
  if (!v) return 'Password is required';
  if (v.length < 6) return 'Password must be at least 6 characters';
  if (v.length > 72) return 'Password must be at most 72 characters';
  return '';
}

function validateDisplayName(v: string): string {
  if (!v.trim()) return 'Display name is required';
  if (v.trim().length < 2) return 'Display name must be at least 2 characters';
  if (v.trim().length > 50) return 'Display name must be at most 50 characters';
  return '';
}

// ── Password strength ──────────────────────────────────────────────────────

function passwordStrength(v: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (v.length === 0) return { level: 0, label: '', color: 'transparent' };
  let score = 0;
  if (v.length >= 8)  score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;

  if (score <= 1) return { level: 1, label: 'Weak',   color: '#FF4444' };
  if (score <= 3) return { level: 2, label: 'Medium', color: '#FFA500' };
  return           { level: 3, label: 'Strong',  color: '#00C896' };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AuthScreen({ onAuth, onBack }: Props) {
  const [tab, setTab]             = useState<Tab>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [displayName, setDisplay] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showAdminCode, setShowAdminCode] = useState(false);

  // Per-field errors (shown after first blur or submit attempt)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);

  const touch = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  function resetForm() {
    setEmail(''); setPassword(''); setDisplay(''); setAdminCode('');
    setTouched({}); setServerError('');
  }

  function switchTab(t: Tab) { setTab(t); resetForm(); }

  // Derived validation
  const emailErr   = validateEmail(email);
  const passErr    = validatePassword(password);
  const nameErr    = validateDisplayName(displayName);
  const strength   = passwordStrength(password);

  const loginValid    = !emailErr && !passErr;
  const registerValid = !emailErr && !passErr && !nameErr;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!loginValid) return;

    setLoading(true); setServerError('');
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setServerError(data.error ?? 'Login failed. Please try again.');
        return;
      }
      setAuth(data.user, data.token);
      onAuth(data.user.role);
    } catch {
      setServerError('Cannot reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true, displayName: true });
    if (!registerValid) return;

    setLoading(true); setServerError('');
    try {
      const body: Record<string, string> = {
        email: email.trim(), password, displayName: displayName.trim(),
      };
      if (adminCode.trim()) body.adminCode = adminCode.trim();

      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setServerError(data.error ?? 'Registration failed. Please try again.');
        return;
      }
      setAuth(data.user, data.token);
      onAuth(data.user.role);
    } catch {
      setServerError('Cannot reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  const showErr = (field: string, err: string) =>
    touched[field] && err ? (
      <span style={s.fieldErr}>{err}</span>
    ) : null;

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* Back */}
        <button style={s.backBtn} onClick={onBack}>← Back</button>

        {/* Logo */}
        <div style={s.logo}>
          <span style={s.logoText}>RoleScene</span>
          <span style={s.logoSub}>Premium dual-device audio experience</span>
        </div>

        {/* Tab switcher */}
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab === 'login'    ? s.tabActive : {}) }} onClick={() => switchTab('login')}>
            Sign In
          </button>
          <button style={{ ...s.tab, ...(tab === 'register' ? s.tabActive : {}) }} onClick={() => switchTab('register')}>
            Create Account
          </button>
        </div>

        {/* Form card */}
        <div style={s.card}>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={s.form} noValidate>
              <div style={s.cardTitle}>Welcome back</div>
              <div style={s.cardSub}>Sign in to your RoleScene account</div>

              <label style={s.label}>Email</label>
              <input
                style={{ ...s.input, ...(touched.email && emailErr ? s.inputErr : {}) }}
                type="email" placeholder="you@example.com" value={email}
                autoComplete="email"
                onChange={(e) => { setEmail(e.target.value); setServerError(''); }}
                onBlur={() => touch('email')}
              />
              {showErr('email', emailErr)}

              <label style={s.label}>Password</label>
              <input
                style={{ ...s.input, ...(touched.password && passErr ? s.inputErr : {}) }}
                type="password" placeholder="••••••••" value={password}
                autoComplete="current-password"
                onChange={(e) => { setPassword(e.target.value); setServerError(''); }}
                onBlur={() => touch('password')}
              />
              {showErr('password', passErr)}

              {serverError && <div style={s.error}>{serverError}</div>}

              <button type="submit" style={{ ...s.btn, ...s.btnPurple }} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <button type="button" style={s.switchLink} onClick={() => switchTab('register')}>
                Don't have an account? <span style={{ color: '#A855F7' }}>Create one</span>
              </button>
            </form>

          ) : (
            <form onSubmit={handleRegister} style={s.form} noValidate>
              <div style={s.cardTitle}>Create your account</div>
              <div style={s.cardSub}>Start your RoleScene journey</div>

              <label style={s.label}>Display Name</label>
              <input
                style={{ ...s.input, ...(touched.displayName && nameErr ? s.inputErr : {}) }}
                type="text" placeholder="Your name" value={displayName}
                autoComplete="name" maxLength={50}
                onChange={(e) => { setDisplay(e.target.value); setServerError(''); }}
                onBlur={() => touch('displayName')}
              />
              {showErr('displayName', nameErr)}

              <label style={s.label}>Email</label>
              <input
                style={{ ...s.input, ...(touched.email && emailErr ? s.inputErr : {}) }}
                type="email" placeholder="you@example.com" value={email}
                autoComplete="email"
                onChange={(e) => { setEmail(e.target.value); setServerError(''); }}
                onBlur={() => touch('email')}
              />
              {showErr('email', emailErr)}

              <label style={s.label}>Password</label>
              <input
                style={{ ...s.input, ...(touched.password && passErr ? s.inputErr : {}) }}
                type="password" placeholder="At least 6 characters" value={password}
                autoComplete="new-password"
                onChange={(e) => { setPassword(e.target.value); setServerError(''); }}
                onBlur={() => touch('password')}
              />
              {/* Password strength meter */}
              {password.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3].map(lvl => (
                      <div key={lvl} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        backgroundColor: strength.level >= lvl ? strength.color : '#2A2A3A',
                        transition: 'background-color 0.2s',
                      }} />
                    ))}
                  </div>
                  <span style={{ color: strength.color, fontSize: 11, fontWeight: 600 }}>
                    {strength.label}
                  </span>
                </div>
              )}
              {showErr('password', passErr)}

              {/* Admin code (collapsed by default — for internal use) */}
              <button
                type="button"
                style={s.adminToggle}
                onClick={() => setShowAdminCode(v => !v)}
              >
                {showAdminCode ? '▾' : '▸'} Admin registration code (optional)
              </button>
              {showAdminCode && (
                <>
                  <input
                    style={{ ...s.input, marginTop: 8 }}
                    type="password" placeholder="Admin code" value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                  />
                  <div style={{ color: '#6B6B8A', fontSize: 11, marginBottom: 12 }}>
                    Leave blank for a standard user account.
                  </div>
                </>
              )}

              {serverError && <div style={s.error}>{serverError}</div>}

              <button type="submit" style={{ ...s.btn, ...s.btnPink }} disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>

              <button type="button" style={s.switchLink} onClick={() => switchTab('login')}>
                Already have an account? <span style={{ color: '#EC4899' }}>Sign in</span>
              </button>
            </form>
          )}
        </div>

        <div style={s.hint}>Your session is encrypted and stored locally.</div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', backgroundColor: '#0B0B14',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  container: { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 },
  backBtn: {
    background: 'none', border: 'none', color: '#6B6B8A', fontSize: 13,
    cursor: 'pointer', textAlign: 'left', padding: 0, marginBottom: 4,
  },
  logo: { textAlign: 'center', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 },
  logoText: { fontSize: 36, fontWeight: 800, color: '#FFFFFF', letterSpacing: 1 },
  logoSub:  { color: '#6B6B8A', fontSize: 13 },
  tabs: {
    display: 'flex', backgroundColor: '#13131F', borderRadius: 14,
    padding: 4, border: '1px solid #1E1E30',
  },
  tab: {
    flex: 1, padding: '10px 0', borderRadius: 11, border: 'none',
    background: 'transparent', color: '#6B6B8A', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  tabActive: { backgroundColor: '#1E1E30', color: '#FFF' },
  card: { backgroundColor: '#13131F', borderRadius: 18, padding: 24, border: '1px solid #1E1E30' },
  form: { display: 'flex', flexDirection: 'column', gap: 0 },
  cardTitle: { color: '#FFF', fontWeight: 700, fontSize: 18, marginBottom: 4 },
  cardSub:   { color: '#6B6B8A', fontSize: 13, marginBottom: 20 },
  label: {
    color: '#9999BB', fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
    marginBottom: 6, display: 'block',
  },
  input: {
    backgroundColor: '#0B0B14', border: '1px solid #2A2A3A', borderRadius: 12,
    padding: '13px 16px', color: '#FFF', fontSize: 15, width: '100%',
    outline: 'none', marginBottom: 4, fontFamily: 'inherit',
  },
  inputErr: { border: '1px solid #FF4444' },
  fieldErr: { color: '#FF6666', fontSize: 11, marginBottom: 12, display: 'block' },
  btn: {
    borderRadius: 12, padding: '14px 0', width: '100%', border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#FFF', marginTop: 4,
  },
  btnPurple: { backgroundColor: '#A855F7' },
  btnPink:   { backgroundColor: '#EC4899' },
  error: {
    backgroundColor: '#FF44441A', border: '1px solid #FF444440', borderRadius: 10,
    padding: '10px 14px', color: '#FF6666', fontSize: 13, textAlign: 'center', marginBottom: 12,
  },
  switchLink: {
    background: 'none', border: 'none', color: '#6B6B8A', fontSize: 13,
    cursor: 'pointer', marginTop: 16, textAlign: 'center', width: '100%',
    padding: 0, fontFamily: 'inherit',
  },
  adminToggle: {
    background: 'none', border: 'none', color: '#4A4A6A', fontSize: 11,
    cursor: 'pointer', textAlign: 'left', padding: 0, marginBottom: 4, fontFamily: 'inherit',
  },
  hint: { color: '#444460', fontSize: 11, textAlign: 'center' },
};
