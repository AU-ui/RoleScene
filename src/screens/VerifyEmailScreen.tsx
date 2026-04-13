/**
 * VerifyEmailScreen — shown after registration.
 * Tells the user to check their inbox and offers a resend button.
 */
import React, { useState } from 'react';

interface Props {
  email: string;
  onBack: () => void;
}

export default function VerifyEmailScreen({ email, onBack }: Props) {
  const [resent,   setResent]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleResend() {
    setLoading(true); setError(''); setResent(false);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? 'Failed to resend. Try again.');
        return;
      }
      setResent(true);
    } catch {
      setError('Cannot reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* Icon */}
        <div style={s.iconWrap}>
          <span style={s.icon}>📬</span>
        </div>

        {/* Heading */}
        <h1 style={s.title}>Check your inbox</h1>
        <p style={s.sub}>
          We sent a verification link to
        </p>
        <div style={s.emailChip}>{email}</div>
        <p style={s.sub}>
          Click the link in that email to activate your account.
          The link expires in <strong style={{ color: '#FFF' }}>24 hours</strong>.
        </p>

        {/* Resend */}
        {resent ? (
          <div style={s.success}>
            ✓ New verification link sent!
          </div>
        ) : (
          <>
            {error && <div style={s.error}>{error}</div>}
            <p style={s.hint}>Didn't receive it? Check your spam folder, or</p>
            <button
              style={s.resendBtn}
              onClick={handleResend}
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Resend verification email'}
            </button>
          </>
        )}

        {/* Back */}
        <button style={s.backBtn} onClick={onBack}>
          ← Back to sign in
        </button>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', backgroundColor: '#0B0B14',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  container: {
    width: '100%', maxWidth: 440,
    backgroundColor: '#13131F', borderRadius: 20,
    border: '1px solid #1E1E30', padding: '48px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    textAlign: 'center',
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: '50%',
    backgroundColor: '#A855F715', border: '1px solid #A855F730',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 36, marginBottom: 24,
  },
  icon: {},
  title: { color: '#FFF', fontSize: 24, fontWeight: 800, margin: '0 0 12px' },
  sub:   { color: '#6B6B8A', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' },
  emailChip: {
    backgroundColor: '#0B0B14', border: '1px solid #2A2A3A',
    borderRadius: 10, padding: '10px 20px',
    color: '#A855F7', fontSize: 14, fontWeight: 700,
    letterSpacing: 0.5, marginBottom: 16,
  },
  hint: { color: '#444460', fontSize: 12, margin: '16px 0 8px' },
  resendBtn: {
    backgroundColor: 'transparent', border: '1px solid #A855F7',
    borderRadius: 12, color: '#A855F7', fontSize: 14,
    fontWeight: 600, padding: '12px 28px',
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
    marginBottom: 16,
  },
  backBtn: {
    background: 'none', border: 'none',
    color: '#6B6B8A', fontSize: 13, cursor: 'pointer',
    marginTop: 8, fontFamily: 'inherit',
  },
  success: {
    backgroundColor: '#00C89615', border: '1px solid #00C89630',
    borderRadius: 10, padding: '12px 20px',
    color: '#00C896', fontSize: 14, fontWeight: 600,
    width: '100%', marginBottom: 16,
  },
  error: {
    backgroundColor: '#FF44441A', border: '1px solid #FF444440',
    borderRadius: 10, padding: '10px 14px',
    color: '#FF6666', fontSize: 13, width: '100%', marginBottom: 8,
  },
};
