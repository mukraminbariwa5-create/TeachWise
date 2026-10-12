import { Platform } from 'react-native';
import { api } from '@/api/client';
import { APP_VERSION } from './appInfo';

let lastReport = 0;

/**
 * Sends a crash or unexpected error to the server (admin → App errors), at most one every 5 seconds.
 * Never throws: reporting must not cause another error.
 */
export function reportError(error: unknown, screen?: string) {
  const now = Date.now();
  if (now - lastReport < 5000) return;
  lastReport = now;
  const e = error instanceof Error ? error : new Error(String(error));
  const path = screen ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname : undefined);
  api('/app/errors', {
    method: 'POST',
    body: { message: `${e.name}: ${e.message}`.slice(0, 2000), stack: e.stack?.slice(0, 20000), screen: path, platform: Platform.OS, app_version: APP_VERSION },
  }).catch(() => {});
}

/** Catches errors that happen outside React (e.g. in timers and promises). Call once. */
export function installGlobalErrorHandlers() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message));
    window.addEventListener('unhandledrejection', (ev) => reportError((ev as PromiseRejectionEvent).reason));
    return;
  }
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const previous = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => {
    reportError(e);
    previous?.(e, fatal);
  });
}
