import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { Criterion, TrendPoint } from '@/api/types';
import { tr } from '@/lib/i18n';
import { colors, space, text } from '@/theme';
import { Pill } from './ui';
import { Txt } from './Txt';

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2));

/**
 * Average rating per evaluation period (1–5), oldest on the left.
 * One series, so no legend: the card title names it. The latest value is labelled,
 * the rest show on hover (computer) or tap (phone).
 */
export function TrendChart({ points, height = 180 }: { points: TrendPoint[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const padL = 28;
  const padR = 16;
  const padT = 26;
  const padB = 30;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const y = (v: number) => padT + ((5 - v) / 4) * plotH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.average).toFixed(1)}`).join(' ');
  const shown = active ?? points.length - 1;
  const step = points.length > 1 ? plotW / (points.length - 1) : plotW;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
      accessible
      accessibilityLabel={tr('Rating trend: ', 'Trend ng rating: ') + points.map((p) => `${p.period} ${fmt(p.average)}`).join(', ')}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            {[1, 2, 3, 4, 5].map((v) => (
              <Line key={v} x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke={colors.borderSoft} strokeWidth={1} />
            ))}
            {active !== null && <Line x1={x(active)} x2={x(active)} y1={padT} y2={padT + plotH} stroke={colors.border} strokeWidth={1} />}
            {points.length > 1 && <Path d={path} stroke={colors.navy} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
            {points.map((p, i) => (
              <Circle key={p.period_id} cx={x(i)} cy={y(p.average)} r={i === shown ? 6 : 4} fill={colors.navy} stroke={colors.card} strokeWidth={2} />
            ))}
          </Svg>

          {[1, 3, 5].map((v) => (
            <Txt key={v} size={text.caption} color={colors.muted} style={{ position: 'absolute', left: 0, top: y(v) - 8, width: padL - 8, textAlign: 'right' }}>{String(v)}</Txt>
          ))}

          {points.map((p, i) => (
            <Txt
              key={p.period_id}
              size={text.caption}
              color={i === shown ? colors.text : colors.muted}
              weight={i === shown ? 'semibold' : 'regular'}
              numberOfLines={1}
              style={{ position: 'absolute', top: height - padB + 8, left: x(i) - Math.min(step, 120) / 2, width: Math.min(step, 120), textAlign: 'center' }}
            >
              {p.period}
            </Txt>
          ))}

          {/* Value label for the latest (or hovered) point */}
          <View pointerEvents="none" style={{ position: 'absolute', left: Math.min(Math.max(x(shown) - 60, 0), width - 120), top: Math.max(y(points[shown].average) - 44, -6), width: 120, alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.inverse, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' }}>
              <Txt weight="bold" size={text.small} color={colors.onInverse}>{fmt(points[shown].average)}</Txt>
              {active !== null && <Txt size={11} color={colors.onInverse}>{tr(`${points[shown].responses} responses`, `${points[shown].responses} sagot`)}</Txt>}
            </View>
          </View>

          {/* Hit areas: wider than the dots */}
          {points.map((p, i) => (
            <Pressable
              key={p.period_id}
              accessibilityLabel={`${p.period}: ${fmt(p.average)}`}
              onPress={() => setActive(active === i ? null : i)}
              {...(Platform.OS === 'web' ? { onHoverIn: () => setActive(i), onHoverOut: () => setActive(null) } : {})}
              style={{ position: 'absolute', top: 0, bottom: 0, left: x(i) - step / 2, width: Math.max(step, 44) }}
            />
          ))}
        </>
      )}
    </View>
  );
}

/**
 * Average per criterion as thin horizontal bars on a fixed 1–5 scale.
 * The strongest and weakest are named with a label, not only by colour.
 */
export function CriteriaBars({ criteria }: { criteria: Criterion[] }) {
  if (criteria.length === 0) return null;
  const sorted = [...criteria].sort((a, b) => a.average - b.average);
  const weakest = criteria.length > 1 ? sorted[0].question_id : null;
  const strongest = criteria.length > 1 ? sorted[sorted.length - 1].question_id : null;

  return (
    <View style={{ gap: space.md }}>
      {criteria.map((c) => {
        const pct = Math.max(0, Math.min(1, (c.average - 1) / 4));
        return (
          <View key={c.question_id} style={{ gap: 6 }} accessible accessibilityLabel={`${c.category}: ${fmt(c.average)} / 5`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Txt weight="medium" size={text.body} numberOfLines={1} style={{ flexShrink: 1 }}>{c.category}</Txt>
              {c.question_id === weakest && <Pill label={tr('Focus area', 'Pagtuunan')} tone="orange" />}
              {c.question_id === strongest && <Pill label={tr('Strongest', 'Pinakamalakas')} tone="green" />}
              <View style={{ flex: 1 }} />
              <Txt weight="semibold" size={text.body}>{fmt(c.average)}</Txt>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' }}>
              <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.navy }} />
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt size={text.caption} color={colors.muted}>{tr('1 · Poor', '1 · Mahina')}</Txt>
        <Txt size={text.caption} color={colors.muted}>{tr('5 · Excellent', '5 · Napakahusay')}</Txt>
      </View>
    </View>
  );
}

/** The lowest-rated criterion, for Professor Wise's suggestion. */
export function weakestCriterion(criteria: Criterion[]): Criterion | null {
  if (criteria.length < 2) return null;
  return [...criteria].sort((a, b) => a.average - b.average)[0];
}

export { fmt as formatRating };
