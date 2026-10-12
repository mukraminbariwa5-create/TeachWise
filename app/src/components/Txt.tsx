import { Text, type TextProps } from 'react-native';
import { colors, fonts } from '@/theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

interface Props extends TextProps {
  weight?: Weight;
  size?: number;
  color?: string;
}

/** Text in the Outfit font. Use this instead of <Text> everywhere. */
export function Txt({ weight = 'regular', size = 16, color = colors.text, style, maxFontSizeMultiplier, ...rest }: Props) {
  // Follows the phone's text size setting, capped so big headings don't break the layout.
  const cap = maxFontSizeMultiplier ?? (size >= 26 ? 1.2 : 1.5);
  return <Text {...rest} maxFontSizeMultiplier={cap} style={[{ fontFamily: fonts[weight], fontSize: size, color }, style]} />;
}
