/**
 * AdminScreen — admin-only panel.
 * Shows platform stats, user management (role toggle), and session management (delete).
 * All data is fetched from /api/admin/* endpoints which require role='admin' in JWT.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore, authFetch } from '../store/authStore';

interface SafeUser {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  login_attempts: number;
  locked_until: number;
  created_at: number;
}

interface AdminSession {
  id: string;
  room_code: string;
  host_id: string | null;
  created_at: number;
  playback_state: string;
  current_segment: number;
  isActive: boolean;
}

interface Stats {
  userCount: number;
  sessionCount: number;
  activeRooms: number;
}

interface Props {
  onLeave: () => void;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const PLAY_STATE_COLOR: Record<string, string> = {
  playing: '#00C896',
  paused:  '#FFA500',
  idle:    '#6B6B8A',
};

// ── Sub-components ─────────────────────────────────────────────────────────

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div style={s.statCard}>
    <div style={{ ...s.statValue, color }}>{value}</div>
    <div style={s.statLabel}>{label}</div>
  </div>
);

// ── AdminScreen ─────────────────────────────────────────────────────────────

export default function AdminScreen({ onLeave }: Props) {
  const { user, logout } = useAuthStore();

  const [stats,    setStats]    = useState<Stats | null>(null);
  const [users,    setUsers]    = useState<SafeUser[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<'users' | 'sessions'>('users');

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [statsRes, usersRes, sessRes] = await Promise.all([
        authFetch('/api/admin/stats'),
        authFetch('/api/admin/users'),
        authFetch('/api/admin/sessions'),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        setError('Access denied. Admin privileges required.');
        return;
      }
      if (!statsRes.ok || !usersRes.ok || !sessRes.ok) {
        setError('Failed to load admin data.');
        return;
      }

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
      setSessions(await sessRes.json());
    } catch {
      setError('Could not reach server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleToggleRole(u: SafeUser) {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    const res = await authFetch(`/api/admin/users/${u.id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    });
    if (res.status === 400) {
      const d = await res.json() as { error: string };
      alert(d.error);
      return;
    }
    if (res.ok) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
      if (stats) {
        setStats({ ...stats, userCount: stats.userCount });
      }
    }
  }

  async function handleDeleteSession(id: string) {
    if (!window.confirm('Delete this session? Active connections will be closed.')) return;
    const res = await authFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (stats) setStats({ ...stats, sessionCount: stats.sessionCount - 1 });
    }
  }

  const initial = (user?.displayName ?? 'A').charAt(0).toUpperCase();

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header style={s.header}>
          <span style={s.logo}>RoleScene</span>
          <div style={s.headerRight}>
            <div style={{ ...s.avatar, background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}>
              {initial}
            </div>
            <div style={s.userInfo}>
              <span style={s.userName}>{user?.displayName}</span>
              <span style={s.adminBadgeInline}>ADMIN</span>
            </div>
            <button style={s.leaveBtn} onClick={onLeave}>Dashboard</button>
            <button style={s.logoutBtn} onClick={logout}>Sign out</button>
          </div>
        </header>

        <h1 style={s.pageTitle}>Admin Panel</h1>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        {loading ? (
          <div style={s.loadingText}>Loading…</div>
        ) : error ? (
          <div style={s.errorBox}>{error}</div>
        ) : (
          <>
            <div style={s.statsRow}>
              <StatCard label="Total Users"     value={stats?.userCount    ?? 0} color="#A855F7" />
              <StatCard label="Total Sessions"  value={stats?.sessionCount ?? 0} color="#EC4899" />
              <StatCard label="Active Rooms"    value={stats?.activeRooms  ?? 0} color="#00C896" />
            </div>

            {/* ── Tabs ───────────────────────────────────────────────── */}
            <div style={s.tabs}>
              <button
                style={{ ...s.tabBtn, ...(tab === 'users'    ? s.tabActive : {}) }}
                onClick={() => setTab('users')}
              >
                Users ({users.length})
              </button>
              <button
                style={{ ...s.tabBtn, ...(tab === 'sessions' ? s.tabActive : {}) }}
                onClick={() => setTab('sessions')}
              >
                Sessions ({sessions.length})
              </button>
              <button style={s.refreshBtn} onClick={fetchAll}>↻ Refresh</button>
            </div>

            {/* ── Users table ────────────────────────────────────────── */}
            {tab === 'users' && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Name', 'Email', 'Role', 'Joined', 'Failed Logins', 'Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={s.tr}>
                        <td style={s.td}>{u.display_name}</td>
                        <td style={{ ...s.td, color: '#9999BB' }}>{u.email}</td>
                        <td style={s.td}>
                          <span style={{
                            ...s.rolePill,
                            backgroundColor: u.role === 'admin' ? '#F59E0B20' : '#A855F720',
                            color:           u.role === 'admin' ? '#F59E0B'   : '#A855F7',
                            borderColor:     u.role === 'admin' ? '#F59E0B'   : '#A855F7',
                          }}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...s.td, color: '#6B6B8A' }}>{formatDate(u.created_at)}</td>
                        <td style={{ ...s.td, color: u.login_attempts > 0 ? '#FFA500' : '#6B6B8A' }}>
                          {u.login_attempts}
                          {u.locked_until > Date.now() / 1000 && (
                            <span style={{ color: '#FF4444', fontSize: 10, display: 'block' }}>
                              Locked
                            </span>
                          )}
                        </td>
                        <td style={s.td}>
                          {u.id !== user?.id ? (
                            <button
                              style={{
                                ...s.actionBtn,
                                ...(u.role === 'admin'
                                  ? { borderColor: '#EF4444', color: '#EF4444' }
                                  : { borderColor: '#F59E0B', color: '#F59E0B' }),
                              }}
                              onClick={() => handleToggleRole(u)}
                            >
                              {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                            </button>
                          ) : (
                            <span style={{ color: '#444460', fontSize: 11 }}>You</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={6} style={{ ...s.td, color: '#6B6B8A', textAlign: 'center' }}>No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Sessions table ─────────────────────────────────────── */}
            {tab === 'sessions' && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Room Code', 'Status', 'Segment', 'Created', 'Live', 'Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(sess => (
                      <tr key={sess.id} style={s.tr}>
                        <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 3, color: '#A855F7' }}>
                          {sess.room_code}
                        </td>
                        <td style={s.td}>
                          <span style={{ color: PLAY_STATE_COLOR[sess.playback_state] ?? '#6B6B8A', fontWeight: 600 }}>
                            {sess.playback_state}
                          </span>
                        </td>
                        <td style={{ ...s.td, color: '#6B6B8A' }}>Ch {sess.current_segment + 1}</td>
                        <td style={{ ...s.td, color: '#6B6B8A' }}>{formatDate(sess.created_at)}</td>
                        <td style={s.td}>
                          {sess.isActive
                            ? <span style={{ color: '#00C896', fontSize: 12 }}>● Live</span>
                            : <span style={{ color: '#6B6B8A', fontSize: 12 }}>○ Idle</span>}
                        </td>
                        <td style={s.td}>
                          <button
                            style={{ ...s.actionBtn, borderColor: '#EF4444', color: '#EF4444' }}
                            onClick={() => handleDeleteSession(sess.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr><td colSpan={6} style={{ ...s.td, color: '#6B6B8A', textAlign: 'center' }}>No sessions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', backgroundColor: '#0B0B14', color: '#FFF' },
  container: { maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px' },

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
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, flexShrink: 0,
  },
  userInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  userName: { color: '#FFF', fontSize: 13, fontWeight: 600 },
  adminBadgeInline: {
    backgroundColor: '#F59E0B20', border: '1px solid #F59E0B',
    borderRadius: 10, color: '#F59E0B', fontSize: 9,
    fontWeight: 700, padding: '2px 8px', letterSpacing: 2,
  },
  leaveBtn: {
    backgroundColor: 'transparent', border: '1px solid #2A2A3A',
    borderRadius: 8, color: '#A855F7', fontSize: 12,
    padding: '6px 14px', cursor: 'pointer',
  },
  logoutBtn: {
    backgroundColor: 'transparent', border: '1px solid #2A2A3A',
    borderRadius: 8, color: '#6B6B8A', fontSize: 12,
    padding: '6px 14px', cursor: 'pointer',
  },

  pageTitle: { fontSize: 28, fontWeight: 800, marginBottom: 28 },

  // Stats
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16, marginBottom: 32,
  },
  statCard: {
    backgroundColor: '#13131F', borderRadius: 16,
    padding: '24px 28px', border: '1px solid #1E1E30',
    textAlign: 'center',
  },
  statValue: { fontSize: 40, fontWeight: 800, marginBottom: 6 },
  statLabel: { color: '#6B6B8A', fontSize: 13, fontWeight: 600 },

  // Tabs
  tabs: {
    display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20,
  },
  tabBtn: {
    backgroundColor: 'transparent', border: '1px solid #2A2A3A',
    borderRadius: 10, color: '#6B6B8A', fontSize: 13,
    fontWeight: 600, padding: '9px 20px', cursor: 'pointer',
  },
  tabActive: {
    backgroundColor: '#1E1E30', color: '#FFF', borderColor: '#3A3A5A',
  },
  refreshBtn: {
    marginLeft: 'auto', backgroundColor: 'transparent', border: '1px solid #2A2A3A',
    borderRadius: 10, color: '#6B6B8A', fontSize: 12,
    padding: '9px 16px', cursor: 'pointer',
  },

  // Table
  tableWrap: {
    overflowX: 'auto', backgroundColor: '#13131F',
    borderRadius: 16, border: '1px solid #1E1E30',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
  },
  th: {
    padding: '14px 20px', textAlign: 'left',
    color: '#6B6B8A', fontSize: 11, fontWeight: 700,
    letterSpacing: 1, textTransform: 'uppercase',
    borderBottom: '1px solid #1E1E30',
  },
  tr: { borderBottom: '1px solid #1E1E3050' },
  td: { padding: '14px 20px', fontSize: 13, color: '#DDD', verticalAlign: 'middle' },

  rolePill: {
    display: 'inline-block', border: '1px solid',
    borderRadius: 20, fontSize: 10, fontWeight: 700,
    padding: '3px 10px', letterSpacing: 1,
  },

  actionBtn: {
    backgroundColor: 'transparent', border: '1px solid',
    borderRadius: 8, fontSize: 11, fontWeight: 600,
    padding: '5px 12px', cursor: 'pointer',
  },

  // Misc
  loadingText: { color: '#6B6B8A', textAlign: 'center', padding: '60px 0', fontSize: 16 },
  errorBox: {
    backgroundColor: '#FF44441A', border: '1px solid #FF444440',
    borderRadius: 12, padding: '16px 20px',
    color: '#FF6666', fontSize: 14, textAlign: 'center',
  },
};
