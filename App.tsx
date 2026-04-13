/**
 * App.tsx — root router.
 *
 * Route map:
 *   'marketing'  → public landing page (unauthenticated)
 *   'auth'       → login / register
 *   'dashboard'  → user home (role='user')
 *   'admin'      → admin panel (role='admin')
 *   'host'       → host playback screen
 *   'guest'      → guest playback screen
 *
 * Route protection:
 *   - No token → 'marketing'
 *   - Token + role='admin' → 'admin' (admin cannot use host/guest screens)
 *   - Token + role='user'  → 'dashboard'
 */
import React, { useState, useEffect } from 'react';
import MarketingPage   from './src/screens/MarketingPage';
import AuthScreen      from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AdminScreen     from './src/screens/AdminScreen';
import HostScreen      from './src/screens/HostScreen';
import GuestScreen     from './src/screens/GuestScreen';
import { useSessionStore } from './src/store/sessionStore';
import { useAuthStore }    from './src/store/authStore';
import type { UserRole }   from './src/store/authStore';

type View = 'marketing' | 'auth' | 'dashboard' | 'admin' | 'host' | 'guest';

function resolveInitialView(token: string | null, role: UserRole | undefined): View {
  if (!token) return 'marketing';
  if (role === 'admin') return 'admin';
  return 'dashboard';
}

export default function App() {
  const token        = useAuthStore((s) => s.token);
  const user         = useAuthStore((s) => s.user);
  const resetSession = useSessionStore((s) => s.resetSession);

  const [view, setView] = useState<View>(() =>
    resolveInitialView(token, user?.role)
  );

  // When the user logs out (token cleared), return to marketing
  useEffect(() => {
    if (!token) {
      resetSession();
      setView('marketing');
    }
  }, [token, resetSession]);

  function handleAuth(role: UserRole) {
    setView(role === 'admin' ? 'admin' : 'dashboard');
  }

  function handleLeaveSession() {
    resetSession();
    // After leaving a host/guest session, route back appropriately
    setView(user?.role === 'admin' ? 'admin' : 'dashboard');
  }

  function handleLeaveAdmin() {
    setView('dashboard');
  }

  // ── Route guard helpers ─────────────────────────────────────────────────

  // If somehow unauthenticated user reaches a protected view, snap back
  useEffect(() => {
    if (!token && view !== 'marketing' && view !== 'auth') {
      setView('marketing');
    }
  }, [token, view]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (view === 'marketing') {
    return (
      <MarketingPage
        onSignIn={()     => setView('auth')}
        onGetStarted={()  => setView('auth')}
      />
    );
  }

  if (view === 'auth') {
    return (
      <AuthScreen
        onAuth={handleAuth}
        onBack={() => setView('marketing')}
      />
    );
  }

  // Protected views — require token
  if (!token) {
    return (
      <MarketingPage
        onSignIn={()    => setView('auth')}
        onGetStarted={() => setView('auth')}
      />
    );
  }

  if (view === 'admin') {
    // Admin guard: non-admins who somehow land here go to dashboard
    if (user?.role !== 'admin') { setView('dashboard'); return null; }
    return (
      <AdminScreen
        onLeave={handleLeaveAdmin}
      />
    );
  }

  if (view === 'host') {
    return <HostScreen onLeave={handleLeaveSession} />;
  }

  if (view === 'guest') {
    return <GuestScreen onLeave={handleLeaveSession} />;
  }

  // Default: dashboard
  return (
    <DashboardScreen
      onHost={()  => setView('host')}
      onGuest={() => setView('guest')}
    />
  );
}
