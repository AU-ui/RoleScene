import React, { useCallback, useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';
import { useSync } from '../hooks/useSync';
import { useTTS } from '../hooks/useTTS';
import { SCRIPT } from '../script';

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export default function GuestScreen({ onLeave }: { onLeave: () => void }) {
  const {
    roomCode, partnerConnected,
    playbackState, setPlaybackState,
    syncStatus, setCurrentPosition,
    mySliderValue, setMySliderValue,
    partnerSliderValue,
    currentSegment, setCurrentSegment,
  } = useSessionStore();

  // Refs so useSync callbacks always call the latest tts functions (never stale)
  const ttsPlayRef  = useRef<(pos: number) => void>(() => {});
  const ttsPauseRef = useRef<() => void>(() => {});
  const ttsSeekRef  = useRef<(pos: number) => void>(() => {});

  const token = useAuthStore((s) => s.token) ?? '';

  const { sendSlider, registerGetPosition } = useSync({
    roomCode,
    role: 'guest',
    token,
    onPlay:        (pos) => { ttsPlayRef.current(pos);  setPlaybackState('playing'); setCurrentPosition(pos); },
    onPause:       (pos) => { ttsPauseRef.current();    setPlaybackState('paused');  setCurrentPosition(pos); },
    onSeek:        (pos) => { ttsSeekRef.current(pos);  setCurrentPosition(pos); },
    onHeartbeat:   (pos) => { setCurrentPosition(pos); },
    onNextSegment: useCallback((segment: number) => {
      ttsPauseRef.current(); setCurrentSegment(segment); setPlaybackState('paused'); setCurrentPosition(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  });

  const tts = useTTS(currentSegment, 'guest');

  // Keep refs in sync with latest tts functions every render
  ttsPlayRef.current  = tts.play;
  ttsPauseRef.current = tts.pause;
  ttsSeekRef.current  = tts.seek;

  useEffect(() => { registerGetPosition(tts.getPosition); }, [registerGetPosition, tts.getPosition]);
  useEffect(() => { setCurrentPosition(tts.currentPosition); }, [tts.currentPosition, setCurrentPosition]);

  const handleSlider = useCallback((value: number) => {
    setMySliderValue(value); sendSlider(value);
  }, [setMySliderValue, sendSlider]);

  const pos          = tts.currentPosition;
  const combinedScore = Math.round((mySliderValue + partnerSliderValue) / 2);
  const isConnected  = syncStatus !== 'disconnected' && syncStatus !== 'connecting';

  // ── Waiting screen ────────────────────────────────────────────────────────
  if (!partnerConnected) {
    return (
      <div style={s.root}>
        <div style={s.scroll}>
          <div style={s.header}>
            <span style={s.appName}>RoleScene</span>
            <button style={s.leaveBtn} onClick={onLeave}>Leave</button>
          </div>
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
            <div style={{ color: '#F5EDD8', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Waiting for host…
            </div>
            <div style={{ color: '#7A5535', fontSize: 13, marginBottom: 28 }}>
              Share the room code with your partner
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {roomCode.split('').map((d, i) => (
                <div key={i} style={s.digitBox}><span style={s.digit}>{d}</span></div>
              ))}
            </div>
          </div>
          <img src="/two.jpeg" alt="" style={{
            width: '100%', borderRadius: 18, objectFit: 'cover', maxHeight: 200,
            opacity: 0.7, marginTop: 8,
          }} />
        </div>
      </div>
    );
  }

  // ── Active session ─────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <div style={s.scroll}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.appName}>RoleScene</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: isConnected ? '#00C896' : '#FFA500',
            }} />
            <button style={s.leaveBtn} onClick={onLeave}>Leave</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#7A5535', fontSize: 12 }}>
              Line {currentSegment + 1} of {SCRIPT.length}
            </span>
            <span style={{ color: '#7A5535', fontSize: 12 }}>{fmt(pos)}</span>
          </div>
          <div style={{ height: 4, backgroundColor: '#1E0C04', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              backgroundColor: '#C8860A',
              width: `${((currentSegment) / (SCRIPT.length - 1)) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Current line */}
        {tts.isMyLine ? (
          /* ── Your turn: show your line prominently ── */
          <div style={{ ...card, borderLeft: '3px solid #C87020' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                backgroundColor: '#B8702025', color: '#C87020', border: '1px solid #C87020',
              }}>
                Your line
              </div>
              {playbackState === 'playing' && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#C87020',
                  animation: 'pulse 1s ease-in-out infinite' }} />
              )}
            </div>
            <p style={{ color: '#F5EDD8', fontSize: 17, fontStyle: 'italic', lineHeight: 1.7, margin: 0 }}>
              "{tts.lineText}"
            </p>
          </div>
        ) : (
          /* ── Partner's turn: don't reveal their line ── */
          <div style={{ ...card, borderLeft: '3px solid #3A1A08' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                backgroundColor: '#3A1A0825', color: '#5A3010', border: '1px solid #3A1A08',
              }}>
                Partner's turn
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {playbackState === 'playing'
                ? <><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#7A5535',
                    animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
                   <span style={{ color: '#5A3010', fontSize: 15, fontStyle: 'italic' }}>Partner is speaking…</span></>
                : <span style={{ color: '#4A2810', fontSize: 15, fontStyle: 'italic' }}>Waiting for partner…</span>
              }
            </div>
          </div>
        )}

        {/* Playback status */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={ct}>Playback</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: playbackState === 'playing' ? '#00C896' : '#6B6B8A',
            }}>
              {playbackState === 'playing' ? '● Playing' : playbackState === 'paused' ? '⏸ Paused' : '· Waiting'}
            </span>
          </div>
          <input type="range" min={0} max={tts.duration || 1} step={0.1} value={pos} readOnly
            style={{ width: '100%', accentColor: '#C8860A', cursor: 'default' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={s.timeLabel}>{fmt(pos)}</span>
            <span style={s.timeLabel}>{fmt(tts.duration)}</span>
          </div>
          <div style={{ color: '#4A2810', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            Host controls playback
          </div>
        </div>

        {/* Intensity */}
        <div style={card}>
          <span style={ct}>Intensity</span>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#9B7A58', fontSize: 13 }}>You</span>
              <span style={{ color: '#C87020', fontWeight: 800 }}>{mySliderValue}</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={mySliderValue}
              onChange={(e) => handleSlider(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#C87020' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: '#0D0501', borderRadius: 12, padding: '12px 16px' }}>
            <span style={{ color: '#7A5535', fontSize: 13 }}>Combined</span>
            <span style={{ color: '#F5EDD8', fontSize: 22, fontWeight: 800 }}>
              {combinedScore}<span style={{ color: '#7A5535', fontSize: 14, fontWeight: 400 }}>/10</span>
            </span>
          </div>
        </div>

        <img src="/one.jpeg" alt="" style={{
          width: '100%', borderRadius: 18, objectFit: 'cover', maxHeight: 180,
          opacity: 0.6, marginBottom: 16,
        }} />

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  backgroundColor: '#160C05', borderRadius: 18, padding: 20,
  marginBottom: 16, border: '1px solid #3A1A08',
};
const ct: React.CSSProperties = {
  display: 'block', color: '#7A5535', fontSize: 11, fontWeight: 700,
  letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14,
};
const s: Record<string, React.CSSProperties> = {
  root:     { minHeight: '100vh', backgroundColor: '#080401', display: 'flex', justifyContent: 'center' },
  scroll:   { width: '100%', maxWidth: 480, padding: '20px 20px 40px' },
  header:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  appName:  { fontSize: 26, fontWeight: 800, color: '#E8B84B', letterSpacing: 1 },
  leaveBtn: { backgroundColor: 'transparent', border: '1px solid #4A2810', borderRadius: 8, color: '#7A5535', fontSize: 12, padding: '5px 12px', cursor: 'pointer' },
  digitBox: { width: 44, height: 56, backgroundColor: '#1E0C04', borderRadius: 10, border: '1px solid #D4A017', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  digit:    { color: '#D4A017', fontSize: 24, fontWeight: 800 },
  timeLabel:{ color: '#7A5535', fontSize: 11 },
};
