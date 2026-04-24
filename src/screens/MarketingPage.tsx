/**
 * MarketingPage — cinematic dark-gold landing page.
 * Palette: deep warm brown background, amber/gold accents.
 */
import React from 'react';

interface Props {
  onSignIn: () => void;
  onGetStarted: () => void;
}



const sceneCards = [
  { title: 'The First Encounter', desc: "You weren't supposed to meet.",       bgX: '3%'  },
  { title: 'The Invitation',      desc: 'A door opens… just for you.',          bgX: '35%' },
  { title: 'The Unspoken Dare',   desc: 'You both know what happens next.',     bgX: '67%' },
  { title: 'The Hidden Path',     desc: 'Not everything is meant to be found.', bgX: '99%' },
];

function SceneCardsSection() {
  const [hovered, setHovered] = React.useState<string | null>(null);
  return (
    <section style={{ padding: '60px 24px', maxWidth: 1040, margin: '0 auto', textAlign: 'center' }}>
      <div style={s.sectionLabel}>SCENES</div>
      <h2 style={{ fontSize: 'clamp(26px,5vw,52px)', fontWeight: 800, color: '#F5EDD8', marginBottom: 36 }}>
        Try <em style={{ fontStyle: 'italic', background: `linear-gradient(135deg,${AMBER},${GOLD})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>one</em> tonight.
      </h2>
      <div style={s.sceneGrid}>
        {sceneCards.map(({ title, desc, bgX }) => {
          const isHov = hovered === title;
          return (
            <div
              key={title}
              style={{
                ...s.sceneCard,
                backgroundImage: 'url(/two.jpeg)',
                backgroundSize: '430% auto',
                backgroundPosition: `${bgX} 38%`,
                transform: isHov ? 'translateY(-8px) scale(1.03)' : 'none',
                boxShadow: isHov ? `0 20px 48px #00000080, 0 0 32px ${GOLD}35` : '0 6px 28px #00000060',
                border: isHov ? `1px solid ${GOLD}70` : '1px solid #5A3010',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHovered(title)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHov && (
                <div style={s.sceneOverlay}>
                  <div style={s.sceneBeginBtn}>Begin →</div>
                </div>
              )}
              <div style={s.sceneContent}>
                <div style={s.sceneTitle}>{title}</div>
                <div style={s.sceneDesc}>{desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 'clamp(20px,3vw,36px)', fontWeight: 800, color: '#F5EDD8', fontStyle: 'italic', margin: '0 0 10px' }}>Chosen, not by chance.</p>
      <p style={{ color: '#9B7A58', fontSize: 15, margin: 0 }}>Some moments find you.</p>
    </section>
  );
}

