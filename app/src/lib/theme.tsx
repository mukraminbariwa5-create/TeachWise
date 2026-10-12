import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { colors, palettes } from '@/theme';
import { create } from 'zustand';
import { loadLang, useLang } from './i18n';

/** Pages that must be light whatever the setting (the print page). */
export const useForceLight = create<{ on: boolean }>(() => ({ on: false }));

export type Mode = 'light' | 'dark';
/** What the person picked in Settings → Appearance. "system" follows the phone or computer. */
export type Appearance = 'system' | Mode;

const KEY = 'teachwise_theme';

async function loadMode(): Promise<Appearance | null> {
  try {
    const v = Platform.OS === 'web' ? window.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

async function saveMode(mode: Appearance) {
  try {
    if (Platform.OS === 'web') window.localStorage.setItem(KEY, mode);
    else await SecureStore.setItemAsync(KEY, mode);
  } catch {
    // Not saved; the choice still applies until the app closes.
  }
}

const ThemeContext = createContext<{ mode: Mode; appearance: Appearance; setAppearance: (a: Appearance) => void }>({ mode: 'light', appearance: 'system', setAppearance: () => {} });

/**
 * Light/dark mode. Follows the device unless the person picked Light or Dark in Settings.
 * Switching swaps the shared `colors` values and re-renders every screen.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>('system');
  const [ready, setReady] = useState(false);
  const forceLight = useForceLight((s) => s.on);
  const mode: Mode = forceLight ? 'light' : appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;

  const lang = useLang((s) => s.lang);

  useEffect(() => {
    Promise.all([loadMode(), loadLang()]).then(([saved]) => {
      if (saved) setAppearanceState(saved);
      setReady(true);
    });
  }, []);

  Object.assign(colors, palettes[mode]);

  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a);
    saveMode(a);
  }, []);

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ mode, appearance, setAppearance }}>
      {/* The key re-mounts the screens so every style picks up the new colors and language. */}
      <NavigationThemeProvider value={navigationTheme(mode)}>
        <View key={`${mode}-${lang}`} style={{ flex: 1, backgroundColor: colors.page }}>
          {children}
        </View>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Screen backgrounds from the navigation library follow the TeachWise colours. */
function navigationTheme(mode: Mode) {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.surface,
      card: colors.card,
      text: colors.text,
      border: colors.borderSoft,
      primary: colors.navy,
    },
  };
}
