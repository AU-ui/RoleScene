import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore, authFetch } from '../store/authStore';

interface Props {
  onHost:  () => void;
  onGuest: () => void;
}

export default function DashboardScreen({ onHost, onGuest }: Props) {
  const [codeInput,     setCodeInput]     = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [createdCode,   setCreatedCode]   = useState('');
  const [copied,        setCopied]        = useState(false);
  const [tab,           setTab]           = useState<'start' | 'join'>('start');

  const { setRole, setRoomCode } = useSessionStore();
  const { user, logout }         = useAuthStore();

  async function handleCreateSession() {
    setLoading(true); setError('');
    try {
      const res = await authFetch('/api/sessions', { method: 'POST' });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { setError('Could not create session. Try again.'); return; }
      const data = await res.json() as { roomCode: string };
      setCreatedCode(data.roomCode);
      setRole('host');
      setRoomCode(data.roomCode);
    } catch {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinSession() {
    const code = codeInput.trim();
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your partner.'); return; }
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/sessions/${code}`);
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { setError('Code not found — ask your partner to check their room code.'); return; }
      setRole('guest');
      setRoomCode(code);
      onGuest();
    } catch {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(createdCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const initial = (user?.displayName ?? '?').charAt(0).toUpperCase();

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* Header */}
        <header style={s.header}>
          <span style={s.logo}>RoleScene</span>
          <div style={s.headerRight}>
            <div style={s.avatar}>{initial}</div>
            <span style={s.userName}>{user?.displayName}</span>
            <button style={s.logoutBtn} onClick={logout}>Sign out</button>
          </div>
        </header>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={s.title}>Ready to begin?</h1>
          <p style={s.subtitle}>Start a scene or join your partner's session.</p>
        </div>

        {/* Tab switcher */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === 'start' ? s.tabActive : {}) }}
            onClick={() => { setTab('start'); setError(''); setCreatedCode(''); }}
          >
            Start a Scene
          </button>
          <button
            style={{ ...s.tab, ...(tab === 'join' ? s.tabActive : {}) }}
            onClick={() => { setTab('join'); setError(''); }}
          >
            Join a Scene
          </button>
        </div>

        {/* ── START TAB ──────────────────────────────────────────────── */}
        {tab === 'start' && (
          <div style={s.panel}>
            {!createdCode ? (
              <>
                <div style={s.stepWrap}>
                  {[
                    { n: '1', text: 'Tap "Create Session" below' },
                    { n: '2', text: 'Share the room code with your partner' },
                    { n: '3', text: 'Once they join, hit Play' },
                  ].map(({ n, text }) => (
                    <div key={n} style={s.step}>
                      <div style={s.stepNum}>{n}</div>
                      <span style={s.stepText}>{text}</span>
                    </div>
                  ))}
                </div>
                <button style={s.btnPrimary} onClick={handleCreateSession} disabled={loading}>
                  {loading ? 'Creating…' : 'Create Session'}
                </button>
              </>
            ) : (
              <>
                <p style={s.shareLabel}>Share this code with your partner:</p>
                <div style={s.codeRow}>
                  {createdCode.split('').map((d, i) => (
                    <div key={i} style={s.digitBox}>{d}</div>
                  ))}
                </div>
                <button style={s.btnCopy} onClick={handleCopy}>
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </button>
                <div style={s.dividerLine} />
                <button style={s.btnPrimary} onClick={onHost}>
                  Enter as Host →
                </button>
                <p style={s.hintText}>Enter after your partner has joined using the code above.</p>
              </>
            )}
          </div>
        )}

        {/* ── JOIN TAB ───────────────────────────────────────────────── */}
        {tab === 'join' && (
          <div style={s.panel}>
            <div style={s.stepWrap}>
              {[
                { n: '1', text: 'Ask your partner to create a session' },
                { n: '2', text: 'Enter the 6-digit code they share with you' },
                { n: '3', text: 'Tap Join and wait for them to hit Play' },
              ].map(({ n, text }) => (
                <div key={n} style={s.step}>
                  <div style={s.stepNum}>{n}</div>
                  <span style={s.stepText}>{text}</span>
                </div>
              ))}
            </div>
            <input
              style={s.codeInput}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="_ _ _ _ _ _"
              value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
              autoFocus
            />
            <button
              style={{ ...s.btnPrimary, ...s.btnJoin }}
              onClick={handleJoinSession}
              disabled={loading || codeInput.length < 6}
            >
              {loading ? 'Joining…' : 'Join Session'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && <div style={s.error}>{error}</div>}

        {/* Feature image */}
        <div style={{ marginTop: 48, borderRadius: 20, overflow: 'hidden', border: '1px solid #3A1A08', boxShadow: '0 12px 48px #00000060', position: 'relative' }}>
          <img src="/one.jpeg" alt="RoleScene" style={{ width: '100%', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 65%, #080401 100%)', pointerEvents: 'none' }} />
        </div>

      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:      { minHeight: '100vh', backgroundColor: '#080401', color: '#F5EDD8' },
  container: { maxWidth: 520, margin: '0 auto', padding: '0 20px 60px' },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 0', marginBottom: 40, borderBottom: '1px solid #3A1A08',
  },
  logo:       { fontSize: 20, fontWeight: 800, color: '#E8B84B', letterSpacing: 1 },
  headerRight:{ display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4A017, #8B4A05)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#FFF5E0', flexShrink: 0,
  },
  userName:  { color: '#C4A070', fontSize: 13, fontWeight: 600 },
  logoutBtn: {
    backgroundColor: 'transparent', border: '1px solid #4A2810',
    borderRadius: 8, color: '#7A5535', fontSize: 12,
    padding: '5px 12px', cursor: 'pointer',
  },

  title:    { fontSize: 28, fontWeight: 800, color: '#F5EDD8', marginBottom: 8 },
  subtitle: { color: '#7A5535', fontSize: 15 },

  tabs: {
    display: 'flex', gap: 0, marginBottom: 0,
    backgroundColor: '#160C05', borderRadius: '14px 14px 0 0',
    border: '1px solid #3A1A08', borderBottom: 'none', overflow: 'hidden',
  },
  tab: {
    flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', border: 'none', backgroundColor: 'transparent',
    color: '#7A5535', fontFamily: 'inherit', transition: 'all 0.15s',
  },
  tabActive: {
    backgroundColor: '#1E0C04', color: '#E8B84B',
    borderBottom: '2px solid #C8860A',
  },

  panel: {
    backgroundColor: '#160C05', borderRadius: '0 0 18px 18px',
    border: '1px solid #3A1A08', borderTop: 'none',
    padding: '28px 24px', marginBottom: 16,
  },

  stepWrap: { marginBottom: 24 },
  step: {
    display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14,
  },
  stepNum: {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    backgroundColor: '#C8860A20', border: '1px solid #C8860A60',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#D4A017', fontSize: 13, fontWeight: 800,
  },
  stepText: { color: '#9B7A58', fontSize: 14, lineHeight: 1.5, paddingTop: 4 },

  shareLabel: { color: '#D4A017', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 16 },
  codeRow: {
    display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16,
  },
  digitBox: {
    width: 44, height: 56, borderRadius: 10,
    backgroundColor: '#0D0501', border: '1px solid #D4A017',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#D4A017', fontSize: 24, fontWeight: 800,
  },
  btnCopy: {
    width: '100%', padding: '12px 0', borderRadius: 12,
    backgroundColor: '#C8860A15', border: '1px solid #C8860A40',
    color: '#D4A017', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20,
  },
  dividerLine: {
    height: 1, backgroundColor: '#3A1A08', marginBottom: 20,
  },
  btnPrimary: {
    width: '100%', padding: '15px 0', borderRadius: 14,
    background: 'linear-gradient(135deg, #D4A017, #8B4A05)',
    color: '#FFF5E0', fontSize: 15, fontWeight: 700,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnJoin: {
    background: 'linear-gradient(135deg, #C87020, #6B3A05)',
    marginTop: 12,
  },
  hintText: { color: '#5A3A18', fontSize: 12, textAlign: 'center', marginTop: 12 },

  codeInput: {
    width: '100%', backgroundColor: '#0D0501',
    border: '1px solid #4A2810', borderRadius: 12,
    padding: '16px', color: '#F5EDD8', fontSize: 26,
    fontWeight: 700, letterSpacing: 10, textAlign: 'center',
    outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },

  error: {
    backgroundColor: '#FF44441A', border: '1px solid #FF444440',
    borderRadius: 10, padding: '12px 16px', color: '#FF6666',
    fontSize: 13, textAlign: 'center', marginBottom: 16,
  },

};
