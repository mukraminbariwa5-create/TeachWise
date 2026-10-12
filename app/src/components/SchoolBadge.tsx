import { useState } from 'react';
import { Image, View } from 'react-native';
import { logoUri, schoolInitials } from '@/lib/school';
import { colors } from '@/theme';
import { Txt } from './Txt';

/** A school's logo, or its initials in a navy circle when it has none. */
export function SchoolBadge({ school, size = 40, onDark }: { school: { name: string; short_name: string | null; logo_url: string | null }; size?: number; onDark?: boolean }) {
  const [failed, setFailed] = useState(false);
  const uri = logoUri(school.logo_url);
  if (uri && !failed) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: onDark ? 0 : 1, borderColor: colors.borderSoft }}>
        <Image source={{ uri }} onError={() => setFailed(true)} accessibilityIgnoresInvertColors style={{ width: size * 0.86, height: size * 0.86 }} resizeMode="contain" accessibilityLabel={school.name} />
      </View>
    );
  }
  return (
    <View accessibilityLabel={school.name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: onDark ? 'rgba(255,255,255,0.16)' : colors.chip, alignItems: 'center', justifyContent: 'center' }}>
      <Txt weight="bold" size={Math.round(size * 0.36)} color={onDark ? '#FFFFFF' : colors.accent}>{schoolInitials(school)}</Txt>
    </View>
  );
}
