import React, { useCallback, useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useSync } from '../hooks/useSync';
import { useTTS } from '../hooks/useTTS';
import { SCRIPT } from '../script';

// ─── Helpers ───────────────────────────────────────────────────────────────

const SYNC_CONFIG = {
  disconnected: { color: '#FF4444', label: 'Disconnected' },
  connecting:   { color: '#FFA500', label: 'Connecting…'  },
  synced:       { color: '#00C896', label: 'Synced'        },
  drifting:     { color: '#FFD700', label: 'Drifting'      },
} as const;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

const PulsingDot = ({ color }: { color: string }) => (
  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color,
    animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
);

const SliderRow = ({ label, value, onChange, disabled = false, accent }: {
  label: string; value: number; onChange?: (v: number) => void;
  disabled?: boolean; accent: string;
}) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ color: '#AAA', fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ color: accent, fontSize: 14, fontWeight: 800 }}>{value}</span>
    </div>
    <input type="range" min={1} max={10} step={1} value={value}
      onChange={onChange ? (e) => onChange(Number(e.target.value)) : undefined}
      disabled={disabled}
      style={{ width: '100%', accentColor: accent, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    />
  </div>
);

// ─── Host Screen ───────────────────────────────────────────────────────────

export default function HostScreen({ onLeave }: { onLeave: () => void }) {
  const {
    roomCode, partnerConnected,
    playbackState, setPlaybackState,
    syncStatus, setCurrentPosition,
    mySliderValue, setMySliderValue,
    partnerSliderValue,
    currentSegment, setCurrentSegment,
  } = useSessionStore();

  // ── Refs to break circular hook dependency ────────────────────────────
  // useSync callbacks need tts.* but useTTS needs sendNextSegment.
  // We proxy tts calls through refs so useSync can be called first.
  const ttsPlayRef        = useRef<(pos: number) => void>(() => {});
  const ttsPauseRef       = useRef<() => void>(() => {});
  const ttsSeekRef        = useRef<(pos: number) => void>(() => {});
  const ttsGetPositionRef = useRef<() => number>(() => 0);

  // ── 1. Sync engine (needs stable callbacks → uses refs above) ─────────
  const { sendPlay, sendPause, sendSeek, sendSlider, sendNextSegment, registerGetPosition } =
    useSync({
      roomCode,
      role: 'host',
      onPlay:        (pos) => { ttsPlayRef.current(pos);  setPlaybackState('playing'); },
      onPause:       (pos) => { ttsPauseRef.current();    setCurrentPosition(pos);     },
      onSeek:        (pos) => { ttsSeekRef.current(pos);  setCurrentPosition(pos);     },
      onHeartbeat:   ()    => { /* host is time authority — no correction needed */ },
      onNextSegment: (seg) => { ttsPauseRef.current(); setCurrentSegment(seg); setCurrentPosition(0); },
    });

  // ── 2. Segment-end handler (needs sendNextSegment, defined after useSync) ──
  const handleSegmentEnd = useCallback(() => {
    const next = currentSegment + 1;
    if (next < SCRIPT.length) {
      setCurrentSegment(next);
      setPlaybackState('paused');
      setCurrentPosition(0);
      sendNextSegment(next);
    }
  }, [currentSegment, sendNextSegment, setCurrentSegment, setPlaybackState, setCurrentPosition]);

  // ── 3. TTS hook (can now receive handleSegmentEnd) ─────────────────────
  const tts = useTTS(currentSegment, 'host', handleSegmentEnd);

  // ── 4. Update proxy refs so useSync callbacks always call latest tts ──
  ttsPlayRef.current        = tts.play;
  ttsPauseRef.current       = tts.pause;
  ttsSeekRef.current        = tts.seek;
  ttsGetPositionRef.current = tts.getPosition;

  useEffect(() => {
    registerGetPosition(tts.getPosition);
  }, [registerGetPosition, tts.getPosition]);

  useEffect(() => {
    setCurrentPosition(tts.currentPosition);
  }, [tts.currentPosition, setCurrentPosition]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    if (!partnerConnected) return;
    const pos = tts.getPosition();
    if (playbackState === 'playing') {
      tts.pause(); sendPause(pos); setPlaybackState('paused');
    } else {
      tts.play(pos); sendPlay(pos); setPlaybackState('playing');
    }
  }, [playbackState, partnerConnected, tts, sendPlay, sendPause, setPlaybackState]);

  const handleSlider = useCallback((value: number) => {
    setMySliderValue(value); sendSlider(value);
  }, [setMySliderValue, sendSlider]);

  const handleJumpTo = useCallback((i: number) => {
    if (i === currentSegment) return;
    tts.pause();
    setCurrentSegment(i);
    setPlaybackState('paused');
    setCurrentPosition(0);
    sendNextSegment(i);
  }, [currentSegment, tts, setCurrentSegment, setPlaybackState, setCurrentPosition, sendNextSegment]);

  // ── Derived ────────────────────────────────────────────────────────────

  const syncCfg       = SYNC_CONFIG[syncStatus];
  const combinedScore = Math.round((mySliderValue + partnerSliderValue) / 2);
  const pos           = tts.currentPosition;

  // ──────────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>
      <div style={s.scroll}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.appName}>RoleScene</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ ...s.badge, backgroundColor: '#A855F7' }}>HOST</div>
            <button style={s.leaveBtn} onClick={onLeave}>Leave</button>
          </div>
        </div>

        {/* Room Code */}
        <div style={card}>
          <span style={ct}>Room Code</span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            {roomCode.split('').map((d, i) => (
              <div key={i} style={s.digitBox}><span style={s.digit}>{d}</span></div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              backgroundColor: partnerConnected ? '#00C896' : '#FF4444' }} />
            <span style={{ color: '#6B6B8A', fontSize: 12 }}>
              {partnerConnected ? 'Partner connected' : 'Waiting for partner to join…'}
            </span>
          </div>
        </div>

        {/* Sync Status */}
        <div style={card}>
          <span style={ct}>Sync Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <PulsingDot color={syncCfg.color} />
            <span style={{ color: syncCfg.color, fontWeight: 700, fontSize: 16, flex: 1 }}>{syncCfg.label}</span>
          </div>
          <div style={s.statsRow}>
            {[
              { k: 'Line',     v: `${currentSegment + 1} / ${SCRIPT.length}` },
              { k: 'Position', v: fmt(pos) },
              { k: 'Role',     v: 'Host (Boy)' },
            ].map(({ k, v }, i, a) => (
              <React.Fragment key={k}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={s.statKey}>{k}</span>
                  <span style={s.statVal}>{v}</span>
                </div>
                {i < a.length - 1 && <div style={s.divider} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Current Line */}
        <div style={card}>
          <span style={ct}>Now Playing</span>

          {/* Speaker badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1,
              backgroundColor: tts.isMyLine ? '#A855F720' : '#EC489920',
              color:            tts.isMyLine ? '#A855F7'   : '#EC4899',
              border: `1px solid ${tts.isMyLine ? '#A855F7' : '#EC4899'}`,
            }}>
              {tts.lineSpeaker ?? '—'}
              {tts.isMyLine ? ' · Your line' : ' · Partner\'s line'}
            </div>
          </div>

          {/* Line text */}
          <div style={{
            backgroundColor: '#0B0B14', borderRadius: 12, padding: '16px 18px',
            marginBottom: 14, borderLeft: `3px solid ${tts.isMyLine ? '#A855F7' : '#EC4899'}`,
          }}>
            <span style={{ color: tts.isMyLine ? '#FFF' : '#9A9AB0', fontSize: 15, lineHeight: 1.6, fontStyle: 'italic' }}>
              "{tts.lineText}"
            </span>
          </div>

          {/* Line progress dots */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {SCRIPT.map((ln, i) => (
              <button key={i} onClick={() => handleJumpTo(i)} title={`Line ${i + 1}: ${ln.speaker}`}
                style={{
                  width: 28, height: 28, borderRadius: 8, fontSize: 10, fontWeight: 700,
                  border: `1px solid ${i === currentSegment
                    ? (ln.role === 'host' ? '#A855F7' : '#EC4899')
                    : '#2A2A3A'}`,
                  backgroundColor: i === currentSegment
                    ? (ln.role === 'host' ? '#A855F720' : '#EC489920')
                    : i < currentSegment ? '#1A1A2E' : 'transparent',
                  color: i === currentSegment
                    ? (ln.role === 'host' ? '#A855F7' : '#EC4899')
                    : i < currentSegment ? '#4A4A6A' : '#2A2A4A',
                  cursor: i === currentSegment ? 'default' : 'pointer',
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Playback Controls */}
        <div style={card}>
          <span style={ct}>Playback</span>

          {/* Progress bar (read-only visual) */}
          <div style={{ marginBottom: 14 }}>
            <input type="range" min={0} max={tts.duration} step={0.1} value={pos}
              readOnly
              style={{ width: '100%', accentColor: '#A855F7', cursor: 'default' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={s.timeLabel}>{fmt(pos)}</span>
              <span style={s.timeLabel}>{fmt(tts.duration)}</span>
            </div>
          </div>

          {/* Play / Pause */}
          <button onClick={handlePlayPause} disabled={!partnerConnected} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            backgroundColor: playbackState === 'playing' ? '#1A2E1A' : '#1A1A2E',
            borderRadius: 16, padding: '16px 0', width: '100%', marginBottom: 10,
            border: `1px solid ${playbackState === 'playing' ? '#00C896' : '#2A2A3A'}`,
            cursor: !partnerConnected ? 'not-allowed' : 'pointer',
            opacity: !partnerConnected ? 0.4 : 1,
          }}>
            <span style={{ fontSize: 22 }}>{playbackState === 'playing' ? '⏸' : '▶'}</span>
            <span style={{ color: '#FFF', fontSize: 16, fontWeight: 700 }}>
              {playbackState === 'playing' ? 'Pause' : 'Play'}
            </span>
          </button>

          {/* Next line */}
          <button
            onClick={() => handleJumpTo(currentSegment + 1)}
            disabled={!partnerConnected || currentSegment >= SCRIPT.length - 1}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: 'transparent', borderRadius: 12, padding: '10px 0', width: '100%',
              border: '1px solid #2A2A3A', cursor: 'pointer',
              opacity: (!partnerConnected || currentSegment >= SCRIPT.length - 1) ? 0.35 : 1,
            }}>
            <span style={{ color: '#6B6B8A', fontSize: 13, fontWeight: 600 }}>Skip to Next Line ›</span>
          </button>

          {!partnerConnected && (
            <div style={{ color: '#6B6B8A', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              Waiting for partner before playback can begin
            </div>
          )}
        </div>

        {/* Intensity Sliders */}
        <div style={card}>
          <span style={ct}>Intensity Slider</span>
          <SliderRow label="You" value={mySliderValue} onChange={handleSlider} accent="#A855F7" />
          <SliderRow label="Partner" value={partnerSliderValue} disabled accent="#EC4899" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: '#0B0B14', borderRadius: 12, padding: 14 }}>
            <span style={{ color: '#6B6B8A', fontSize: 13, fontWeight: 600 }}>Combined Score</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ color: '#FFF', fontSize: 24, fontWeight: 800 }}>{combinedScore}</span>
              <span style={{ color: '#6B6B8A', fontSize: 14 }}>/10</span>
            </div>
          </div>
        </div>

        {/* Debug */}
        <div style={{ ...card, borderColor: '#2A1A3A', backgroundColor: '#0E0B14' }}>
          <span style={{ ...ct, color: '#A855F733' }}>Debug Panel</span>
          {([
            ['room_code',      roomCode],
            ['playback_state', playbackState],
            ['sync_status',    syncStatus],
            ['position',       pos.toFixed(2) + 's'],
            ['segment',        `${currentSegment} / ${SCRIPT.length - 1}`],
            ['my_line',        tts.isMyLine ? 'yes (speaking)' : 'no (silent)'],
            ['my_slider',      String(mySliderValue)],
            ['partner_slider', String(partnerSliderValue)],
            ['partner_conn',   String(partnerConnected)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ color: '#6B5A7A', fontSize: 11, fontFamily: 'monospace', marginBottom: 3 }}>
              {k.padEnd(16)}: {v}
            </div>
          ))}
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: '#13131F', borderRadius: 18, padding: 20,
  marginBottom: 16, border: '1px solid #1E1E30',
};
const ct: React.CSSProperties = {
  display: 'block', color: '#6B6B8A', fontSize: 11, fontWeight: 700,
  letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14,
};
const s: Record<string, React.CSSProperties> = {
  root:     { minHeight: '100vh', backgroundColor: '#0B0B14', display: 'flex', justifyContent: 'center' },
  scroll:   { width: '100%', maxWidth: 480, padding: '20px 20px 40px' },
  header:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  appName:  { fontSize: 26, fontWeight: 800, color: '#FFF', letterSpacing: 1 },
  badge:    { padding: '5px 14px', borderRadius: 20, color: '#FFF', fontWeight: 700, fontSize: 12, letterSpacing: 2 },
  leaveBtn: { backgroundColor: 'transparent', border: '1px solid #2A2A3A', borderRadius: 8, color: '#6B6B8A', fontSize: 12, padding: '5px 12px', cursor: 'pointer' },
  digitBox: { width: 44, height: 56, backgroundColor: '#1A1A2E', borderRadius: 10, border: '1px solid #A855F7', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  digit:    { color: '#A855F7', fontSize: 24, fontWeight: 800 },
  statsRow: { display: 'flex', backgroundColor: '#0B0B14', borderRadius: 12, padding: 14 },
  statKey:  { color: '#6B6B8A', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  statVal:  { color: '#FFF', fontSize: 16, fontWeight: 700 },
  divider:  { width: 1, backgroundColor: '#1E1E30', margin: '4px 0' },
  timeLabel:{ color: '#6B6B8A', fontSize: 11 },
};
