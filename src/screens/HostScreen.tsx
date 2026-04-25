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

export default function HostScreen({ onLeave }: { onLeave: () => void }) {
  const {
    roomCode, partnerConnected,
    playbackState, setPlaybackState,
    setCurrentPosition,
    mySliderValue, setMySliderValue,
    partnerSliderValue,
    currentSegment, setCurrentSegment,
  } = useSessionStore();

  const token = useAuthStore((s) => s.token) ?? '';

  // Refs to break circular hook dependency
  const ttsPlayRef        = useRef<(pos: number) => void>(() => {});
  const ttsPauseRef       = useRef<() => void>(() => {});
  const ttsSeekRef        = useRef<(pos: number) => void>(() => {});
  const ttsGetPositionRef = useRef<() => number>(() => 0);

  const { sendPlay, sendPause, sendSlider, sendNextSegment, registerGetPosition } =
    useSync({
      roomCode,
      role: 'host',
      token,
      onPlay:        (pos) => { ttsPlayRef.current(pos);  setPlaybackState('playing'); },
      onPause:       (pos) => { ttsPauseRef.current();    setCurrentPosition(pos);     },
      onSeek:        (pos) => { ttsSeekRef.current(pos);  setCurrentPosition(pos);     },
      onHeartbeat:   ()    => {},
      onNextSegment: (seg) => { ttsPauseRef.current(); setCurrentSegment(seg); setCurrentPosition(0); },
    });

  const handleSegmentEnd = useCallback(() => {
    const next = currentSegment + 1;
    if (next < SCRIPT.length) {
      setCurrentSegment(next);
      setPlaybackState('paused');
      setCurrentPosition(0);
      sendNextSegment(next);
    }
  }, [currentSegment, sendNextSegment, setCurrentSegment, setPlaybackState, setCurrentPosition]);

  const tts = useTTS(currentSegment, 'host', handleSegmentEnd);

  ttsPlayRef.current        = tts.play;
  ttsPauseRef.current       = tts.pause;
  ttsSeekRef.current        = tts.seek;
  ttsGetPositionRef.current = tts.getPosition;

  useEffect(() => { registerGetPosition(tts.getPosition); }, [registerGetPosition, tts.getPosition]);
  useEffect(() => { setCurrentPosition(tts.currentPosition); }, [tts.currentPosition, setCurrentPosition]);

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

  const handleNext = useCallback(() => {
    if (currentSegment >= SCRIPT.length - 1) return;
    const next = currentSegment + 1;
    tts.pause();
    setCurrentSegment(next);
    setPlaybackState('paused');
    setCurrentPosition(0);
    sendNextSegment(next);
  }, [currentSegment, tts, setCurrentSegment, setPlaybackState, setCurrentPosition, sendNextSegment]);

  const pos           = tts.currentPosition;
  const combinedScore = Math.round((mySliderValue + partnerSliderValue) / 2);
  const isLast        = currentSegment >= SCRIPT.length - 1;

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
              Waiting for your partner…
            </div>
            <div style={{ color: '#7A5535', fontSize: 13, marginBottom: 28 }}>
              Share this room code so they can join
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {roomCode.split('').map((d, i) => (
                <div key={i} style={s.digitBox}><span style={s.digit}>{d}</span></div>
              ))}
            </div>
            <button style={s.copyBtn} onClick={() => {
              navigator.clipboard.writeText(roomCode).catch(() => {});
            }}>
              Copy Code
            </button>
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
          <div>
            <span style={s.appName}>RoleScene</span>
            <span style={s.hostBadge}>HOST</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00C896' }} />
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
              height: '100%', borderRadius: 4, backgroundColor: '#C8860A',
              width: `${(currentSegment / (SCRIPT.length - 1)) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Current line */}
        <div style={{ ...card, borderLeft: `3px solid ${tts.isMyLine ? '#D4A017' : '#5A3010'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              backgroundColor: tts.isMyLine ? '#C8860A25' : '#3A1A0825',
              color:            tts.isMyLine ? '#D4A017'   : '#7A5535',
              border: `1px solid ${tts.isMyLine ? '#D4A017' : '#5A3010'}`,
            }}>
              {tts.lineSpeaker ?? '—'} {tts.isMyLine ? '· Your line' : '· Partner\'s line'}
            </div>
          </div>
          <p style={{
            color: tts.isMyLine ? '#F5EDD8' : '#7A5535',
            fontSize: tts.isMyLine ? 17 : 15,
            fontStyle: 'italic', lineHeight: 1.65, margin: 0,
          }}>
            "{tts.lineText}"
          </p>
        </div>

        {/* Playback */}
        <div style={card}>
          <input type="range" min={0} max={tts.duration || 1} step={0.1} value={pos}
            readOnly style={{ width: '100%', accentColor: '#C8860A', cursor: 'default', marginBottom: 4 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: '#7A5535', fontSize: 11 }}>{fmt(pos)}</span>
            <span style={{ color: '#7A5535', fontSize: 11 }}>{fmt(tts.duration)}</span>
          </div>

          {/* Play / Pause */}
          <button onClick={handlePlayPause} style={{
            width: '100%', padding: '18px 0', borderRadius: 16,
            background: playbackState === 'playing'
              ? 'linear-gradient(135deg, #0D2A1A, #0A1A10)'
              : 'linear-gradient(135deg, #D4A017, #8B4A05)',
            border: `1px solid ${playbackState === 'playing' ? '#00C896' : '#C8860A'}`,
            color: '#FFF5E0', fontSize: 18, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>{playbackState === 'playing' ? '⏸' : '▶'}</span>
            {playbackState === 'playing' ? 'Pause' : 'Play'}
          </button>

          {/* Next line */}
          {!isLast && (
            <button onClick={handleNext} style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              backgroundColor: 'transparent', border: '1px solid #4A2810',
              color: '#9B7A58', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Next Line →
            </button>
          )}
          {isLast && playbackState !== 'playing' && (
            <div style={{ textAlign: 'center', color: '#7A5535', fontSize: 13, marginTop: 4 }}>
              End of scene
            </div>
          )}
        </div>

        {/* Intensity */}
        <div style={card}>
          <span style={ct}>Intensity</span>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#9B7A58', fontSize: 13 }}>You</span>
              <span style={{ color: '#D4A017', fontWeight: 800 }}>{mySliderValue}</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={mySliderValue}
              onChange={(e) => handleSlider(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#D4A017' }} />
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
  appName:  { fontSize: 22, fontWeight: 800, color: '#E8B84B', letterSpacing: 1, marginRight: 8 },
  hostBadge:{ backgroundColor: '#C8860A', color: '#FFF5E0', fontSize: 10, fontWeight: 700,
              padding: '3px 10px', borderRadius: 20, letterSpacing: 1.5, verticalAlign: 'middle' },
  leaveBtn: { backgroundColor: 'transparent', border: '1px solid #4A2810', borderRadius: 8,
              color: '#7A5535', fontSize: 12, padding: '5px 12px', cursor: 'pointer' },
  digitBox: { width: 44, height: 56, backgroundColor: '#1E0C04', borderRadius: 10,
              border: '1px solid #D4A017', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  digit:    { color: '#D4A017', fontSize: 24, fontWeight: 800 },
  copyBtn:  { backgroundColor: '#C8860A15', border: '1px solid #C8860A40', borderRadius: 12,
              color: '#D4A017', fontSize: 14, fontWeight: 700, padding: '12px 32px',
              cursor: 'pointer', fontFamily: 'inherit' },
};
