/**
 * MarketingPage — public-facing landing page shown to unauthenticated visitors.
 * No API calls. Pure presentation.
 */
import React from 'react';

interface Props {
  onSignIn: () => void;
  onGetStarted: () => void;
}

const features = [
  {
    icon: '🎙',
    title: 'Dual POV Audio',
    desc: 'Each partner hears their own narrative perspective — host and guest — perfectly time-aligned from opposite sides of the story.',
  },
  {
    icon: '🔄',
    title: 'Real-time Sync',
    desc: 'Sub-200ms WebSocket synchronization keeps both devices in perfect harmony across any network. Drift correction runs automatically.',
  },
  {
    icon: '💫',
    title: 'Partner Connection',
    desc: 'A shared intensity slider (1–10) lets you express how you\'re feeling in real time. See each other\'s score and your combined average.',
  },
];

const steps = [
  { n: '01', title: 'Create an account', desc: 'Sign up — it takes under 30 seconds.' },
  { n: '02', title: 'Host a session',    desc: 'Get a 6-digit room code and share it with your partner.' },
  { n: '03', title: 'Press play',        desc: 'Both devices start in sync. Your story unfolds together.' },
];

export default function MarketingPage({ onSignIn, onGetStarted }: Props) {
  return (
    <div style={s.root}>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav style={s.nav}>
        <span style={s.navLogo}>RoleScene</span>
        <button style={s.navSignIn} onClick={onSignIn}>Sign In</button>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={s.hero}>
        <div style={s.badge}>✨ Synchronized dual-device audio</div>

        <h1 style={s.h1}>
          The most intimate audio<br />
          experience{' '}
          <span style={s.gradient}>for couples</span>
        </h1>

        <p style={s.heroSub}>
          Each partner hears their own narrative perspective. Both stories unfold
          together — perfectly synchronized, deeply immersive.
        </p>

        <div style={s.heroActions}>
          <button style={{ ...s.btn, ...s.btnPurple }} onClick={onGetStarted}>
            Get Started — It's Free
          </button>
          <button style={{ ...s.btn, ...s.btnGhost }} onClick={onSignIn}>
            Sign In
          </button>
        </div>

        {/* Decorative glow */}
        <div style={s.heroGlow} />
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionLabel}>HOW IT WORKS</div>
        <h2 style={s.h2}>Three steps to connect</h2>
        <div style={s.stepsGrid}>
          {steps.map(({ n, title, desc }) => (
            <div key={n} style={s.stepCard}>
              <div style={s.stepNum}>{n}</div>
              <div style={s.stepTitle}>{title}</div>
              <div style={s.stepDesc}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionLabel}>FEATURES</div>
        <h2 style={s.h2}>Built for the moment</h2>
        <div style={s.featGrid}>
          {features.map(({ icon, title, desc }) => (
            <div key={title} style={s.featCard}>
              <div style={s.featIcon}>{icon}</div>
              <div style={s.featTitle}>{title}</div>
              <div style={s.featDesc}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust bar ──────────────────────────────────────────────────── */}
      <section style={s.trustBar}>
        {['End-to-end encrypted', 'No ads. Ever.', 'Private by design'].map(t => (
          <div key={t} style={s.trustItem}>
            <span style={s.trustDot}>●</span>
            <span>{t}</span>
          </div>
        ))}
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section style={s.ctaSection}>
        <h2 style={s.ctaTitle}>Ready to connect?</h2>
        <p style={s.ctaSub}>Your partner is waiting. Start your first session tonight.</p>
        <button style={{ ...s.btn, ...s.btnPurple, ...s.btnLarge }} onClick={onGetStarted}>
          Create Free Account
        </button>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={s.footer}>
        <span style={s.footerLogo}>RoleScene</span>
        <span style={s.footerSub}>Private · Encrypted · Immersive</span>
      </footer>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', backgroundColor: '#0B0B14', color: '#FFF',
    overflowX: 'hidden',
  },

  // Navbar
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 40px', position: 'sticky', top: 0, zIndex: 10,
    backgroundColor: '#0B0B14CC', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #1E1E3020',
  },
  navLogo:  { fontSize: 20, fontWeight: 800, letterSpacing: 0.5 },
  navSignIn: {
    backgroundColor: 'transparent', border: '1px solid #2A2A3A',
    borderRadius: 10, color: '#CCC', fontSize: 13, fontWeight: 600,
    padding: '8px 18px', cursor: 'pointer',
  },

  // Hero
  hero: {
    textAlign: 'center', padding: '100px 24px 80px',
    maxWidth: 760, margin: '0 auto', position: 'relative',
  },
  badge: {
    display: 'inline-block', backgroundColor: '#A855F715',
    border: '1px solid #A855F730', borderRadius: 20,
    color: '#C084FC', fontSize: 12, fontWeight: 600,
    padding: '6px 16px', marginBottom: 32, letterSpacing: 0.5,
  },
  h1: {
    fontSize: 'clamp(32px, 6vw, 64px)', fontWeight: 800,
    lineHeight: 1.15, marginBottom: 24, letterSpacing: -0.5,
  },
  gradient: {
    background: 'linear-gradient(135deg, #A855F7, #EC4899)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    color: '#9999BB', fontSize: 18, lineHeight: 1.6,
    maxWidth: 540, margin: '0 auto 40px',
  },
  heroActions: {
    display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
  },
  heroGlow: {
    position: 'absolute', top: '30%', left: '50%',
    transform: 'translateX(-50%)',
    width: 600, height: 300, borderRadius: '50%',
    background: 'radial-gradient(ellipse, #A855F715 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: -1,
  },

  // Section
  section: { padding: '80px 24px', maxWidth: 1000, margin: '0 auto' },
  sectionLabel: {
    color: '#6B6B8A', fontSize: 11, fontWeight: 700, letterSpacing: 3,
    textTransform: 'uppercase', marginBottom: 12, textAlign: 'center',
  },
  h2: {
    fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800,
    textAlign: 'center', marginBottom: 48,
  },

  // Steps
  stepsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 24,
  },
  stepCard: {
    backgroundColor: '#13131F', borderRadius: 18,
    padding: 28, border: '1px solid #1E1E30',
  },
  stepNum:   { color: '#A855F7', fontSize: 32, fontWeight: 800, marginBottom: 12 },
  stepTitle: { color: '#FFF', fontWeight: 700, fontSize: 16, marginBottom: 8 },
  stepDesc:  { color: '#6B6B8A', fontSize: 14, lineHeight: 1.5 },

  // Features
  featGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24,
  },
  featCard: {
    backgroundColor: '#13131F', borderRadius: 18, padding: 28,
    border: '1px solid #1E1E30',
  },
  featIcon:  { fontSize: 36, marginBottom: 16 },
  featTitle: { color: '#FFF', fontWeight: 700, fontSize: 17, marginBottom: 10 },
  featDesc:  { color: '#6B6B8A', fontSize: 14, lineHeight: 1.6 },

  // Trust bar
  trustBar: {
    display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 32,
    padding: '40px 24px', borderTop: '1px solid #1E1E30', borderBottom: '1px solid #1E1E30',
  },
  trustItem: { display: 'flex', alignItems: 'center', gap: 8, color: '#6B6B8A', fontSize: 13 },
  trustDot:  { color: '#00C896', fontSize: 8 },

  // CTA section
  ctaSection: {
    textAlign: 'center', padding: '100px 24px',
  },
  ctaTitle: { fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, marginBottom: 16 },
  ctaSub:   { color: '#6B6B8A', fontSize: 16, marginBottom: 36 },

  // Footer
  footer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '40px 24px', borderTop: '1px solid #1E1E30',
  },
  footerLogo: { fontSize: 18, fontWeight: 800 },
  footerSub:  { color: '#444460', fontSize: 12 },

  // Buttons
  btn: {
    borderRadius: 14, padding: '14px 28px', border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#FFF',
    fontFamily: 'inherit',
  },
  btnPurple: { backgroundColor: '#A855F7' },
  btnGhost: {
    backgroundColor: 'transparent', border: '1px solid #2A2A3A', color: '#CCC',
  },
  btnLarge: { padding: '16px 40px', fontSize: 16, borderRadius: 16 },
};
