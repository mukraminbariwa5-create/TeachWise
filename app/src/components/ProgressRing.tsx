import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme';

/** Animates from 0 up to `target` over `ms` the first time it renders, and eases to new values. */
export function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const from = value;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);
  return value;
}

interface Props {
  /** 0 to 1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** Fill the ring from empty when it first appears. */
  animate?: boolean;
  children?: ReactNode;
}

/** The donut chart from the design, with anything centred inside it. */
export function ProgressRing({ value, size = 210, stroke = 30, color, track, animate = true, children }: Props) {
  const target = Math.min(1, Math.max(0, value));
  const animated = useCountUp(target);
  const v = animate ? animated : target;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? colors.track} strokeWidth={stroke} fill="none" />
        {v > 0.001 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color ?? colors.navy}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c * v} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ value, height = 10, color }: { value: number; height?: number; color?: string }) {
  const v = useCountUp(Math.min(1, Math.max(0, value)));
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: colors.track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(v * 100)}%` as `${number}%`, height: '100%', borderRadius: 999, backgroundColor: color ?? colors.navy }} />
    </View>
  );
}
