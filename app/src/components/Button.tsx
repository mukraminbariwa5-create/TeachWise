import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';
import { Txt } from './Txt';

interface Props extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'outline' | 'light';
  size?: 'md' | 'lg';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = 'primary', size = 'md', loading, disabled, style, ...rest }: Props) {
  // Disabled buttons are clearly grey (not a lighter navy that still looks clickable).
  const bg = variant === 'primary' ? (disabled ? colors.track : colors.navy) : variant === 'light' ? '#FFFFFF' : 'transparent';
  const fg = disabled && !loading ? colors.muted : variant === 'primary' ? '#FFFFFF' : variant === 'light' ? '#0B0B6E' : colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          height: size === 'lg' ? 54 : 46,
          paddingHorizontal: size === 'lg' ? 28 : 20,
          borderRadius: 999,
          backgroundColor: bg,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: disabled && !loading ? colors.border : colors.navy,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.9 : 1,
          // a small squeeze when pressed, a lift when hovered on computers
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
          ...(hovered && !disabled && variant === 'primary' ? { backgroundColor: colors.navyDeep } : null),
          ...(hovered && !disabled && variant === 'outline' ? { backgroundColor: colors.track } : null),
        },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Txt weight="semibold" size={size === 'lg' ? 17 : 15} color={fg}>{title}</Txt>}
    </Pressable>
  );
}
