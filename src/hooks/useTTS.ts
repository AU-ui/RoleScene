/**
 * useTTS — Browser SpeechSynthesis wrapper.
 *
 * host  → speaks Boy  lines (lower pitch), silent during Girl lines
 * guest → speaks Girl lines (higher pitch), silent during Boy lines
 *
 * Returns the same surface as useAudio so screens can swap them in.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SCRIPT } from '../script';

export function useTTS(
  currentSegment: number,
  role: 'host' | 'guest',
  onSegmentEnd?: () => void,
) {
  // Always call latest onSegmentEnd (avoids stale closure in setTimeout)
  const onEndRef = useRef(onSegmentEnd);
  onEndRef.current = onSegmentEnd;

  const line     = SCRIPT[currentSegment];
  const isMyLine = line?.role === role;
  const duration = line?.duration ?? 6;

  const [currentPosition, setCurrentPosition] = useState(0);

  const isPlayingRef    = useRef(false);
  const startTimeRef    = useRef<number | null>(null);
  const posAtStartRef   = useRef(0);
  const tickerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (tickerRef.current)   { clearInterval(tickerRef.current);  tickerRef.current  = null; }
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // ── Public API ───────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    isPlayingRef.current  = false;
    startTimeRef.current  = null;
    clearTimers();
    stopSpeech();
  }, [clearTimers, stopSpeech]);

  const getPosition = useCallback((): number => {
    if (!isPlayingRef.current || startTimeRef.current === null) {
      return posAtStartRef.current;
    }
    const elapsed = (Date.now() - startTimeRef.current) / 1000 + posAtStartRef.current;
    return Math.min(elapsed, duration);
  }, [duration]);

  const play = useCallback((pos: number = 0) => {
    // Reset
    stop();
    stopSpeech();

    isPlayingRef.current  = true;
    posAtStartRef.current = pos;
    startTimeRef.current  = Date.now();
    setCurrentPosition(pos);

    // Speak if it's our line (the partner's phone stays silent)
    if (isMyLine && line && window.speechSynthesis) {
      const utter    = new SpeechSynthesisUtterance(line.text);
      utter.rate     = 0.80;
      utter.pitch    = role === 'host' ? 0.85 : 1.15;
      utter.volume   = 1;

      // Try to pick a matching voice
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const preferred = voices.find(v =>
          role === 'host'
            ? /male|man|guy/i.test(v.name) && !/fe/i.test(v.name)
            : /female|woman|girl/i.test(v.name),
        );
        if (preferred) utter.voice = preferred;
      }

      window.speechSynthesis.speak(utter);
    }

    // Position ticker — updates currentPosition every 200 ms
    tickerRef.current = setInterval(() => {
      if (!isPlayingRef.current || startTimeRef.current === null) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000 + posAtStartRef.current;
      setCurrentPosition(Math.min(elapsed, duration));
    }, 200);

    // Auto-advance after the full duration (host only — onEndRef may be undefined for guest)
    const remaining = Math.max(0, (duration - pos) * 1000);
    endTimerRef.current = setTimeout(() => {
      clearTimers();
      stopSpeech();
      isPlayingRef.current = false;
      setCurrentPosition(duration);
      onEndRef.current?.();
    }, remaining);
  }, [stop, stopSpeech, isMyLine, line, role, duration, clearTimers]);

  const pause = useCallback(() => {
    const pos = getPosition();
    posAtStartRef.current = pos;
    isPlayingRef.current  = false;
    startTimeRef.current  = null;
    clearTimers();
    stopSpeech();
    setCurrentPosition(pos);
  }, [clearTimers, stopSpeech, getPosition]);

  const seek = useCallback((pos: number) => {
    posAtStartRef.current = pos;
    setCurrentPosition(pos);
    if (isPlayingRef.current) {
      // Restart from new position (SpeechSynthesis can't seek mid-sentence)
      stop();
      play(pos);
    }
  }, [stop, play]);

  // ── Cleanup on segment change ─────────────────────────────────────────────

  useEffect(() => {
    stop();
    setCurrentPosition(0);
    posAtStartRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegment]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    play,
    pause,
    seek,
    stop,
    getPosition,
    currentPosition,
    duration,
    isMyLine,
    lineSpeaker: line?.speaker ?? null,
    lineText:    line?.text    ?? '',
  };
}
