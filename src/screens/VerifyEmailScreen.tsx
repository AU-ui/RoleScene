/**
 * VerifyEmailScreen — shown after registration.
 * Tells the user to check their inbox and offers a resend button.
 */
import React, { useState } from 'react';
import { apiUrl } from '../lib/api';

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
      const res = await fetch(apiUrl('/api/auth/resend-verification'), {
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
          The link expires in <strong style={{ color: '#F5EDD8' }}>24 hours</strong>.
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
    minHeight: '100vh', backgroundColor: '#080401',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  container: {
    width: '100%', maxWidth: 440,
    backgroundColor: '#160C05', borderRadius: 20,
    border: '1px solid #3A1A08', padding: '48px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    textAlign: 'center',
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: '50%',
    backgroundColor: '#C8860A15', border: '1px solid #C8860A30',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 36, marginBottom: 24,
  },
  icon: {},
  title: { color: '#F5EDD8', fontSize: 24, fontWeight: 800, margin: '0 0 12px' },
  sub:   { color: '#7A5535', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' },
  emailChip: {
    backgroundColor: '#0D0501', border: '1px solid #4A2810',
    borderRadius: 10, padding: '10px 20px',
    color: '#D4A017', fontSize: 14, fontWeight: 700,
    letterSpacing: 0.5, marginBottom: 16,
  },
  hint: { color: '#5A3A18', fontSize: 12, margin: '16px 0 8px' },
  resendBtn: {
    backgroundColor: 'transparent', border: '1px solid #C8860A',
    borderRadius: 12, color: '#D4A017', fontSize: 14,
    fontWeight: 600, padding: '12px 28px',
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
    marginBottom: 16,
  },
  backBtn: {
    background: 'none', border: 'none',
    color: '#7A5535', fontSize: 13, cursor: 'pointer',
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
