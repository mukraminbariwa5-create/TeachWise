import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/lib/useReducedMotion';

const native = Platform.OS !== 'web';

/** Keeps the navigator mounted; only the page canvas moves, never the navigation rail. */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const previousRoute = useRef(routeKey);

  useLayoutEffect(() => {
    const changed = previousRoute.current !== routeKey;
    previousRoute.current = routeKey;
    progress.stopAnimation();
    if (!changed || reduced || native) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [routeKey, reduced, progress]);

  return (
    <Animated.View testID="page-transition" style={{ flex: 1, minWidth: 0, minHeight: 0, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

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
    Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : slide ? 220 : 140, delay: slide ? delay : 0, useNativeDriver: native }).start();
  }, [progress, delay, slide, reduced]);

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
