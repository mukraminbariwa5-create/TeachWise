import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** The app version from app.json, e.g. "1.0.0". */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';

export const PLATFORM: string = Platform.OS;

/** A readable device name for "Signed-in devices", e.g. "Chrome on Windows" or "Android phone". */
export function deviceName(): string {
  if (Platform.OS === 'android') return 'Android phone';
  if (Platform.OS === 'ios') return 'iPhone';
  if (typeof navigator === 'undefined') return 'Web browser';
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

/** 1.2.0 vs 1.10.0 compared number by number. Negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
