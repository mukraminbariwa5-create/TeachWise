import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useReducedMotion } from '@/lib/useReducedMotion';

/** Web motion belongs to PageTransition; native uses its navigator's own animation. */
export function PageStack() {
  const reduced = useReducedMotion();
  return <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' || reduced ? 'none' : 'fade_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />;
}
