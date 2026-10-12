import { useEffect, useRef } from 'react';
import { Animated, Platform, View, type DimensionValue } from 'react-native';
import { colors } from '@/theme';

/** A grey placeholder block that gently pulses while data loads. */
export function Bone({ width = '100%', height = 16, radius = 10 }: { width?: DimensionValue; height?: number; radius?: number }) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: colors.skeleton, opacity: pulse }} />;
}

/** Placeholder for a list row: circle + two lines. */
export function BoneRow({ avatar = 56 }: { avatar?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 12 }}>
      <Bone width={avatar} height={avatar} radius={avatar / 2} />
      <View style={{ flex: 1, gap: 10 }}>
        <Bone width="55%" height={16} />
        <Bone width="35%" height={12} />
      </View>
    </View>
  );
}
