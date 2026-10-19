import { useEffect, useRef } from 'react';
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import type { Mood } from '@/components/WiseMascot';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  mood?: Mood;
  tone?: 'info' | 'success';
}

interface UIState {
  /** Screens that already show a big Professor Wise hide the corner one. */
  launcherHiders: number;
  /** True while a page is being scrolled; the corner Wise steps aside. */
  scrolling: boolean;
  /** Phone: the notifications sheet (opened from the bottom bar). */
  notificationsOpen: boolean;
  toasts: Toast[];
  /** The opening intro is on screen (the guided tour waits for it). */
  introOpen: boolean;
  /** Computers: the Professor Wise chat panel is open. */
  wiseOpen: boolean;
  setWiseOpen: (v: boolean) => void;
  setIntroOpen: (v: boolean) => void;
  setScrolling: (v: boolean) => void;
  addHider: (d: 1 | -1) => void;
  setNotificationsOpen: (v: boolean) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dropToast: (id: number) => void;
}

let nextId = 1;

export const useUI = create<UIState>((set) => ({
  launcherHiders: 0,
  scrolling: false,
  notificationsOpen: false,
  toasts: [],
  introOpen: false,
  wiseOpen: false,
  setWiseOpen: (wiseOpen) => set({ wiseOpen }),
  setIntroOpen: (introOpen) => set({ introOpen }),
  setScrolling: (scrolling) => set({ scrolling }),
  addHider: (d) => set((s) => ({ launcherHiders: Math.max(0, s.launcherHiders + d) })),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: nextId++ }] })),
  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Show a toast from anywhere: toast({ title: 'Saved', mood: 'proud' }). */
export const toast = (t: Omit<Toast, 'id'>) => useUI.getState().pushToast(t);

/** Call in a screen that already shows a big sticker, so only one Professor Wise is on screen. */
export function useHideLauncher(active = true) {
  useEffect(() => {
    if (!active) return;
    useUI.getState().addHider(1);
    return () => useUI.getState().addHider(-1);
  }, [active]);
}

/** Pass to a ScrollView: the corner Wise slides away while scrolling and comes back when it stops. */
export function useScrollHide() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    useUI.getState().setScrolling(false);
  }, []);
  return {
    scrollEventThrottle: 64,
    onScroll: (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!useUI.getState().scrolling) useUI.getState().setScrolling(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => useUI.getState().setScrolling(false), 900);
    },
  };
}

/**
 * Haptic feedback on phones: a light tick for taps, a stronger one for important moments
 * (sent, error). `ms` hints the strength: ≤15 light, ≤25 medium, more = success/error.
 */
export function tap(ms = 12) {
  if (Platform.OS === 'web') return;
  if (ms <= 15) Haptics.selectionAsync().catch(() => {});
  else if (ms <= 25) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else if (ms >= 40) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
