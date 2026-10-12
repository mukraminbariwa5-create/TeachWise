import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useReducedMotion } from '@/lib/useReducedMotion';

const native = Platform.OS !== 'web';
const COLORS = ['#7476FD', '#0B0B6E', '#FFC53D', '#FF7A45', '#36CFC9', '#F759AB', '#5BE49B'];

/**
 * A one-off confetti burst from the middle of its box (place it over a celebrate sticker).
 * Pieces fly out, fall with a little gravity, spin and fade. Skipped with reduced motion.
 */
export function Confetti({ count = 42, spread = 220, play = true }: { count?: number; spread?: number; play?: boolean }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
        const speed = spread * (0.55 + Math.random() * 0.6);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const g = spread * 1.5;
        // sample the path at five points so it can be driven by one Animated value
        const steps = [0, 0.25, 0.5, 0.75, 1];
        return {
          key: i,
          color: COLORS[i % COLORS.length],
          w: 6 + Math.random() * 6,
          h: 10 + Math.random() * 8,
          round: Math.random() > 0.7,
          xs: steps.map((s) => vx * s),
          ys: steps.map((s) => vy * s + g * s * s),
          spin: `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540)}deg`,
        };
      }),
    [count, spread]
  );

  useEffect(() => {
    if (!play || reduced) return;
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  }, [play, reduced, t]);

  if (reduced || !play) return null;

  const input = [0, 0.25, 0.5, 0.75, 1];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '45%', width: 0, height: 0 }}>
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            width: p.w,
            height: p.round ? p.w : p.h,
            borderRadius: p.round ? p.w : 2,
            backgroundColor: p.color,
            opacity: t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: input, outputRange: p.xs }) },
              { translateY: t.interpolate({ inputRange: input, outputRange: p.ys }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
