/**
 * useAudio — segmented audio engine for the web.
 *
 * Accepts an array of TrackDef objects.  Plays whichever track corresponds to
 * `segmentIndex`.  When a real URL is present it uses HTMLAudioElement;
 * otherwise a timer simulates position so the UI stays fully functional
 * without actual audio files.
 *
 * Seamless segment transition: on track `ended`, calls onSegmentEnd() so the
 * caller (HostScreen) can decide whether to auto-advance.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { TrackDef } from '../tracks';

interface UseAudioReturn {
  currentPosition: number; // seconds
  duration: number;
  isPlaying: boolean;
  play:  (fromPosition?: number) => void;
  pause: () => void;
  seek:  (position: number) => void;
  getPosition: () => number; // always returns latest position (for closures)
}

export function useAudio(
  tracks: TrackDef[],
  segmentIndex: number,
  onSegmentEnd?: () => void,
): UseAudioReturn {
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef       = useRef(0);
  const isPlayingRef = useRef(false);
  const onEndRef     = useRef(onSegmentEnd);

  // Keep onEnd ref fresh without re-connecting effects
  useEffect(() => { onEndRef.current = onSegmentEnd; }, [onSegmentEnd]);

  const [position,  setPosition]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((fromPos?: number) => {
    stopTimer();
    if (fromPos !== undefined) posRef.current = fromPos;
    timerRef.current = setInterval(() => {
      posRef.current += 0.1;
      setPosition(posRef.current);
    }, 100);
  }, [stopTimer]);

  // ── Load track when segment changes ───────────────────────────────────────

  useEffect(() => {
    // Tear down previous audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    stopTimer();

    // Reset state for new segment
    posRef.current = 0;
    isPlayingRef.current = false;
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);

    const track = tracks[segmentIndex];
    if (!track?.url) return; // no URL → use simulated timer when play() is called

    const audio = new Audio(track.url);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => {
      posRef.current = audio.currentTime;
      setPosition(audio.currentTime);
    });
    audio.addEventListener('ended', () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      onEndRef.current?.();
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentIndex, tracks]);

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const play = useCallback((fromPosition?: number) => {
    if (fromPosition !== undefined) {
      posRef.current = fromPosition;
      setPosition(fromPosition);
    }
    isPlayingRef.current = true;
    setIsPlaying(true);

    if (audioRef.current) {
      if (fromPosition !== undefined) audioRef.current.currentTime = fromPosition;
      audioRef.current.play().catch(() => {
        // Autoplay blocked — user interaction required first
      });
    } else {
      startTimer(fromPosition);
    }
  }, [startTimer]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    audioRef.current?.pause();
    stopTimer();
  }, [stopTimer]);

  const seek = useCallback((pos: number) => {
    posRef.current = pos;
    setPosition(pos);
    if (audioRef.current) {
      audioRef.current.currentTime = pos;
    } else if (isPlayingRef.current) {
      // Keep timer running from new position
      startTimer(pos);
    }
  }, [startTimer]);

  const getPosition = useCallback(() => posRef.current, []);

  return { currentPosition: position, duration, isPlaying, play, pause, seek, getPosition };
}
