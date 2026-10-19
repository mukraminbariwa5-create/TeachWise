import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/lib/useReducedMotion';

const native = Platform.OS !== 'web';

/**
 * Page content appears with a short, plain fade: no slide, no staggered lists, so screens feel
 * quick rather than staged. Pass `distance` for things that open because of something the person
 * did (a chat panel, a popover); those slide in to show where they came from.
 * `delay` is kept for older calls but only applies together with `distance`.
 */
export function FadeIn({ children, delay = 0, distance, style }: { children: ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const slide = distance !== undefined && !reduced;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: slide ? 260 : 160, delay: slide ? delay : 0, useNativeDriver: native }).start();
  }, [progress, delay, slide]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: slide ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance as number, 0] }) }] : [],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
