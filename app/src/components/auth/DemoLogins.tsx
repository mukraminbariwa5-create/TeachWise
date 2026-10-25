import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { homeFor, useAuth } from '@/auth/store';
import { tr } from '@/lib/i18n';
import { colors } from '@/theme';
import { Icon, type IconName } from '../Icon';
import { Txt } from '../Txt';

/** True on the public demo build (EXPO_PUBLIC_DEMO=1): shows one-click demo accounts. */
export const IS_PUBLIC_DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

const ACCOUNTS: { username: string; icon: IconName; role: () => string; what: () => string }[] = [
  { username: 'aisha', icon: 'book', role: () => tr('Student', 'Estudyante'), what: () => tr('Rate your teachers in about three minutes', 'I-rate ang mga guro mo sa mga tatlong minuto') },
  { username: 'lsantos', icon: 'barChart', role: () => tr('Teacher', 'Guro'), what: () => tr('Ratings, trends and anonymous comments', 'Mga rating, trend at anonymous na komento') },
  { username: 'admin', icon: 'settings', role: () => tr('School admin', 'Admin ng paaralan'), what: () => tr('Classes, evaluation periods and reports', 'Mga klase, evaluation period at report') },
  { username: 'owner', icon: 'shield', role: () => tr('TeachWise owner', 'May-ari ng TeachWise'), what: () => tr('Approve and manage schools', 'Mag-apruba at mamahala ng mga paaralan') },
];

/** One-click sign-in as each demo account, for recruiters and visitors trying the public demo. */
export function DemoLogins() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (username: string) => {
    if (busy) return;
    setBusy(username);
    setError(null);
    try {
      const u = await login(username, 'password', false, null);
      router.replace(homeFor(u.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.firstMessage : tr('Could not sign in. Please try again.', 'Hindi makapag-sign in. Pakisubukan ulit.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSoft }} />
        <Txt weight="semibold" size={13} color={colors.muted}>{tr('or try a demo account', 'o subukan ang demo account')}</Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSoft }} />
      </View>
      {ACCOUNTS.map((a) => (
        <Pressable
          key={a.username}
          accessibilityRole="button"
          accessibilityLabel={tr(`Sign in as the demo ${a.role()}`, `Mag-sign in bilang demo ${a.role()}`)}
          onPress={() => signIn(a.username)}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 56,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: hovered ? colors.accent : colors.borderSoft,
            backgroundColor: colors.card,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name={a.icon} size={20} color={colors.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt weight="semibold" size={15}>{a.role()}</Txt>
            <Txt size={13} color={colors.muted}>{a.what()}</Txt>
          </View>
          {busy === a.username ? <ActivityIndicator color={colors.accent} /> : <Icon name="chevronRight" size={18} color={colors.muted} />}
        </Pressable>
      ))}
      {error && <Txt size={14} color={colors.danger}>{error}</Txt>}
      <Txt size={13} color={colors.muted} style={{ lineHeight: 19 }}>
        {tr('This is a public demo with sample data. It starts fresh whenever the server restarts.', 'Pampublikong demo ito na may sample na data. Nagsisimula itong bago tuwing magre-restart ang server.')}
      </Txt>
    </View>
  );
}
