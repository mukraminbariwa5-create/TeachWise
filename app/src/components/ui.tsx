import { type ReactNode } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { create } from 'zustand';
import { tr } from '@/lib/i18n';
import { tap } from '@/lib/ui';
import { useIsWide, useLayoutSize } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, shadowStyle, space, text } from '@/theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { FadeIn } from './Motion';
import { AppBar, PageHeader } from './PageHeader';
import { Txt } from './Txt';
import { WiseMascot, type Mood } from './WiseMascot';

/**
 * A standard page: title header (computer header or phone app bar), scrolling content,
 * consistent padding and a readable maximum width. Sets the browser tab title too.
 */
export function Screen({
  title,
  subtitle,
  children,
  maxWidth = 820,
  onBack,
  right,
  refreshing,
  onRefresh,
  onScroll,
  scrollEventThrottle,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
  onBack?: () => void;
  right?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onScroll?: (e: any) => void;
  scrollEventThrottle?: number;
}) {
  const wide = useIsWide();
  useTitle(title);
  return (
    <ScrollView
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
      contentContainerStyle={{ paddingHorizontal: wide ? 52 : space.lg, paddingTop: wide ? 40 : 22, paddingBottom: wide ? 120 : 32, gap: space.lg, width: '100%', maxWidth: wide ? maxWidth + 104 : undefined, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      {wide ? (
        <View style={{ gap: space.xs }}>
          {onBack && (
            <Pressable accessibilityRole="button" onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 }}>
              <Icon name="arrowLeft" size={16} color={colors.accent} strokeWidth={2.2} />
              <Txt weight="semibold" size={text.body} color={colors.accent}>{tr('Back', 'Bumalik')}</Txt>
            </Pressable>
          )}
          <PageHeader title={title}>{right}</PageHeader>
          {subtitle ? <Txt size={text.bodyLg} color={colors.muted}>{subtitle}</Txt> : null}
        </View>
      ) : (
        <AppBar title={title} subtitle={subtitle} onBack={onBack} right={right} />
      )}
      {children}
    </ScrollView>
  );
}

/** A titled group of rows inside one card, like iOS / Android settings. */
export function Section({ title, footer, children, style }: { title?: string; footer?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space.xs }, style]}>
      {title ? (
        <Txt weight="semibold" size={text.small} color={colors.muted} style={{ letterSpacing: 0.8, marginLeft: space.xxs, textTransform: 'uppercase' }} accessibilityRole="header">
          {title}
        </Txt>
      ) : null}
      <View style={[{ backgroundColor: colors.card, borderRadius: 22, overflow: 'hidden' }, shadowStyle('soft')]}>{children}</View>
      {footer ? <Txt size={text.small} color={colors.muted} style={{ marginHorizontal: space.xxs, lineHeight: 18 }}>{footer}</Txt> : null}
    </View>
  );
}

