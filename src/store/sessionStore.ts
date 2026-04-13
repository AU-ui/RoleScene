import { create } from 'zustand';
import type { PlaybackState, SyncStatus, Role } from '../types';

interface SessionStore {
  // Session identity
  role: Role | null;
  roomCode: string;
  partnerConnected: boolean;

  // Playback
  playbackState: PlaybackState;
  currentPosition: number; // seconds

  // Sync
  syncStatus: SyncStatus;

  // Sliders (1–10)
  mySliderValue: number;
  partnerSliderValue: number;

  // Segment
  currentSegment: number;

  // Actions
  setRole: (r: Role | null) => void;
  setRoomCode: (c: string) => void;
  setPartnerConnected: (v: boolean) => void;
  setPlaybackState: (s: PlaybackState) => void;
  setCurrentPosition: (p: number) => void;
  setSyncStatus: (s: SyncStatus) => void;
  setMySliderValue: (v: number) => void;
  setPartnerSliderValue: (v: number) => void;
  setCurrentSegment: (i: number) => void;
  resetSession: () => void;
}

type SessionState = Omit<SessionStore,
  'setRole' | 'setRoomCode' | 'setPartnerConnected' | 'setPlaybackState' |
  'setCurrentPosition' | 'setSyncStatus' | 'setMySliderValue' |
  'setPartnerSliderValue' | 'setCurrentSegment' | 'resetSession'
>;

const DEFAULT: SessionState = {
  role: null,
  roomCode: '',
  partnerConnected: false,
  playbackState: 'idle',
  currentPosition: 0,
  syncStatus: 'disconnected',
  mySliderValue: 5,
  partnerSliderValue: 5,
  currentSegment: 0,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...DEFAULT,

  setRole:             (r) => set({ role: r }),
  setRoomCode:         (c) => set({ roomCode: c }),
  setPartnerConnected: (v) => set({ partnerConnected: v }),
  setPlaybackState:    (s) => set({ playbackState: s }),
  setCurrentPosition:  (p) => set({ currentPosition: p }),
  setSyncStatus:       (s) => set({ syncStatus: s }),
  setMySliderValue:    (v) => set({ mySliderValue: v }),
  setPartnerSliderValue:(v) => set({ partnerSliderValue: v }),
  setCurrentSegment:   (i) => set({ currentSegment: i }),
  resetSession: () => set(DEFAULT),
}));
