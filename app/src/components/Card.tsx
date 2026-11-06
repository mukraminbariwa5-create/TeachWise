import { View, type ViewProps } from 'react-native';
import { colors, radius, shadowStyle } from '@/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[{ backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: 20 }, shadowStyle('soft'), style]} />;
}
