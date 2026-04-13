import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore, authFetch } from '../store/authStore';

interface Props {
  onHost:  () => void;
  onGuest: () => void;
}

export default function LandingScreen({ onHost, onGuest }: Props) {
  const [codeInput, setCodeInput] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const { setRole, setRoomCode } = useSessionStore();
  const { user, logout }         = useAuthStore();

  async function handleCreateSession() {
    setLoading(true); setError('');
    try {
      const res  = await authFetch('/api/sessions', { method: 'POST' });
      if (res.status === 401) { logout(); return; }
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
    if (code.length !== 6) { setError('Enter a 6-digit room code.'); return; }
    setLoading(true); setError('');
    try {
      const res = await authFetch(`/api/sessions/${code}`);
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { setError('Room not found. Check the code.'); return; }
      setRole('guest');
      setRoomCode(code);
      onGuest();
    } catch {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* Header with user info */}
        <div style={s.topBar}>
          <div>
            <div style={s.logoText}>RoleScene</div>
            <div style={s.logoSub}>Premium dual-device audio experience</div>
          </div>
          <div style={s.userArea}>
            <span style={s.userName}>{user?.displayName}</span>
            <button style={s.logoutBtn} onClick={logout}>Sign out</button>
          </div>
        </div>

        {/* Create session */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <span style={s.cardIcon}>🎙</span>
            <div>
              <div style={s.cardTitle}>Host a Session</div>
              <div style={s.cardDesc}>Generate a room code &amp; invite your partner</div>
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

        {/* Join session */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <span style={s.cardIcon}>🔗</span>
            <div>
              <div style={s.cardTitle}>Join a Session</div>
              <div style={s.cardDesc}>Enter the 6-digit code from your partner</div>
            </div>
          </div>
          <input
            style={s.input}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="_ _ _ _ _ _"
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, '')); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
          />
          <button
            style={{ ...s.btn, ...s.btnPink, marginTop: 12 }}
            onClick={handleJoinSession}
            disabled={loading}
          >
            {loading ? 'Joining…' : 'Join Session'}
          </button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.hint}>Both partners must have this page open simultaneously.</div>
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
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  logoSub: {
    color: '#6B6B8A',
    fontSize: 11,
    marginTop: 2,
  },
  userArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  userName: {
    color: '#CCC',
    fontSize: 13,
    fontWeight: 600,
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #2A2A3A',
    borderRadius: 8,
    color: '#6B6B8A',
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  card: {
    backgroundColor: '#13131F',
    borderRadius: 18,
    padding: 20,
    border: '1px solid #1E1E30',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  cardIcon:  { fontSize: 28, flexShrink: 0 },
  cardTitle: { color: '#FFF', fontWeight: 700, fontSize: 16 },
  cardDesc:  { color: '#6B6B8A', fontSize: 12, marginTop: 2 },
  btn: {
    borderRadius: 12,
    padding: '14px 0',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 15,
    color: '#FFF',
  },
  btnPurple: { backgroundColor: '#A855F7' },
  btnPink:   { backgroundColor: '#EC4899' },
  input: {
    backgroundColor: '#0B0B14',
    border: '1px solid #2A2A3A',
    borderRadius: 12,
    padding: '14px 16px',
    color: '#FFF',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  },
  error: {
    backgroundColor: '#FF44441A',
    border: '1px solid #FF444440',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#FF6666',
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    color: '#444460',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
};
