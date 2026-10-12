import { View } from 'react-native';
import { avatarText, avatarTints } from '@/theme';
import { Txt } from './Txt';

function tintFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return avatarTints[hash % avatarTints.length];
}

/** Initials in a soft colored circle, e.g. "LS" for Prof. Liza Santos. */
export function Avatar({ name, initials, size = 56 }: { name: string; initials: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tintFor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt weight="semibold" size={Math.round(size * 0.32)} color={avatarText}>
        {initials}
      </Txt>
    </View>
  );
}
