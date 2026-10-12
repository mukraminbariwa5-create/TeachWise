import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Slot, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import { homeFor, useAuth } from '@/auth/store';
import { UpdateGate, WhatsNew } from '@/components/AppGates';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Intro } from '@/components/Intro';
import { SessionSheet } from '@/components/SessionSheet';
import { preloadStickers } from '@/components/Sticker';
import { Toasts } from '@/components/Toasts';
import { ConfirmHost } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { useOnlineListeners } from '@/lib/online';
import { onNotificationTap } from '@/lib/push';
import { setupPwa } from '@/lib/pwa';
import { queryClient } from '@/lib/queryClient';
import { persistQueryCache, restoreQueryCache } from '@/lib/queryPersist';
import { installGlobalErrorHandlers } from '@/lib/reportError';
import { ThemeProvider } from '@/lib/theme';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
installGlobalErrorHandlers();
setupPwa();

/**
 * App start: fonts, saved data and the session load behind the native splash screen
 * (no extra loading page), then the app appears.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  const [cacheReady, setCacheReady] = useState(false);
  const status = useAuth((s) => s.status);
  const hydrate = useAuth((s) => s.hydrate);
  const lang = useLang((s) => s.lang);
  useOnlineListeners();

  useEffect(() => {
    restoreQueryCache(queryClient).finally(() => setCacheReady(true));
    hydrate();
    preloadStickers();
    return persistQueryCache(queryClient);
  }, [hydrate]);

  // Server texts (Professor Wise, questions, messages) come back in the new language.
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [lang]);

  const ready = (fontsLoaded || !!fontError) && status !== 'loading' && cacheReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StatusBar style="light" />
          {ready ? (
            <ErrorBoundary>
              <Slot />
              <Intro />
              <NotificationTaps />
              <SessionSheet />
              <WhatsNew />
              <ConfirmHost />
              <UpdateGate />
              <Toasts />
            </ErrorBoundary>
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.frame }} />
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Tapping a push notification opens the right home screen. */
function NotificationTaps() {
  const router = useRouter();
  useEffect(
    () =>
      onNotificationTap(() => {
        const user = useAuth.getState().user;
        if (user) router.navigate(homeFor(user.role) as Href);
      }),
    [router]
  );
  return null;
}
