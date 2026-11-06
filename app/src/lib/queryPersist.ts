import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import type { User } from '@/api/types';

/**
 * Saves the last loaded dashboards, history and notifications on the device, so pages open
 * instantly (and work offline) while fresh data loads in the background.
 * Only read-only screens are saved; forms and anything sensitive are not.
 */
const KEY = 'teachwise_query_cache_v1';
const MAX_AGE = 24 * 3600 * 1000;
const SAVED_ROOTS = new Set(['student', 'teacher', 'admin', 'notifications', 'app-info', 'sections']);

export function accountQueryScope(user: User | null, schoolId: number | null): string | null {
  return user ? JSON.stringify([schoolId, user.id, user.role, user.admin_scope ?? null, user.department_id ?? null, user.section?.id ?? null]) : null;
}

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

export async function restoreQueryCache(client: QueryClient, scope: string | null): Promise<void> {
  const raw = await storage.get();
  if (!raw) return;
  try {
    const { savedAt, state, scope: savedScope } = JSON.parse(raw) as { savedAt: number; state: DehydratedState; scope?: string };
    if (!scope || savedScope !== scope || Date.now() - savedAt >= MAX_AGE) {
      await storage.clear();
      return;
    }
    // Guidance may contain very personal concerns. Do not restore old chat copies
    // from device storage, including copies written by previous app versions.
    state.queries = state.queries.filter((q) => q.queryKey[0] !== 'wise');
    await storage.set(JSON.stringify({ savedAt, scope, state }));
    if (Date.now() - savedAt < MAX_AGE) hydrate(client, state);
  } catch {
    await storage.clear();
  }
}

/** Keeps the saved copy up to date (at most once a second). Returns a cleanup function. */
export function persistQueryCache(client: QueryClient, getScope: () => string | null): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    const scope = getScope();
    if (!scope) { void storage.clear(); return; }
    const state = dehydrate(client, {
      shouldDehydrateQuery: (q) => q.state.status === 'success' && SAVED_ROOTS.has(String(q.queryKey[0])) && !String(q.queryKey[1] ?? '').includes('form')
        && !(q.queryKey[0] === 'admin' && ['users', 'whitelist', 'invites', 'password-requests', 'inbox'].includes(String(q.queryKey[1]))),
    });
    storage.set(JSON.stringify({ savedAt: Date.now(), scope, state }));
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
