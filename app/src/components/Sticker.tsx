import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/lib/useReducedMotion';

const native = Platform.OS !== 'web';

/** Every Professor Wise sticker, with its width/height ratio so it never stretches. */
export const STICKERS = {
  back: { src: require('../../assets/stickers/back.png'), ratio: 0.901 },
  book: { src: require('../../assets/stickers/book.png'), ratio: 0.791 },
  celebrate: { src: require('../../assets/stickers/celebrate.png'), ratio: 1.419 },
  cheer: { src: require('../../assets/stickers/cheer.png'), ratio: 1.069 },
  clipboard: { src: require('../../assets/stickers/clipboard.png'), ratio: 0.841 },
  'h-angry': { src: require('../../assets/stickers/h-angry.png'), ratio: 1.314 },
  'h-ask': { src: require('../../assets/stickers/h-ask.png'), ratio: 1.091 },
  'h-grin': { src: require('../../assets/stickers/h-grin.png'), ratio: 1.407 },
  'h-laugh': { src: require('../../assets/stickers/h-laugh.png'), ratio: 1.411 },
  'h-neutral': { src: require('../../assets/stickers/h-neutral.png'), ratio: 1.396 },
  'h-shock': { src: require('../../assets/stickers/h-shock.png'), ratio: 1.376 },
  'h-squint': { src: require('../../assets/stickers/h-squint.png'), ratio: 1.354 },
  'h-tired': { src: require('../../assets/stickers/h-tired.png'), ratio: 1.283 },
  'h-wink': { src: require('../../assets/stickers/h-wink.png'), ratio: 1.207 },
  idea: { src: require('../../assets/stickers/idea.png'), ratio: 0.827 },
  laptop: { src: require('../../assets/stickers/laptop.png'), ratio: 1.226 },
  please: { src: require('../../assets/stickers/please.png'), ratio: 0.894 },
  'point-stick': { src: require('../../assets/stickers/point-stick.png'), ratio: 0.996 },
  sad: { src: require('../../assets/stickers/sad.png'), ratio: 0.817 },
  stern: { src: require('../../assets/stickers/stern.png'), ratio: 0.913 },
  surprised: { src: require('../../assets/stickers/surprised.png'), ratio: 0.763 },
  teach: { src: require('../../assets/stickers/teach.png'), ratio: 1.093 },
  think: { src: require('../../assets/stickers/think.png'), ratio: 0.864 },
  wave: { src: require('../../assets/stickers/wave.png'), ratio: 1.005 },
  wink: { src: require('../../assets/stickers/wink.png'), ratio: 0.916 },
  worried: { src: require('../../assets/stickers/worried.png'), ratio: 0.972 },
} as const;

export type StickerName = keyof typeof STICKERS;

/** Load every sticker up front on the web so pose changes never flash. */
export function preloadStickers() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Object.values(STICKERS).forEach((s) => {
    const uri = Image.resolveAssetSource?.(s.src)?.uri ?? (typeof s.src === 'string' ? s.src : (s.src as { uri?: string })?.uri);
    if (uri) Image.prefetch(uri).catch(() => {});
  });
}

interface Props {
  name: StickerName;
  /** Height in px; the width follows the sticker's own shape. */
  size: number;
  /** Gentle up-and-down float. */
  float?: boolean;
  /** Pops in when it first appears and every time the pose changes. */
  pop?: boolean;
  /** A little extra on a pose change: wiggle (waving) or bounce (celebrating). */
  accent?: 'wiggle' | 'bounce' | null;
  /** Floor shadow under full-body poses. */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Sticker({ name, size, float, pop = true, accent, shadow, style }: Props) {
  const reduced = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(pop ? 0 : 1)).current;
  const extra = useRef(new Animated.Value(0)).current;
  const { src, ratio } = STICKERS[name];

  useEffect(() => {
    if (reduced || !float) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(bob, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, float, reduced]);

  useEffect(() => {
    if (!pop || reduced) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 5, tension: 140, useNativeDriver: native }).start();
    if (accent) {
      extra.setValue(0);
      Animated.sequence(
        accent === 'wiggle'
          ? [
              Animated.timing(extra, { toValue: 1, duration: 160, useNativeDriver: native }),
              Animated.timing(extra, { toValue: -1, duration: 200, useNativeDriver: native }),
              Animated.timing(extra, { toValue: 1, duration: 200, useNativeDriver: native }),
              Animated.timing(extra, { toValue: 0, duration: 160, useNativeDriver: native }),
            ]
          : [
              Animated.timing(extra, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: native }),
              Animated.timing(extra, { toValue: 0, duration: 380, easing: Easing.bounce, useNativeDriver: native }),
              Animated.timing(extra, { toValue: 0.5, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: native }),
              Animated.timing(extra, { toValue: 0, duration: 300, easing: Easing.bounce, useNativeDriver: native }),
            ]
      ).start();
    }
  }, [name, pop, accent, reduced, enter, extra]);

  const translateY = Animated.add(
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.05] }),
    accent === 'bounce' ? extra.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.16] }) : new Animated.Value(0)
  );
  const rotate = accent === 'wiggle' ? extra.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) : '0deg';
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[{ width: size * ratio, height: size + (shadow ? size * 0.06 : 0), alignItems: 'center' }, style]}>
      <Animated.View style={{ width: size * ratio, height: size, opacity: enter, transform: [{ translateY }, { rotate }, { scale }] }}>
        <Image source={src} style={{ width: size * ratio, height: size }} resizeMode="contain" />
      </Animated.View>
      {shadow && (
        <Animated.View
          style={{
            width: size * 0.42,
            height: size * 0.05,
            borderRadius: size,
            backgroundColor: 'rgba(5,5,40,0.22)',
            marginTop: -size * 0.025,
            transform: [{ scaleX: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) }],
          }}
        />
      )}
    </View>
  );
}
