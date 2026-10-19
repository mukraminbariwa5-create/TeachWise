import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { tr } from '@/lib/i18n';
import { tap } from '@/lib/ui';
import { useLayoutSize } from '@/lib/useLayout';
import { colors, fonts, shadowStyle, space, text } from '@/theme';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { EmptyState } from '../ui';
import type { Mood } from '../WiseMascot';

export interface Column<T> {
  label: string;
  /** Text or a small element for the cell. */
  render: (row: T) => ReactNode;
  flex?: number;
  align?: 'left' | 'right';
  /** Hidden in the phone card (keep the important ones). */
  phone?: boolean;
}

/**
 * A table on computers and a stack of cards on phones, from the same columns.
 * The first column is the card title; columns marked `phone` show under it.
 */
export function DataList<T>({
  rows,
  columns,
  keyOf,
  onPress,
  right,
  loading,
  empty,
  hasMore,
  loadingMore,
  onMore,
}: {
  rows: T[];
  columns: Column<T>[];
  keyOf: (row: T) => string | number;
  onPress?: (row: T) => void;
  /** Buttons or a status on the right of each row. */
  right?: (row: T) => ReactNode;
  loading?: boolean;
  empty?: { title: string; message?: string; mood?: Mood; action?: { label: string; onPress: () => void } };
  hasMore?: boolean;
  loadingMore?: boolean;
  onMore?: () => void;
}) {
  const phone = useLayoutSize() === 'phone';

  if (loading && rows.length === 0) return <ActivityIndicator color={colors.accent} style={{ marginVertical: space.xxl }} />;
  if (rows.length === 0 && empty) return <EmptyState mood={empty.mood ?? 'shy'} title={empty.title} message={empty.message} action={empty.action} />;

  const more = hasMore ? (
    <View style={{ alignItems: 'center', paddingVertical: space.md }}>
      <Button title={tr('Load more', 'Mag-load pa')} variant="outline" loading={loadingMore} onPress={onMore} />
    </View>
  ) : null;

  if (phone) {
    const [first, ...rest] = columns;
    return (
      <View style={{ gap: space.sm }}>
        {rows.map((row) => {
          const body = (
            <>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Cell value={first.render(row)} bold />
                {rest
                  .filter((c) => c.phone)
                  .map((c) => (
                    <View key={c.label} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Txt size={text.small} color={colors.muted}>{`${c.label}:`}</Txt>
                      <Cell value={c.render(row)} small />
                    </View>
                  ))}
              </View>
              {right?.(row)}
              {onPress && !right && <Icon name="chevronRight" size={16} color={colors.muted} strokeWidth={2.2} />}
            </>
          );
          const style = [{ backgroundColor: colors.card, borderRadius: 20, padding: space.md, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm }, shadowStyle('soft')];
          return onPress ? (
            <Pressable
              key={keyOf(row)}
              accessibilityRole="button"
              onPress={() => {
                tap();
                onPress(row);
              }}
              style={({ pressed }: { pressed?: boolean }) => [...style, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              {body}
            </Pressable>
          ) : (
            <View key={keyOf(row)} style={style}>
              {body}
            </View>
          );
        })}
        {more}
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden' }, shadowStyle('soft')]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
        {columns.map((c) => (
          <Txt key={c.label} weight="semibold" size={text.caption} color={colors.muted} style={{ flex: c.flex ?? 1, textAlign: c.align ?? 'left' }}>{c.label}</Txt>
        ))}
        {right && <View style={{ width: 120 }} />}
      </View>
      {rows.map((row, i) => {
        const cells = (
          <>
            {columns.map((c, ci) => (
              <View key={c.label} style={{ flex: c.flex ?? 1, alignItems: c.align === 'right' ? 'flex-end' : 'flex-start', minWidth: 0 }}>
                <Cell value={c.render(row)} bold={ci === 0} />
              </View>
            ))}
            {right && <View style={{ width: 120, alignItems: 'flex-end' }}>{right(row)}</View>}
          </>
        );
        const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, paddingHorizontal: space.lg, minHeight: 58, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.borderSoft };
        return onPress ? (
          <Pressable key={keyOf(row)} accessibilityRole="button" onPress={() => onPress(row)} style={({ hovered }: { hovered?: boolean }) => [style, { backgroundColor: hovered ? colors.surface : 'transparent' }]}>
            {cells}
          </Pressable>
        ) : (
          <View key={keyOf(row)} style={style}>
            {cells}
          </View>
        );
      })}
      {more}
    </View>
  );
}

function Cell({ value, bold, small }: { value: ReactNode; bold?: boolean; small?: boolean }) {
  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <Txt weight={bold ? 'semibold' : 'regular'} size={small ? text.small : text.body} color={bold ? colors.text : colors.textSoft} numberOfLines={bold ? 2 : 1} style={{ flexShrink: 1 }}>
        {String(value)}
      </Txt>
    );
  }
  return <>{value ?? null}</>;
}

/** Search box + chips + an Add button, above a list. */
export function Toolbar({ children, onAdd, addLabel }: { children?: ReactNode; onAdd?: () => void; addLabel?: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space.sm }}>
      <View style={{ flex: 1, minWidth: 240, gap: space.sm }}>{children}</View>
      {onAdd && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            onAdd();
          }}
          style={({ hovered }: { hovered?: boolean }) => ({ height: 50, paddingHorizontal: 20, borderRadius: 16, backgroundColor: hovered ? colors.navyDeep : colors.navy, flexDirection: 'row', alignItems: 'center', gap: 8 })}
        >
          <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Txt weight="semibold" size={text.body} color="#FFFFFF">{addLabel ?? tr('Add', 'Magdagdag')}</Txt>
        </Pressable>
      )}
    </View>
  );
}

/** Compact search box for list toolbars. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={{ height: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? tr('Search', 'Hanapin')}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={placeholder ?? tr('Search', 'Hanapin')}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1, minWidth: 0, height: 48, fontFamily: fonts.regular, fontSize: 15, color: colors.text }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tr('Clear search', 'I-clear')} onPress={() => onChange('')} hitSlop={8}>
          <Icon name="close" size={16} color={colors.muted} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}
