import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Small device preferences (intro on/off, checklist dismissed…). Never throws. */
const memory = new Map<string, string>();

export async function getPref(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(`tw.${key}`);
    return (await SecureStore.getItemAsync(`tw_${key}`)) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function setPref(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    if (Platform.OS === 'web') window.localStorage.setItem(`tw.${key}`, value);
    else await SecureStore.setItemAsync(`tw_${key}`, value);
  } catch {
    // stays in memory for this session
  }
}

/** Once per browser tab / app launch (so a page refresh doesn't replay the intro). */
export function sessionFlag(key: string): { get: () => boolean; set: () => void } {
  return {
    get: () => {
      try {
        return Platform.OS === 'web' ? window.sessionStorage.getItem(`tw.${key}`) === '1' : memory.get(`session.${key}`) === '1';
      } catch {
        return memory.get(`session.${key}`) === '1';
      }
    },
    set: () => {
      memory.set(`session.${key}`, '1');
      try {
        if (Platform.OS === 'web') window.sessionStorage.setItem(`tw.${key}`, '1');
      } catch {
        // ignore
      }
    },
  };
}
