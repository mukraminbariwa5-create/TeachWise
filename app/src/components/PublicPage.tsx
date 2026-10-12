import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, homeFor } from '@/auth/store';
import { tr } from '@/lib/i18n';
import { useIsWide } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, shadowStyle, space, text } from '@/theme';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { OfflineBanner } from './OfflineBanner';
import { Txt } from './Txt';
import { WiseMascot, type Mood } from './WiseMascot';

/** Pages people see before signing in (invite, join link, register your school): navy top, light card. */
export function PublicPage({ title, subtitle, mood = 'hello', children, maxWidth = 560 }: { title: string; subtitle?: string; mood?: Mood; children: ReactNode; maxWidth?: number }) {
  const router = useRouter();
  const wide = useIsWide();
  const user = useAuth((s) => s.user);
  useTitle(title);
  const back = () => (router.canGoBack() ? router.back() : router.replace(user ? homeFor(user.role) : '/login'));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.frame }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <OfflineBanner />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: wide ? 40 : space.lg, paddingTop: wide ? 28 : 44, paddingBottom: space.md, gap: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('Back', 'Bumalik')} onPress={back} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrowLeft" size={20} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
        <Logo size={wide ? 42 : 34} onDark />
      </View>
      <ScrollView style={{ flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 }} contentContainerStyle={{ padding: wide ? 40 : space.lg, paddingBottom: 60, width: '100%', maxWidth: maxWidth + 80, alignSelf: 'center', gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Txt weight="bold" size={wide ? text.h1 : text.h2} accessibilityRole="header" style={{ letterSpacing: -0.5 }}>{title}</Txt>
            {subtitle ? <Txt size={text.bodyLg} color={colors.muted} style={{ lineHeight: 23 }}>{subtitle}</Txt> : null}
          </View>
          <WiseMascot size={wide ? 120 : 92} mood={mood} />
        </View>
        <View style={[{ backgroundColor: colors.card, borderRadius: 28, padding: wide ? space.xxl : space.lg, gap: space.lg }, shadowStyle('soft')]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
