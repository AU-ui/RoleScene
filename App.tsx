import React, { useState, useEffect } from 'react';
import AuthScreen    from './src/screens/AuthScreen';
import LandingScreen from './src/screens/LandingScreen';
import HostScreen    from './src/screens/HostScreen';
import GuestScreen   from './src/screens/GuestScreen';
import { useSessionStore } from './src/store/sessionStore';
import { useAuthStore }    from './src/store/authStore';

type View = 'auth' | 'landing' | 'host' | 'guest';

export default function App() {
  const token       = useAuthStore((s) => s.token);
  const resetSession = useSessionStore((s) => s.resetSession);

  const [view, setView] = useState<View>(token ? 'landing' : 'auth');

  // When user logs out anywhere (token cleared), navigate back to auth
  useEffect(() => {
    if (!token && view !== 'auth') {
      resetSession();
      setView('auth');
    }
  }, [token, view, resetSession]);

  function handleAuth()  { setView('landing'); }

  function handleLeave() {
    resetSession();
    setView('landing');
  }

  if (view === 'auth')  return <AuthScreen    onAuth={handleAuth} />;
  if (view === 'host')  return <HostScreen    onLeave={handleLeave} />;
  if (view === 'guest') return <GuestScreen   onLeave={handleLeave} />;

  return (
    <LandingScreen
      onHost={()  => setView('host')}
      onGuest={() => setView('guest')}
    />
  );
}
