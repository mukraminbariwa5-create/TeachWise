import { create } from 'zustand';
import { API_URL } from '@/api/client';
import type { PublicSchool } from '@/api/types';
import { getPref, setPref } from './prefs';

export type { PublicSchool };

/**
 * The school picked on the sign-in / sign-up screen, remembered on this device
 * (so students only choose it once). After sign-in, the school comes from the account.
 */
export const usePickedSchool = create<{
  school: PublicSchool | null;
  loaded: boolean;
  pick: (s: PublicSchool | null) => void;
  load: () => Promise<void>;
}>((set) => ({
  school: null,
  loaded: false,
  pick: (school) => {
    set({ school });
    setPref('school', school ? JSON.stringify(school) : '');
  },
  load: async () => {
    try {
      const raw = await getPref('school');
      set({ school: raw ? (JSON.parse(raw) as PublicSchool) : null, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));

/** Full address of a school logo (the API sends it relative to itself). */
export function logoUri(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:/.test(path) ? path : `${API_URL}${path}`;
}

/** "MSU-Sulu" when there's a short name, else the full name. */
export function schoolShortName(s: { name: string; short_name: string | null } | null | undefined): string {
  return s ? s.short_name || s.name : '';
}

/** Two letters for a school badge when there's no logo, e.g. "Demo State University" → "DS". */
export function schoolInitials(s: { name: string; short_name: string | null }): string {
  const base = s.short_name && s.short_name.length <= 4 ? s.short_name : s.name;
  const words = base.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !/^(of|the|and|de|ng)$/i.test(w));
  return (words.length > 1 ? words[0][0] + words[1][0] : base.slice(0, 2)).toUpperCase();
}

/** The web address of the app (for join links). Set EXPO_PUBLIC_WEB_URL for phone builds. */
export function webUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) return window.location.origin;
  return (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://teachwise.app').replace(/\/$/, '');
}

/** e.g. https://teachwise.example.edu/join/MSUSULU */
export function joinLink(code: string): string {
  return `${webUrl()}/join/${code}`;
}
