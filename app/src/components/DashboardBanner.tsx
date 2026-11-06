import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useLayoutSize } from '@/lib/useLayout';
import { useUiScale } from '@/lib/uiScale';
import { colors, radius } from '@/theme';
import { Button } from './Button';
import { Txt } from './Txt';
import { WiseMascot, type Mood } from './WiseMascot';

/** One compact welcome/status card across the teacher, admin and owner dashboards. */
export function DashboardBanner({ eyebrow, title, description, mood = 'happy', action, children }: {
  eyebrow?: string; title: string; description: string; mood?: Mood;
  action?: { label: string; onPress: () => void; busy?: boolean } | null;
  children?: ReactNode;
}) {
  const phone = useLayoutSize() === 'phone';
  const { desktop } = useUiScale();
  return <View style={{ backgroundColor: colors.brandSoft, borderRadius: radius.lg, padding: desktop ? 32 : phone ? 20 : 24, flexDirection: 'row', alignItems: 'center', gap: 24 }}>
    <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
      {phone ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {eyebrow ? <Txt size={13} color={colors.textSoft} style={{ flex: 1 }}>{eyebrow}</Txt> : <View style={{ flex: 1 }} />}
        <View testID="dashboard-mascot"><WiseMascot size={112} mood={mood} float={false} shadow={false} /></View>
      </View> : eyebrow && <Txt size={13} color={colors.textSoft}>{eyebrow}</Txt>}
      <Txt weight="bold" size={phone ? 23 : 28} accessibilityRole="header" style={{ lineHeight: phone ? 30 : 36 }}>{title}</Txt>
      <Txt size={15} color={colors.textSoft} style={{ lineHeight: 23 }}>{description}</Txt>
      {children}
      {action && <Button title={action.label} onPress={action.onPress} loading={action.busy} style={{ alignSelf: 'flex-start', marginTop: 5, maxWidth: '100%' }} />}
    </View>
    {!phone && <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><WiseMascot size={desktop ? 140 : 112} mood={mood} float={false} shadow={false} /></View>}
  </View>;
}
