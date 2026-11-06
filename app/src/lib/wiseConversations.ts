import { create } from 'zustand';
import { Platform } from 'react-native';

const selectionKey = 'teachwise_active_conversations';

function rememberedSelection(): Record<number, number | undefined> {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
    const value = JSON.parse(window.sessionStorage.getItem(selectionKey) || '{}');
    return Object.fromEntries(Object.entries(value ?? {})
      .filter(([key, id]) => /^[1-9]\d*$/.test(key) && Number.isSafeInteger(id) && Number(id) > 0)
      .map(([key, id]) => [Number(key), Number(id)]));
  } catch {
    return {};
  }
}

/** Only numeric topic selections survive a browser refresh; never messages or titles. */
export const useWiseConversations = create<{
  active: Record<number, number | undefined>;
  select: (userId: number, conversationId: number | undefined) => void;
}>((set) => ({
  active: rememberedSelection(),
  select: (userId, conversationId) => set((state) => {
    const active = { ...state.active, [userId]: conversationId };
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.sessionStorage.setItem(selectionKey, JSON.stringify(active));
    } catch { /* The menu still works when browser storage is unavailable. */ }
    return { active };
  }),
}));
