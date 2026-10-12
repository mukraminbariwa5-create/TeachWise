import { create } from 'zustand';
import { api } from '@/api/client';

/** Per-account preferences kept on the server, so they follow the person to any device. */
export interface AccountSettings {
  tips: boolean;
  seen_tips: string[];
  notify: { periods: boolean; reminders: boolean; account: boolean };
}

export const DEFAULT_SETTINGS: AccountSettings = {
  tips: true,
  seen_tips: [],
  notify: { periods: true, reminders: true, account: true },
};

interface SettingsState {
  settings: AccountSettings;
  set: (s: AccountSettings) => void;
  /** Saves immediately on screen, then on the server (rolls back if that fails). */
  update: (patch: Partial<Omit<AccountSettings, 'seen_tips'>>) => Promise<void>;
  markTipSeen: (key: string) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  set: (settings) => set({ settings: { ...DEFAULT_SETTINGS, ...settings, notify: { ...DEFAULT_SETTINGS.notify, ...settings.notify } } }),
  update: async (patch) => {
    const before = get().settings;
    set({ settings: { ...before, ...patch, notify: { ...before.notify, ...(patch.notify ?? {}) } } });
    try {
      const r = await api<{ settings: AccountSettings }>('/me/settings', { method: 'PUT', body: patch });
      get().set(r.settings);
    } catch (e) {
      set({ settings: before });
      throw e;
    }
  },
  markTipSeen: (key) => {
    const s = get().settings;
    if (s.seen_tips.includes(key)) return;
    set({ settings: { ...s, seen_tips: [...s.seen_tips, key] } });
    api(`/me/tips/${encodeURIComponent(key)}/seen`, { method: 'POST' }).catch(() => {});
  },
}));
