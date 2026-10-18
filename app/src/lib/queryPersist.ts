import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';

/**
 * Saves the last loaded dashboards, history and notifications on the device, so pages open
 * instantly (and work offline) while fresh data loads in the background.
 * Only read-only screens are saved; forms and anything sensitive are not.
 */
const KEY = 'teachwise_query_cache_v1';
const MAX_AGE = 24 * 3600 * 1000;
const SAVED_ROOTS = new Set(['student', 'teacher', 'admin', 'notifications', 'wise', 'app-info', 'sections']);

const storage = {
  get: async (): Promise<string | null> => {
    try {
      return Platform.OS === 'web' ? window.localStorage.getItem(KEY) : await AsyncStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: async (v: string) => {
    try {
      if (Platform.OS === 'web') window.localStorage.setItem(KEY, v);
      else await AsyncStorage.setItem(KEY, v);
    } catch {
      // full or unavailable storage: the app still works, just without the instant start
    }
  },
  clear: async () => {
    try {
      if (Platform.OS === 'web') window.localStorage.removeItem(KEY);
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

export async function restoreQueryCache(client: QueryClient): Promise<void> {
  const raw = await storage.get();
  if (!raw) return;
  try {
    const { savedAt, state } = JSON.parse(raw) as { savedAt: number; state: DehydratedState };
    if (Date.now() - savedAt < MAX_AGE) hydrate(client, state);
  } catch {
    await storage.clear();
  }
}

/** Keeps the saved copy up to date (at most once a second). Returns a cleanup function. */
export function persistQueryCache(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    const state = dehydrate(client, {
      shouldDehydrateQuery: (q) => q.state.status === 'success' && SAVED_ROOTS.has(String(q.queryKey[0])) && !String(q.queryKey[1] ?? '').includes('form'),
    });
    storage.set(JSON.stringify({ savedAt: Date.now(), state }));
  };
  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      save();
    }, 1000);
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

/** On log out, forget the previous person's data. */
export const clearQueryCache = storage.clear;
