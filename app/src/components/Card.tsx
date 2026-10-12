import { View, type ViewProps } from 'react-native';
import { colors, radius, shadow } from '@/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 24 }, shadow, style]} />;
}
