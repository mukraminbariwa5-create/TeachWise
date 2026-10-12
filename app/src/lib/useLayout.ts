import { useWindowDimensions } from 'react-native';

export type LayoutSize = 'phone' | 'tablet' | 'desktop';

/**
 * phone   < 768 px  : mobile design with the bottom tab bar
 * tablet  768–1099  : computer design with an icon-only sidebar
 * desktop ≥ 1100    : computer design with the full sidebar
 */
export function useLayoutSize(): LayoutSize {
  const { width } = useWindowDimensions();
  if (width < 768) return 'phone';
  if (width < 1100) return 'tablet';
  return 'desktop';
}

/** True for the computer (sidebar) design. */
export function useIsWide(): boolean {
  return useLayoutSize() !== 'phone';
}