/** One row in a Section: icon, title, optional subtitle and a value, chevron or switch on the right. */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  danger,
  toggle,
  last,
  right,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  last?: boolean;
  right?: ReactNode;
}) {
  const press = toggle ? () => toggle.onChange(!toggle.value) : onPress;
  const content = (
    <>
      {icon && (
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: danger ? colors.dangerBg : colors.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={19} color={danger ? colors.danger : colors.accent} strokeWidth={1.9} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt weight="medium" size={text.bodyLg} color={danger ? colors.danger : colors.text}>{title}</Txt>
        {subtitle ? <Txt size={text.small} color={colors.muted} style={{ lineHeight: 18 }}>{subtitle}</Txt> : null}
      </View>
      {value ? <Txt size={text.body} color={colors.muted} numberOfLines={1} style={{ maxWidth: '40%' }}>{value}</Txt> : null}
      {right}
      {toggle ? (
        <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: toggle.value ? colors.navy : colors.track, alignItems: toggle.value ? 'flex-end' : 'flex-start', justifyContent: 'center' }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' }} />
        </View>
      ) : onPress ? (
        <Icon name="chevronRight" size={16} color={colors.muted} strokeWidth={2.2} />
      ) : null}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 60, paddingVertical: 10, paddingHorizontal: space.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderSoft };
  if (!press) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityState={toggle ? { checked: toggle.value } : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={() => {
        tap();
        press();
      }}
      style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [style, { backgroundColor: pressed ? colors.track : hovered ? colors.surface : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

/** Segmented choice, e.g. System · Light · Dark. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { key: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.borderSoft }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (!on) {
                tap();
                onChange(o.key);
              }
            }}
            style={[{ flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8 }, on ? { backgroundColor: colors.card, ...shadowStyle('soft') } : null]}
          >
            {o.icon && <Icon name={o.icon} size={16} color={on ? colors.accent : colors.muted} strokeWidth={2} />}
            <Txt weight={on ? 'semibold' : 'medium'} size={text.body} color={on ? colors.text : colors.muted}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet on phones, centred dialog on computers. */
export function Sheet({ visible, onClose, title, children, maxWidth = 480 }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; maxWidth?: number }) {
  const phone = useLayoutSize() === 'phone';
  return (
    <Modal visible={visible} transparent animationType={phone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.45)', justifyContent: phone ? 'flex-end' : 'center', alignItems: 'center', padding: phone ? 0 : space.lg }}>
        <Pressable
          onPress={() => {}}
          style={[
            { width: '100%', maxWidth: phone ? undefined : maxWidth, maxHeight: phone ? '90%' : '85%', backgroundColor: colors.card, borderRadius: 28, borderBottomLeftRadius: phone ? 0 : 28, borderBottomRightRadius: phone ? 0 : 28, padding: space.lg, gap: space.md },
            shadowStyle('lift'),
          ]}
        >
          {phone && <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.track, marginTop: -6 }} />}
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Txt weight="bold" size={text.h3} style={{ flex: 1 }} accessibilityRole="header">{title}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={16} color={colors.textSoft} strokeWidth={2.2} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------- confirm dialog

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  mood?: Mood;
}
const useConfirm = create<{ open: (ConfirmOptions & { resolve: (v: boolean) => void }) | null }>(() => ({ open: null }));

/** Ask before something important: `if (await confirm({ title: 'Log out?' })) …` */
export function confirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useConfirm.setState({ open: { ...o, resolve } }));
}

/** Mounted once in the root layout. */
export function ConfirmHost() {
  const open = useConfirm((s) => s.open);
  if (!open) return null;
  const close = (v: boolean) => {
    open.resolve(v);
    useConfirm.setState({ open: null });
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(false)}>
      <Pressable onPress={() => close(false)} style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
        <Pressable onPress={() => {}} style={[{ width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 26, padding: space.xl, gap: space.md, alignItems: 'center' }, shadowStyle('lift')]}>
          <FadeIn>
            <WiseMascot size={96} mood={open.mood ?? (open.danger ? 'worried' : 'think')} float={false} />
          </FadeIn>
          <Txt weight="bold" size={text.h3} style={{ textAlign: 'center' }} accessibilityRole="header">{open.title}</Txt>
          {open.message ? <Txt size={text.body} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 22 }}>{open.message}</Txt> : null}
          <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.xxs }}>
            <Button title={open.cancelLabel ?? tr('Cancel', 'Kanselahin')} variant="outline" onPress={() => close(false)} style={{ flex: 1 }} />
            <Button title={open.confirmLabel ?? tr('Continue', 'Magpatuloy')} onPress={() => close(true)} style={[{ flex: 1.2 }, open.danger ? { backgroundColor: colors.danger } : null]} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------- small pieces

