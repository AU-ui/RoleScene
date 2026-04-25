/**
 * useSync — WebSocket sync engine.
 *
 * Stale-closure safe: all caller-supplied callbacks are stored in refs so the
 * WebSocket handler always calls the latest version, even after re-renders.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import type { ClientMsg, ServerMsg, Role } from '../types';
import { WS_BASE } from '../lib/api';

const DRIFT_THRESHOLD = 0.15; // 150 ms

interface SyncCallbacks {
  onPlay:          (position: number) => void;
  onPause:         (position: number) => void;
  onSeek:          (position: number) => void;
  onHeartbeat:     (correctedPosition: number) => void;
  onNextSegment:   (segment: number) => void;
}

interface UseSyncOptions extends SyncCallbacks {
  roomCode: string;
  role: Role;
  token: string;
}

export function useSync({
  roomCode, role, token,
  onPlay, onPause, onSeek, onHeartbeat, onNextSegment,
}: UseSyncOptions) {
  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const getPositionRef = useRef<() => number>(() => 0);
  const mountedRef     = useRef(true);

  // Callback refs — always current, no stale closures
  const cbRef = useRef<SyncCallbacks>({ onPlay, onPause, onSeek, onHeartbeat, onNextSegment });
  useEffect(() => { cbRef.current = { onPlay, onPause, onSeek, onHeartbeat, onNextSegment }; });

  const store = useSessionStore();
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; });

  const sendMsg = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // Expose position getter registration so callers can inject live position
  const registerGetPosition = useCallback((fn: () => number) => {
    getPositionRef.current = fn;
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !roomCode) return;

    storeRef.current.setSyncStatus('connecting');

    const ws = new WebSocket(`${WS_BASE}?roomCode=${roomCode}&role=${role}&token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      storeRef.current.setSyncStatus('synced');

      if (role === 'host') {
        heartbeatRef.current = setInterval(() => {
          sendMsg({ type: 'heartbeat', position: getPositionRef.current() });
        }, 5000);
      }
    };

    ws.onmessage = ({ data }: MessageEvent) => {
      let msg: ServerMsg;
      try { msg = JSON.parse(data as string); } catch { return; }
      if (!mountedRef.current) return;

      const s = storeRef.current;
      const cb = cbRef.current;

      switch (msg.type) {
        case 'partner_joined':
          s.setPartnerConnected(true);
          break;

        case 'partner_left':
          s.setPartnerConnected(false);
          break;

        case 'session_state': {
          s.setCurrentSegment(msg.segment);
          s.setPlaybackState(msg.playbackState as 'idle' | 'playing' | 'paused');
          s.setCurrentPosition(msg.position);
          s.setMySliderValue(role === 'host' ? msg.hostSlider : msg.guestSlider);
          s.setPartnerSliderValue(role === 'host' ? msg.guestSlider : msg.hostSlider);
          if (msg.playbackState === 'playing') {
            const elapsed = (Date.now() - msg.serverTimestamp) / 1000;
            cb.onPlay(msg.position + elapsed);
          }
          break;
        }

        case 'play': {
          const elapsed = (Date.now() - msg.serverTimestamp) / 1000;
          const corrected = msg.position + elapsed;
          s.setPlaybackState('playing');
          s.setCurrentPosition(corrected);
          cb.onPlay(corrected);
          break;
        }

        case 'pause':
          s.setPlaybackState('paused');
          s.setCurrentPosition(msg.position);
          cb.onPause(msg.position);
          break;

        case 'seek':
          s.setCurrentPosition(msg.position);
          cb.onSeek(msg.position);
          break;

        case 'heartbeat': {
          if (role !== 'guest') break;
          const networkDelay = (Date.now() - msg.serverTimestamp) / 1000;
          const hostNow   = msg.position + networkDelay;
          const localNow  = getPositionRef.current();
          const drift     = Math.abs(hostNow - localNow);
          if (drift > DRIFT_THRESHOLD) {
            s.setSyncStatus('drifting');
            cb.onHeartbeat(hostNow);
            setTimeout(() => {
              if (mountedRef.current) s.setSyncStatus('synced');
            }, 800);
          }
          break;
        }

        case 'partner_slider':
          s.setPartnerSliderValue(msg.value);
          break;

        case 'next_segment':
          s.setCurrentSegment(msg.segment);
          s.setPlaybackState('paused');
          s.setCurrentPosition(0);
          cb.onNextSegment(msg.segment);
          break;
      }
    };

    ws.onclose = () => {
      storeRef.current.setSyncStatus('disconnected');
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (mountedRef.current) reconnectRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => storeRef.current.setSyncStatus('disconnected');
  }, [roomCode, role, token, sendMsg]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (reconnectRef.current)  clearTimeout(reconnectRef.current);
      if (heartbeatRef.current)  clearInterval(heartbeatRef.current);
    };
  }, [connect]);

  const sendPlay        = useCallback((pos: number)    => sendMsg({ type: 'play',         position: pos }),   [sendMsg]);
  const sendPause       = useCallback((pos: number)    => sendMsg({ type: 'pause',        position: pos }),   [sendMsg]);
  const sendSeek        = useCallback((pos: number)    => sendMsg({ type: 'seek',         position: pos }),   [sendMsg]);
  const sendSlider      = useCallback((value: number)  => sendMsg({ type: 'slider',       value }),           [sendMsg]);
  const sendNextSegment = useCallback((segment: number)=> sendMsg({ type: 'next_segment', segment }),         [sendMsg]);

  return { sendPlay, sendPause, sendSeek, sendSlider, sendNextSegment, registerGetPosition };
}
