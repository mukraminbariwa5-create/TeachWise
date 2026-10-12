import { Image, View } from 'react-native';
import { colors } from '@/theme';
import { Txt } from './Txt';

const MARK = require('../../assets/brand/logo-mark.png');
const ICON = require('../../assets/brand/icon-rounded.png');

/** The square TeachWise mark (Professor Wise on navy). */
export function LogoMark({ size = 44 }: { size?: number }) {
  return <Image accessibilityIgnoresInvertColors source={MARK} style={{ width: size * 1.026, height: size }} resizeMode="contain" />;
}

/** The full app icon, as it appears on a phone's home screen. */
export function AppIcon({ size = 160 }: { size?: number }) {
  return <Image accessibilityLabel="TeachWise" source={ICON} style={{ width: size, height: size }} resizeMode="contain" />;
}

/** "TeachWise" with "Wise" in the logo periwinkle. */
export function Wordmark({ size = 24, onDark }: { size?: number; onDark?: boolean }) {
  return (
    <Txt weight="bold" size={size} color={onDark ? '#FFFFFF' : colors.text} style={{ letterSpacing: -0.4 }}>
      Teach<Txt weight="bold" size={size} color={onDark ? '#8E90FF' : colors.brand}>Wise</Txt>
    </Txt>
  );
}

/** Mark + wordmark side by side. */
export function Logo({ size = 44, onDark }: { size?: number; onDark?: boolean }) {
  return (
    <View accessibilityLabel="TeachWise" style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.26 }}>
      <LogoMark size={size} />
      <Wordmark size={size * 0.52} onDark={onDark} />
    </View>
  );
}
