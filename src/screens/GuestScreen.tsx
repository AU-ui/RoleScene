import React, { useCallback, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useSync } from '../hooks/useSync';
import { useTTS } from '../hooks/useTTS';
import { SCRIPT } from '../script';

const SYNC_CONFIG = {
  disconnected: { color: '#FF4444', label: 'Disconnected' },
  connecting:   { color: '#FFA500', label: 'Connecting…'  },
  synced:       { color: '#00C896', label: 'Synced'        },
  drifting:     { color: '#FFD700', label: 'Correcting drift…' },
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

export default function GuestScreen({ onLeave }: { onLeave: () => void }) {
  const {
    roomCode, partnerConnected,
    playbackState, setPlaybackState,
    syncStatus, setCurrentPosition,
    mySliderValue, setMySliderValue,
    partnerSliderValue,
    currentSegment, setCurrentSegment,
  } = useSessionStore();

  // Guest never auto-advances (host drives timing) — no onSegmentEnd
  const tts = useTTS(currentSegment, 'guest');

  const { sendSlider, registerGetPosition } = useSync({
    roomCode,
    role: 'guest',
    onPlay: useCallback((pos: number) => {
      tts.play(pos); setPlaybackState('playing'); setCurrentPosition(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
    onPause: useCallback((pos: number) => {
      tts.pause(); setPlaybackState('paused'); setCurrentPosition(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
    onSeek: useCallback((pos: number) => {
      tts.seek(pos); setCurrentPosition(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
    onHeartbeat: useCallback((corrected: number) => {
      // Drift correction — just update position (TTS timing is host-driven)
      setCurrentPosition(corrected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
    onNextSegment: useCallback((segment: number) => {
      tts.pause(); setCurrentSegment(segment); setPlaybackState('paused'); setCurrentPosition(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  });

  useEffect(() => { registerGetPosition(tts.getPosition); }, [registerGetPosition, tts.getPosition]);
  useEffect(() => { setCurrentPosition(tts.currentPosition); }, [tts.currentPosition, setCurrentPosition]);

  const handleSlider = useCallback((value: number) => {
    setMySliderValue(value); sendSlider(value);
  }, [setMySliderValue, sendSlider]);

  const syncCfg       = SYNC_CONFIG[syncStatus];
  const combinedScore = Math.round((mySliderValue + partnerSliderValue) / 2);
  const pos           = tts.currentPosition;

  return (
    <div style={s.root}>
      <div style={s.scroll}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.appName}>RoleScene</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ ...s.badge, backgroundColor: '#EC4899' }}>GUEST</div>
            <button style={s.leaveBtn} onClick={onLeave}>Leave</button>
          </div>
        </div>

        {/* Session Info */}
        <div style={card}>
          <span style={ct}>Session</span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            {roomCode.split('').map((d, i) => (
              <div key={i} style={s.digitBox}><span style={s.digit}>{d}</span></div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              backgroundColor: partnerConnected ? '#00C896' : '#FFA500' }} />
            <span style={{ color: '#6B6B8A', fontSize: 12 }}>
              {partnerConnected ? 'Host connected' : 'Waiting for host…'}
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
              { k: 'Role',     v: 'Guest (Girl)' },
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
              backgroundColor: tts.isMyLine ? '#EC489920' : '#A855F720',
              color:            tts.isMyLine ? '#EC4899'   : '#A855F7',
              border: `1px solid ${tts.isMyLine ? '#EC4899' : '#A855F7'}`,
            }}>
              {tts.lineSpeaker ?? '—'}
              {tts.isMyLine ? ' · Your line' : ' · Partner\'s line'}
            </div>
          </div>

          {/* Line text */}
          <div style={{
            backgroundColor: '#0B0B14', borderRadius: 12, padding: '16px 18px',
            marginBottom: 14, borderLeft: `3px solid ${tts.isMyLine ? '#EC4899' : '#A855F7'}`,
          }}>
            <span style={{ color: tts.isMyLine ? '#FFF' : '#9A9AB0', fontSize: 15, lineHeight: 1.6, fontStyle: 'italic' }}>
              "{tts.lineText}"
            </span>
          </div>

          {/* Line progress dots (read-only for guest) */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {SCRIPT.map((ln, i) => (
              <div key={i} title={`Line ${i + 1}: ${ln.speaker}`}
                style={{
                  width: 28, height: 28, borderRadius: 8, fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${i === currentSegment
                    ? (ln.role === 'guest' ? '#EC4899' : '#A855F7')
                    : '#2A2A3A'}`,
                  backgroundColor: i === currentSegment
                    ? (ln.role === 'guest' ? '#EC489920' : '#A855F720')
                    : i < currentSegment ? '#1A1A2E' : 'transparent',
                  color: i === currentSegment
                    ? (ln.role === 'guest' ? '#EC4899' : '#A855F7')
                    : i < currentSegment ? '#4A4A6A' : '#2A2A4A',
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Playback (read-only — controlled by host) */}
        <div style={card}>
          <span style={ct}>Playback</span>
          <div style={{ marginBottom: 14 }}>
            <input type="range" min={0} max={tts.duration} step={0.1} value={pos} readOnly
              style={{ width: '100%', accentColor: '#EC4899', cursor: 'default' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={s.timeLabel}>{fmt(pos)}</span>
              <span style={s.timeLabel}>{fmt(tts.duration)}</span>
            </div>
          </div>
          <div style={{ backgroundColor: '#1A1A2E', borderRadius: 16, padding: '16px 0', textAlign: 'center',
            border: `1px solid ${playbackState === 'playing' ? '#00C896' : '#2A2A3A'}`, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>{playbackState === 'playing' ? '⏸' : '▶'}</span>
            <span style={{ color: '#6B6B8A', fontSize: 12, display: 'block', marginTop: 4 }}>
              Host controls playback
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              backgroundColor: playbackState === 'playing' ? '#00C896' : '#6B6B8A' }} />
            <span style={{ color: '#6B6B8A', fontSize: 12 }}>
              {playbackState === 'idle'    ? 'Waiting for host to start'    :
               playbackState === 'playing' ? 'Playing — synced with host'   :
               'Paused by host'}
            </span>
          </div>
        </div>

        {/* Intensity Sliders */}
        <div style={card}>
          <span style={ct}>Intensity Slider</span>
          <SliderRow label="You" value={mySliderValue} onChange={handleSlider} accent="#EC4899" />
          <SliderRow label="Partner (Host)" value={partnerSliderValue} disabled accent="#A855F7" />
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
  digitBox: { width: 44, height: 56, backgroundColor: '#1A1A2E', borderRadius: 10, border: '1px solid #EC4899', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  digit:    { color: '#EC4899', fontSize: 24, fontWeight: 800 },
  statsRow: { display: 'flex', backgroundColor: '#0B0B14', borderRadius: 12, padding: 14 },
  statKey:  { color: '#6B6B8A', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  statVal:  { color: '#FFF', fontSize: 16, fontWeight: 700 },
  divider:  { width: 1, backgroundColor: '#1E1E30', margin: '4px 0' },
  timeLabel:{ color: '#6B6B8A', fontSize: 11 },
};