/** Empty or finished state with Professor Wise. */
export function EmptyState({ mood = 'think', title, message, action }: { mood?: Mood; title: string; message?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <FadeIn style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
      <WiseMascot size={150} mood={mood} />
      <Txt weight="semibold" size={text.h3} style={{ textAlign: 'center' }}>{title}</Txt>
      {message ? <Txt size={text.body} color={colors.muted} style={{ textAlign: 'center', maxWidth: 380, lineHeight: 22 }}>{message}</Txt> : null}
      {action ? <Button title={action.label} variant="outline" onPress={action.onPress} style={{ marginTop: space.xs }} /> : null}
    </FadeIn>
  );
}

/** Number tile for dashboards. */
export interface StatDelta {
  /** Change since the comparison point, e.g. +0.21. */
  value: number;
  /** What it's compared with, e.g. "since Prelim". */
  caption: string;
  /** How to print the change (default: one or two decimals). */
  format?: (n: number) => string;
}

/**
 * A number tile: icon, value, label, then the most useful extra it has:
 * a trend chip ("▲ 0.47 since Prelim"), a progress bar, or a plain hint.
 * `empty` replaces a bare dash with a friendly line. `compact` is the smaller phone version.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'navy',
  delta,
  spark,
  progress,
  empty,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
  tone?: 'navy' | 'green' | 'orange' | 'brand';
  delta?: StatDelta | null;
  /** Small trend line from oldest to newest (shown with 2+ points). */
  spark?: number[];
  /** 0–1, drawn as a thin bar under the value. */
  progress?: number;
  /** Shown instead of the hint when there's no value yet, e.g. "No reviews yet". */
  empty?: string;
  compact?: boolean;
}) {
  const bg = { navy: colors.chip, green: colors.successBg, orange: colors.pendingBg, brand: colors.brandSoft }[tone];
  const fg = { navy: colors.accent, green: colors.successFg, orange: colors.pendingFg, brand: colors.accent }[tone];
  const isEmpty = !!empty && (value === '—' || value === '-' || value === '');
  const up = delta ? delta.value > 0.004 : false;
  const down = delta ? delta.value < -0.004 : false;
  const fmt = delta?.format ?? ((n: number) => Math.abs(n).toFixed(Math.abs(n) < 0.1 ? 2 : 1).replace(/\.0$/, ''));
  const a11y = `${label}: ${isEmpty ? empty : value}${delta ? `, ${up ? tr('up', 'tumaas') : down ? tr('down', 'bumaba') : tr('no change', 'walang pagbabago')} ${fmt(delta.value)} ${delta.caption}` : ''}${hint && !isEmpty ? `. ${hint}` : ''}`;

  return (
    <View
      style={[
        compact
          ? { width: 172, backgroundColor: colors.card, borderRadius: 22, padding: space.md, gap: 6 }
          : { flex: 1, minWidth: 170, backgroundColor: colors.card, borderRadius: 24, padding: space.lg, gap: space.xs },
        shadowStyle('soft'),
      ]}
      accessible
      accessibilityLabel={a11y}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: compact ? 12 : 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={compact ? 17 : 20} color={fg} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1 }} />
        {spark && spark.length >= 2 && !compact ? <Sparkline values={spark} color={down ? colors.urgentFg : colors.successFg} /> : null}
      </View>
      {isEmpty ? (
        <Txt weight="semibold" size={compact ? text.title : text.h3} color={colors.muted} style={{ marginTop: compact ? 2 : 6, marginBottom: compact ? 0 : 2 }}>{empty}</Txt>
      ) : (
        <Txt weight="bold" size={compact ? text.h2 : text.h1} style={{ letterSpacing: -0.5 }}>{value}</Txt>
      )}
      <Txt weight="medium" size={compact ? text.small : text.body} color={colors.textSoft} numberOfLines={compact ? 1 : 2}>{label}</Txt>
      {progress !== undefined && !isEmpty ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden', marginTop: 4 }}>
          <View style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: fg }} />
        </View>
      ) : null}
      {delta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          <View style={{ height: 24, paddingHorizontal: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: up ? colors.successBg : down ? colors.urgentBg : colors.track }}>
            <Icon name={up ? 'trendUp' : down ? 'trendDown' : 'arrowUp'} size={13} color={up ? colors.successFg : down ? colors.urgentFg : colors.muted} strokeWidth={2.4} />
            <Txt weight="bold" size={text.caption} color={up ? colors.successFg : down ? colors.urgentFg : colors.muted}>{up || down ? fmt(delta.value) : tr('Same', 'Pareho')}</Txt>
          </View>
          <Txt size={text.small} color={colors.muted} numberOfLines={1}>{delta.caption}</Txt>
        </View>
      ) : hint && !isEmpty ? (
        <Txt size={text.small} color={colors.muted} numberOfLines={compact ? 1 : 2}>{hint}</Txt>
      ) : null}
    </View>
  );
}

