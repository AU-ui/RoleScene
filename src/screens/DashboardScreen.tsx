/**
 * DashboardScreen — post-login home for regular users.
 * Shows account info and lets the user host or join a session.
 */
import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore, authFetch } from '../store/authStore';

interface Props {
  onHost:  () => void;
  onGuest: () => void;
}

export default function DashboardScreen({ onHost, onGuest }: Props) {
  const [codeInput, setCodeInput] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const { setRole, setRoomCode } = useSessionStore();
  const { user, logout }         = useAuthStore();

  async function handleCreateSession() {
    setLoading(true); setError('');
    try {
      const res = await authFetch('/api/sessions', { method: 'POST' });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { setError('Could not create session. Try again.'); return; }
      const data = await res.json() as { roomCode: string };
      setRole('host');
      setRoomCode(data.roomCode);
      onHost();
    } catch {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinSession() {
    const code = codeInput.trim();
    if (!/^\d{6}$/.test(code)) { setError('Enter a valid 6-digit room code.'); return; }
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/sessions/${code}`);
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { setError('Room not found. Check the code and try again.'); return; }
      setRole('guest');
      setRoomCode(code);
      onGuest();
    } catch {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  const initial = (user?.displayName ?? '?').charAt(0).toUpperCase();

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header style={s.header}>
          <span style={s.logo}>RoleScene</span>
          <div style={s.headerRight}>
            <div style={s.avatar}>{initial}</div>
            <div style={s.userInfo}>
              <span style={s.userName}>{user?.displayName}</span>
              <span style={s.userEmail}>{user?.email}</span>
            </div>
            <button style={s.logoutBtn} onClick={logout}>Sign out</button>
          </div>
        </header>

        {/* ── Welcome banner ─────────────────────────────────────────── */}
        <div style={s.welcome}>
          <div style={s.welcomeLeft}>
            <h1 style={s.welcomeTitle}>Welcome back, {user?.displayName?.split(' ')[0]} 👋</h1>
            <p style={s.welcomeSub}>Your partner is just a room code away.</p>
          </div>
          <div style={s.roleBadge}>USER</div>
        </div>

        {/* ── Action cards ───────────────────────────────────────────── */}
        <div style={s.cardGrid}>

          {/* Host */}
          <div style={s.card}>
            <div style={s.cardIconWrap}>
              <span style={s.cardIcon}>🎙</span>
            </div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Host a Session</div>
              <div style={s.cardDesc}>
                Generate a 6-digit room code and invite your partner. You control playback.
              </div>
            </div>
            <button
              style={{ ...s.btn, ...s.btnPurple }}
              onClick={handleCreateSession}
              disabled={loading}
            >
              {loading ? 'Creating…' : 'Create Session'}
            </button>
          </div>

          {/* Guest */}
          <div style={s.card}>
            <div style={s.cardIconWrap}>
              <span style={s.cardIcon}>🔗</span>
            </div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Join a Session</div>
              <div style={s.cardDesc}>
                Enter the 6-digit code from your partner to sync up and listen together.
              </div>
            </div>
            <input
              style={s.codeInput}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="_ _ _ _ _ _"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
            />
            <button
              style={{ ...s.btn, ...s.btnPink, marginTop: 10 }}
              onClick={handleJoinSession}
              disabled={loading}
            >
              {loading ? 'Joining…' : 'Join Session'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div style={s.error}>{error}</div>}

        {/* ── Info strip ─────────────────────────────────────────────── */}
        <div style={s.infoStrip}>
          {[
            { icon: '🔒', text: 'End-to-end encrypted' },
            { icon: '🔄', text: 'Sub-200ms sync' },
            { icon: '🎧', text: 'Dual POV audio' },
          ].map(({ icon, text }) => (
            <div key={text} style={s.infoItem}>
              <span>{icon}</span>
              <span style={s.infoText}>{text}</span>
            </div>
          ))}
        </div>

        <p style={s.hint}>Both partners must have this page open simultaneously.</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', backgroundColor: '#0B0B14', color: '#FFF' },
  container: { maxWidth: 860, margin: '0 auto', padding: '0 24px 60px' },

  // Header
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 0', marginBottom: 32,
    borderBottom: '1px solid #1E1E30',
  },
  logo: { fontSize: 22, fontWeight: 800, letterSpacing: 0.5 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, #A855F7, #EC4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, flexShrink: 0,
  },
  userInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  userName:  { color: '#FFF', fontSize: 13, fontWeight: 600 },
  userEmail: { color: '#6B6B8A', fontSize: 11 },
  logoutBtn: {
    backgroundColor: 'transparent', border: '1px solid #2A2A3A',
    borderRadius: 8, color: '#6B6B8A', fontSize: 12,
    padding: '6px 14px', cursor: 'pointer',
  },

  // Welcome
  welcome: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#13131F', borderRadius: 18, padding: '28px 32px',
    marginBottom: 24, border: '1px solid #1E1E30',
  },
  welcomeLeft:  {},
  welcomeTitle: { fontSize: 24, fontWeight: 800, marginBottom: 6 },
  welcomeSub:   { color: '#6B6B8A', fontSize: 14 },
  roleBadge: {
    backgroundColor: '#A855F720', border: '1px solid #A855F7',
    borderRadius: 20, color: '#A855F7', fontSize: 11,
    fontWeight: 700, padding: '5px 14px', letterSpacing: 2,
  },

  // Cards
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20, marginBottom: 20,
  },
  card: {
    backgroundColor: '#13131F', borderRadius: 18,
    padding: 28, border: '1px solid #1E1E30',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  cardIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#0B0B14', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 26, marginBottom: 20,
  },
  cardIcon:  {},
  cardBody:  { marginBottom: 20, flex: 1 },
  cardTitle: { color: '#FFF', fontWeight: 700, fontSize: 18, marginBottom: 8 },
  cardDesc:  { color: '#6B6B8A', fontSize: 14, lineHeight: 1.5 },
  codeInput: {
    backgroundColor: '#0B0B14', border: '1px solid #2A2A3A', borderRadius: 12,
    padding: '14px 16px', color: '#FFF', fontSize: 22, fontWeight: 700,
    letterSpacing: 8, textAlign: 'center', width: '100%', outline: 'none',
    fontFamily: 'inherit',
  },

  // Buttons
  btn: {
    borderRadius: 12, padding: '14px 0', width: '100%', border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#FFF', fontFamily: 'inherit',
  },
  btnPurple: { backgroundColor: '#A855F7' },
  btnPink:   { backgroundColor: '#EC4899' },

  error: {
    backgroundColor: '#FF44441A', border: '1px solid #FF444440',
    borderRadius: 10, padding: '12px 16px', color: '#FF6666',
    fontSize: 13, textAlign: 'center', marginBottom: 16,
  },

  // Info strip
  infoStrip: {
    display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 24,
    backgroundColor: '#13131F', borderRadius: 14,
    padding: '18px 24px', border: '1px solid #1E1E30', marginBottom: 16,
  },
  infoItem: { display: 'flex', alignItems: 'center', gap: 8 },
  infoText: { color: '#6B6B8A', fontSize: 13 },

  hint: { color: '#444460', fontSize: 11, textAlign: 'center' },
};
