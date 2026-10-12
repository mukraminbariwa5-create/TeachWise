import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, fonts } from '@/theme';

/** Text where **double stars** mark bold words, used by Professor Wise's speech bubbles. */
export function RichText({ text, size = 16, color, boldColor, style }: { text: string; size?: number; color?: string; boldColor?: string; style?: StyleProp<TextStyle> }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text maxFontSizeMultiplier={1.5} style={[{ fontFamily: fonts.regular, fontSize: size, color: color ?? colors.text }, style]}>
      {parts.map((part, i) =>
        part.startsWith('**') ? (
          <Text key={i} style={{ fontFamily: fonts.semibold, color: boldColor ?? color ?? colors.text }}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}