export default function MarketingPage({ onSignIn, onGetStarted }: Props) {
  return (
    <div style={s.root}>

      {/* ── Ambient glow background ─────────────────────────────────── */}
      <div style={s.glowTopLeft} />
      <div style={s.glowTopRight} />

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav style={s.nav}>
        <span style={s.navLogo}>RoleScene</span>
        <button style={s.navSignIn} onClick={onSignIn}>Sign In</button>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={s.hero}>
        <div style={s.heroBadge}>✦ A private experience made for two hearts</div>
        <h1 style={s.h1}>
          Two perspectives.<br />
          <span style={s.goldText}>One shared spark.</span>
        </h1>
        <p style={s.heroSub}>
          Each partner hears their own side of the story —
          perfectly synchronized, deeply immersive.
        </p>
        <div style={s.heroActions}>
          <button style={{ ...s.btn, ...s.btnGold }} onClick={onGetStarted}>
            Begin Your Story
          </button>
          <button style={{ ...s.btn, ...s.btnGhost }} onClick={onSignIn}>
            Sign In
          </button>
        </div>
      </section>

      {/* ── Feature screens (one.jpeg) ─────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionLabel}>EXPERIENCE</div>
        <div style={s.featureImgWrap}>
          <img src="/one.jpeg" alt="RoleScene feature screens" style={s.featureImg} />
          <div style={s.featureImgFade} />
        </div>
      </section>

      {/* ── Scene cards (two.jpeg cropped) ─────────────────────────── */}
      <SceneCardsSection />

      {/* ── Trust bar ──────────────────────────────────────────────── */}
      <section style={s.trustBar}>
        {['End-to-end encrypted', 'No ads. Ever.', 'Private by design'].map(t => (
          <div key={t} style={s.trustItem}>
            <span style={s.trustDot}>●</span>
            <span>{t}</span>
          </div>
        ))}
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section style={s.ctaSection}>
        <h2 style={s.ctaTitle}>Your partner is waiting.</h2>
        <p style={s.ctaSub}>Start your first session tonight.</p>
        <button style={{ ...s.btn, ...s.btnGold, ...s.btnLarge }} onClick={onGetStarted}>
          Create Free Account
        </button>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={s.footer}>
        <span style={s.footerLogo}>RoleScene</span>
        <span style={s.footerSub}>Private · Encrypted · Immersive</span>
      </footer>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const GOLD   = '#C8860A';
const GOLD2  = '#D4A017';
const AMBER  = '#E8B84B';

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#080401',
    color: '#F0E4CC',
    overflowX: 'hidden',
    position: 'relative',
    fontFamily: 'inherit',
  },

  // Ambient background glows
  glowTopLeft: {
    position: 'fixed', top: -100, left: -100,
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(ellipse, #8B400820 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  glowTopRight: {
    position: 'fixed', top: -60, right: -80,
    width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(ellipse, #6B300610 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },

  // Navbar
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 40px', position: 'sticky', top: 0, zIndex: 10,
    backgroundColor: '#080401CC', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #3A1F0820',
  },
  navLogo: { fontSize: 20, fontWeight: 800, letterSpacing: 1, color: AMBER },
  navSignIn: {
    backgroundColor: 'transparent', border: `1px solid #5A3010`,
    borderRadius: 10, color: '#C4A070', fontSize: 13, fontWeight: 600,
    padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit',
  },

  // Hero
  hero: {
    textAlign: 'center', padding: '100px 24px 80px',
    maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 1,
  },
  heroBadge: {
    display: 'inline-block',
    backgroundColor: '#8B400815',
    border: `1px solid #8B400840`,
    borderRadius: 20,
    color: GOLD2, fontSize: 12, fontWeight: 600,
    padding: '6px 18px', marginBottom: 36, letterSpacing: 0.5,
  },
  h1: {
    fontSize: 'clamp(34px, 6vw, 68px)', fontWeight: 800,
    lineHeight: 1.15, marginBottom: 24, letterSpacing: -0.5,
    color: '#F5EDD8',
  },
  goldText: {
    background: `linear-gradient(135deg, ${AMBER}, ${GOLD})`,
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    color: '#9B7A55', fontSize: 18, lineHeight: 1.7,
    maxWidth: 500, margin: '0 auto 44px',
  },
  heroActions: {
    display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
  },

  // Section wrapper
  section: { padding: '70px 24px', maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 },
  sectionLabel: {
    color: '#6B4A28', fontSize: 10, fontWeight: 700, letterSpacing: 4,
    textTransform: 'uppercase', marginBottom: 32, textAlign: 'center',
  },

  // Feature image showcase
  featureImgWrap: { position: 'relative', borderRadius: 24, overflow: 'hidden', border: '1px solid #5A3010', boxShadow: '0 12px 48px #00000070' },
  featureImg:     { width: '100%', display: 'block' },
  featureImgFade: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 75%, #080401 100%)', pointerEvents: 'none' },

  // Scene cards
  sceneGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16, marginBottom: 48,
  },
  sceneCard: {
    borderRadius: 20, overflow: 'hidden',
    position: 'relative', minHeight: 280,
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  },
  sceneOverlay:  { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000045', zIndex: 2 },
  sceneBeginBtn: { backgroundColor: GOLD, color: '#FFF5E0', fontSize: 14, fontWeight: 700, padding: '11px 28px', borderRadius: 12, boxShadow: `0 4px 16px ${GOLD}60` },
  sceneContent:  { position: 'relative', zIndex: 1, padding: '20px 18px', background: 'linear-gradient(to top, #06020199 70%, transparent)' },
  sceneTitle:    { color: '#F5EDD8', fontWeight: 700, fontSize: 15, marginBottom: 6 },
  sceneDesc:     { color: '#B08060', fontSize: 13, fontStyle: 'italic', lineHeight: 1.4 },

  // Trust bar
  trustBar: {
    display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 32,
    padding: '36px 24px',
    borderTop: `1px solid #3A1F0830`, borderBottom: `1px solid #3A1F0830`,
    position: 'relative', zIndex: 1,
  },
  trustItem: { display: 'flex', alignItems: 'center', gap: 8, color: '#6B4A28', fontSize: 13 },
  trustDot:  { color: GOLD2, fontSize: 8 },

  // CTA
  ctaSection: {
    textAlign: 'center', padding: '90px 24px',
    position: 'relative', zIndex: 1,
  },
  ctaTitle: {
    fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 800,
    color: '#F5EDD8', marginBottom: 14,
  },
  ctaSub: { color: '#7A5535', fontSize: 16, marginBottom: 36 },

  // Footer
  footer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '40px 24px', borderTop: `1px solid #3A1F0820`,
    position: 'relative', zIndex: 1,
  },
  footerLogo: { fontSize: 18, fontWeight: 800, color: AMBER, letterSpacing: 1 },
  footerSub:  { color: '#4A2E10', fontSize: 12 },

  // Buttons
  btn: {
    borderRadius: 14, padding: '14px 32px', border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 15,
    fontFamily: 'inherit',
  },
  btnGold: {
    background: `linear-gradient(135deg, ${GOLD2}, #8B4A05)`,
    color: '#FFF5E0',
    boxShadow: `0 4px 20px ${GOLD}40`,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    border: `1px solid #4A2810`,
    color: '#9B7A55',
  },
  btnLarge: { padding: '16px 44px', fontSize: 16, borderRadius: 16 },
};
