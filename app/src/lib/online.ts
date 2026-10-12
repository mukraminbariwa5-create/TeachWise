import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Whether the server can be reached. The web build also listens to the browser's
 * online/offline events; on phones the API client reports failed and successful calls.
 */
export const useOnline = create<{ online: boolean; set: (v: boolean) => void }>((set) => ({
  online: true,
  set: (online) => set({ online }),
}));

export const markOnline = (v: boolean) => {
  if (useOnline.getState().online !== v) useOnline.getState().set(v);
};

/** Mount once (root layout). */
export function useOnlineListeners() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    markOnline(window.navigator.onLine !== false);
    const on = () => markOnline(true);
    const off = () => markOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
}
