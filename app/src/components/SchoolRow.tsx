import { Pressable, View } from 'react-native';
import type { PlatformSchoolRow } from '@/api/platform';
import { ago } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { colors, space, text } from '@/theme';
import { SchoolBadge } from './SchoolBadge';
import { Txt } from './Txt';
import { Pill } from './ui';

/** One school in the owner's lists: badge, name, place, contact, status. */
export function SchoolRow({ s, onPress }: { s: PlatformSchoolRow; onPress: () => void }) {
  const tone = s.status === 'active' ? 'green' : s.status === 'pending' ? 'orange' : 'grey';
  const label = s.status === 'active' ? tr('Active', 'Aktibo') : s.status === 'pending' ? tr('Waiting', 'Naghihintay') : tr('Paused', 'Naka-pause');
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: 8, marginHorizontal: -8, borderRadius: 16, backgroundColor: hovered ? colors.surface : 'transparent' })}>
      <SchoolBadge school={s} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="semibold" size={text.bodyLg} numberOfLines={1}>{s.name}</Txt>
        <Txt size={text.small} color={colors.muted} numberOfLines={1}>{[s.location, s.contact_name, s.applied_at && ago(s.applied_at)].filter(Boolean).join(' · ')}</Txt>
      </View>
      <Pill label={label} tone={tone} />
    </Pressable>
  );
}
