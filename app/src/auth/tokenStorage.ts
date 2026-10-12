import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Keeps the login token. Android uses the encrypted SecureStore.
 * The web build falls back to localStorage, since SecureStore is native-only.
 */
const KEY = 'teachwise_token';

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(KEY) ?? window.sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY);
}

/**
 * `remember: false` ("Stay signed in" off): on the web the token lives only until the tab closes.
 * The server also gives that session a shorter life (12 hours instead of 30 days).
 */
export async function setToken(token: string, remember = true): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(KEY);
      window.sessionStorage.removeItem(KEY);
      (remember ? window.localStorage : window.sessionStorage).setItem(KEY, token);
    } catch {
      // Private browsing: stay logged in for this tab only.
    }
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(KEY);
      window.sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