/** A row of StatCards: wraps on computers, scrolls sideways on phones so the lists below show up sooner. */
export function StatRow({ children }: { children: ReactNode }) {
  const phone = useLayoutSize() === 'phone';
  if (!phone) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 6 }}>
      {children}
    </ScrollView>
  );
}

/** A tiny line chart for a StatCard. */
export function Sparkline({ values, color, width = 84, height = 32 }: { values: number[]; color: string; width?: number; height?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 4 - ((v - min) / span) * (height - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Path d={d} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
      </Svg>
    </View>
  );
}

/** Small coloured label. */
export function Pill({ label, tone = 'navy' }: { label: string; tone?: 'navy' | 'green' | 'orange' | 'red' | 'grey' }) {
  const bg = { navy: colors.chip, green: colors.successBg, orange: colors.pendingBg, red: colors.dangerBg, grey: colors.track }[tone];
  const fg = { navy: colors.accent, green: colors.successFg, orange: colors.pendingFg, red: colors.danger, grey: colors.textSoft }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: bg, justifyContent: 'center' }}>
      <Txt weight="semibold" size={text.caption} color={fg}>{label}</Txt>
    </View>
  );
}

/** A dashboard card with a title row and an optional "See all" style link. */
export function Panel({ title, subtitle, action, children, style }: { title: string; subtitle?: string; action?: { label: string; onPress: () => void }; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: 26, padding: space.lg, gap: space.md }, shadowStyle('soft'), style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt weight="semibold" size={text.title} accessibilityRole="header">{title}</Txt>
          {subtitle ? <Txt size={text.small} color={colors.muted}>{subtitle}</Txt> : null}
        </View>
        {action ? (
          <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 }}>
            <Txt weight="semibold" size={text.body} color={colors.accent}>{action.label}</Txt>
            <Icon name="chevronRight" size={14} color={colors.accent} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** One anonymous comment, used on teacher dashboards, feedback and reports. */
export function CommentCard({ comment, rating, meta, elevated }: { comment: string; rating: number | null; meta?: string; elevated?: boolean }) {
  return (
    <View style={[{ backgroundColor: elevated ? colors.card : colors.surface, borderRadius: 18, padding: space.md, gap: space.xs }, elevated ? shadowStyle('soft') : null]}>
      <Txt size={text.body} color={colors.text} style={{ lineHeight: 22 }}>{`“${comment}”`}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {rating != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="sparkle" size={13} color={colors.accent} strokeWidth={2} />
            <Txt weight="semibold" size={text.small} color={colors.textSoft}>{rating.toFixed(1)}</Txt>
          </View>
        )}
        {meta ? <Txt size={text.small} color={colors.muted} numberOfLines={1} style={{ flex: 1 }}>{meta}</Txt> : null}
      </View>
    </View>
  );
}

/** A filter chip (selected = navy). Lay several out in a horizontal ScrollView. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{ height: 38, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? colors.navy : colors.card, borderWidth: 1, borderColor: on ? colors.navy : colors.borderSoft }}
    >
      <Txt weight="semibold" size={text.small} color={on ? '#FFFFFF' : colors.textSoft}>{label}</Txt>
    </Pressable>
  );
}
