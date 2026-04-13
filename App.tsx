/**
 * App.tsx — root router.
 *
 * Route map:
 *   'marketing'  → public landing page (unauthenticated)
 *   'auth'       → login / register
 *   'verify'     → "check your email" (after register)
 *   'verified'   → "email confirmed!" (after clicking link in email)
 *   'dashboard'  → user home (role='user')
 *   'admin'      → admin panel (role='admin')
 *   'host'       → host playback screen
 *   'guest'      → guest playback screen
 *
 * Email verification flow:
 *   1. User registers → 'verify' screen (check inbox)
 *   2. User clicks email link → app loads with ?verify=TOKEN in URL
 *   3. App calls GET /api/auth/verify → on success shows 'verified' screen
 *   4. After 3 s auto-redirects to 'dashboard'
 */
import React, { useState, useEffect } from 'react';
import MarketingPage      from './src/screens/MarketingPage';
import AuthScreen         from './src/screens/AuthScreen';
import VerifyEmailScreen  from './src/screens/VerifyEmailScreen';
import DashboardScreen    from './src/screens/DashboardScreen';
import AdminScreen        from './src/screens/AdminScreen';
import HostScreen         from './src/screens/HostScreen';
import GuestScreen        from './src/screens/GuestScreen';
import { useSessionStore } from './src/store/sessionStore';
import { useAuthStore }    from './src/store/authStore';
import type { UserRole }   from './src/store/authStore';

type View = 'marketing' | 'auth' | 'verify' | 'verified' | 'dashboard' | 'admin' | 'host' | 'guest';

function resolveInitialView(token: string | null, role: UserRole | undefined): View {
  if (!token) return 'marketing';
  if (role === 'admin') return 'admin';
  return 'dashboard';
}

// ── Verified splash screen (shown for 3 s after clicking email link) ──────

function VerifiedSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0B0B14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        textAlign: 'center', backgroundColor: '#13131F',
        borderRadius: 20, padding: '56px 48px',
        border: '1px solid #1E1E30', maxWidth: 400, width: '100%',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          backgroundColor: '#00C89615', border: '1px solid #00C89630',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 24px',
        }}>✅</div>
        <h1 style={{ color: '#FFF', fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
          Email verified!
        </h1>
        <p style={{ color: '#6B6B8A', fontSize: 14, marginBottom: 0 }}>
          Your account is now active. Taking you to your dashboard…
        </p>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const token        = useAuthStore((s) => s.token);
  const user         = useAuthStore((s) => s.user);
  const setAuth      = useAuthStore((s) => s.setAuth);
  const resetSession = useSessionStore((s) => s.resetSession);

  const [view,          setView]          = useState<View>(() => resolveInitialView(token, user?.role));
  const [pendingEmail,  setPendingEmail]  = useState('');
  const [verifyError,   setVerifyError]   = useState('');

  // ── Handle ?verify=TOKEN in URL (from email link) ─────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify');
    if (!verifyToken) return;

    // Remove token from URL immediately (clean up address bar)
    window.history.replaceState({}, '', window.location.pathname);

    fetch(`/api/auth/verify?token=${encodeURIComponent(verifyToken)}`)
      .then(r => r.json())
      .then((data: { token?: string; user?: { id: string; email: string; displayName: string; role: UserRole }; error?: string }) => {
        if (data.token && data.user) {
          setAuth(data.user, data.token);
          setView('verified');
        } else {
          setVerifyError(data.error ?? 'Verification failed. The link may have expired.');
          setView('auth');
        }
      })
      .catch(() => {
        setVerifyError('Could not reach server. Please try again.');
        setView('auth');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Logout → marketing ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      resetSession();
      setView('marketing');
    }
  }, [token, resetSession]);

  // ── Route guard: unauthenticated on protected view ────────────────────
  useEffect(() => {
    if (!token && !['marketing', 'auth', 'verify', 'verified'].includes(view)) {
      setView('marketing');
    }
  }, [token, view]);

  function handleAuth(role: UserRole) {
    setView(role === 'admin' ? 'admin' : 'dashboard');
  }

  function handleNeedsVerification(email: string) {
    setPendingEmail(email);
    setView('verify');
  }

  function handleLeaveSession() {
    resetSession();
    setView(user?.role === 'admin' ? 'admin' : 'dashboard');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (view === 'marketing') {
    return (
      <MarketingPage
        onSignIn={()    => setView('auth')}
        onGetStarted={() => setView('auth')}
      />
    );
  }

  if (view === 'auth') {
    return (
      <AuthScreen
        onAuth={handleAuth}
        onBack={() => setView('marketing')}
        onNeedsVerification={handleNeedsVerification}
        initialError={verifyError}
      />
    );
  }

  if (view === 'verify') {
    return (
      <VerifyEmailScreen
        email={pendingEmail}
        onBack={() => setView('auth')}
      />
    );
  }

  if (view === 'verified') {
    return <VerifiedSplash onDone={() => setView('dashboard')} />;
  }

  // Protected views
  if (!token) {
    return (
      <MarketingPage
        onSignIn={()    => setView('auth')}
        onGetStarted={() => setView('auth')}
      />
    );
  }

  if (view === 'admin') {
    if (user?.role !== 'admin') { setView('dashboard'); return null; }
    return <AdminScreen onLeave={() => setView('dashboard')} />;
  }

  if (view === 'host')  return <HostScreen  onLeave={handleLeaveSession} />;
  if (view === 'guest') return <GuestScreen onLeave={handleLeaveSession} />;

  return (
    <DashboardScreen
      onHost={()  => setView('host')}
      onGuest={() => setView('guest')}
    />
  );
}
