import { createContext, useContext, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';

const standard = { desktop: false, text: 1, icon: 1 };
const desktop = { desktop: true, text: 1.125, icon: 1.1 };
const UiScale = createContext(standard);

/** Desktop readability at normal browser zoom. Print keeps its own document sizing. */
export function UiScaleProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const path = usePathname();
  return <UiScale.Provider value={width >= 1100 && !path.startsWith('/print') ? desktop : standard}>{children}</UiScale.Provider>;
}

export const useUiScale = () => useContext(UiScale);
