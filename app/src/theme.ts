/**
 * TeachWise design tokens.
 *
 * `colors` is one shared object. Switching light/dark replaces its values and
 * re-renders the app (see lib/theme.tsx), so every screen just reads `colors.x`.
 * Never hard-code a hex in a screen: add a token here instead.
 */

const light = {
  /** The navy frame, sidebar and phone bars. */
  frame: '#0B0B6E',
  frameSoft: '#2A2A8A',
  onFrameMuted: '#C9CCF0',
  /** Buttons, links, selected things, the donut. */
  navy: '#0B0B6E',
  navyDeep: '#05053F',
  navySoft: '#2A2A8A',
  onNavyMuted: '#C9CCF0',
  page: '#E4E8F2',
  surface: '#F3F5FB',
  card: '#FFFFFF',
  text: '#12122B',
  textSoft: '#3B3F5C',
  muted: '#5B5F7A',
  placeholder: '#6B6F8A',
  border: '#C9CEDF',
  borderSoft: '#DCE1EE',
  track: '#E6E9F3',
  chip: '#E6E8F7',
  inverse: '#12122B',
  onInverse: '#FFFFFF',
  pendingBg: '#FFEEDF',
  pendingFg: '#8A3B0C',
  successBg: '#E3F4EA',
  successFg: '#1A6B43',
  urgentBg: '#FFE4D6',
  urgentFg: '#B23A0B',
  urgent: '#E8590C',
  doneBg: '#E6E8F7',
  alert: '#E5383B',
  disabled: '#6E70A0',
  danger: '#B42318',
  dangerBg: '#FDECEA',
  skeleton: '#E3E7F1',
  shadow: '#0B0B6E',
  /** The "Wise" periwinkle from the logo. */
  brand: '#7476FD',
  brandSoft: '#ECEBFF',
  /** Navy used for text and icons (links, bold words). Lighter in dark mode so it stays readable. */
  accent: '#0B0B6E',
  /** The urgent welcome card (white text stays readable in both modes). */
  urgentCard: '#B93D0B',
  /** Rating scale 1–5: a soft tint for each card and a strong colour when it's picked (white text on it). */
  rate1Bg: '#FDE8E4',
  rate1: '#C0392B',
  rate2Bg: '#FFEEDF',
  rate2: '#C2540F',
  rate3Bg: '#ECEEF6',
  rate3: '#4A4F75',
  rate4Bg: '#E3F4EA',
  rate4: '#1E7B4D',
  rate5Bg: '#D5F2E1',
  rate5: '#11613D',
};

export type Palette = typeof light;

const dark: Palette = {
  frame: '#07073F',
  frameSoft: '#1B1B66',
  onFrameMuted: '#B8BBEA',
  navy: '#5F63F2',
  navyDeep: '#4D52E6',
  navySoft: '#2B2D80',
  onNavyMuted: '#D3D5FF',
  page: '#05050F',
  surface: '#0E0F24',
  card: '#181A38',
  text: '#F1F2FB',
  textSoft: '#C4C7E4',
  muted: '#9A9EC4',
  placeholder: '#8C90B6',
  border: '#34366A',
  borderSoft: '#2A2C55',
  track: '#2A2C52',
  chip: '#262970',
  inverse: '#F1F2FB',
  onInverse: '#12122B',
  pendingBg: '#3D2410',
  pendingFg: '#FFB27A',
  successBg: '#123A28',
  successFg: '#7EE0AC',
  urgentBg: '#47200C',
  urgentFg: '#FFA36B',
  urgent: '#FF8A3D',
  doneBg: '#262970',
  alert: '#FF5A5F',
  disabled: '#4A4D80',
  danger: '#FF8A80',
  dangerBg: '#3D1414',
  skeleton: '#23254A',
  shadow: '#000000',
  brand: '#8E90FF',
  brandSoft: '#23245A',
  accent: '#A5A8FF',
  urgentCard: '#A8380A',
  rate1Bg: '#3D1A17',
  rate1: '#C2412F',
  rate2Bg: '#3D2410',
  rate2: '#B85412',
  rate3Bg: '#24264A',
  rate3: '#4D5290',
  rate4Bg: '#123A28',
  rate4: '#1F7A4C',
  rate5Bg: '#0F3D27',
  rate5: '#16804F',
};

export const palettes = { light, dark };

export const colors: Palette = { ...light };

/** Avatar circles keep pastel tints with navy initials in both modes. */
export const avatarTints = ['#DCE6FA', '#F7E3D6', '#DDEFE6', '#ECE2F6', '#FBEFD0', '#DCEFF4'];
export const avatarText = '#0B0B6E';

export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
};

export const radius = { sm: 14, md: 22, lg: 28, xl: 32, pill: 999 };

/** Spacing scale. Use these instead of one-off numbers so every screen lines up. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Text sizes, smallest to largest. */
export const text = { caption: 12, small: 13, body: 15, bodyLg: 16, title: 18, h3: 20, h2: 24, h1: 30, display: 34 } as const;

/** Soft card shadow (computed when called, so it follows the current mode). */
export function shadowStyle(strength: 'soft' | 'lift' = 'soft') {
  return {
    shadowColor: colors.shadow,
    shadowOpacity: strength === 'lift' ? 0.1 : 0.06,
    shadowRadius: strength === 'lift' ? 26 : 20,
    shadowOffset: { width: 0, height: strength === 'lift' ? 10 : 8 },
    elevation: strength === 'lift' ? 4 : 2,
  } as const;
}

/** Kept for older imports: same as shadowStyle('soft'). */
export const shadow = {
  shadowColor: '#0B0B6E',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;

export const WIDE_BREAKPOINT = 768;
