import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { tr } from '@/lib/i18n';
import { useLayoutSize } from '@/lib/useLayout';
import { colors, fonts, shadowStyle } from '@/theme';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { WiseMascot } from '../WiseMascot';

export interface Section {
  id: number;
  course: string;
  year_level: number;
  name: string;
}

export const sectionLabel = (s: Section) => `${s.course} ${s.year_level}-${s.name}`;

const ordinal = (n: number) =>
  tr(`${['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`} year`, `${['Unang', 'Ikalawang', 'Ikatlong', 'Ikaapat na', 'Ikalimang'][n - 1] ?? `Ika-${n} na`} taon`);

/**
 * Year level from a student ID like 2023-0101: a student who started in 2023 is in
 * 4th year during the 2026–27 school year (which starts in June).
 */
export function suggestedYear(idNumber: string): number | null {
  const m = /^(\d{4})-/.exec(idNumber.trim());
  if (!m) return null;
  const now = new Date();
  const schoolYearStart = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const level = schoolYearStart - Number(m[1]) + 1;
  return level >= 1 && level <= 5 ? level : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');

/**
 * Pick a section: search box, "Suggested for you" (from the year in the student ID),
 * then every section grouped by course and year as big tappable chips.
 */
export function SectionSheet({
  visible,
  sections,
  loading,
  value,
  year,
  onPick,
  onClose,
}: {
  visible: boolean;
  sections: Section[];
  loading: boolean;
  value: number | null;
  year: number | null;
  onPick: (s: Section) => void;
  onClose: () => void;
}) {
  const phone = useLayoutSize() === 'phone';
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = norm(q);
    return needle ? sections.filter((s) => norm(sectionLabel(s)).includes(needle) || norm(`${s.year_level}${s.name}`).includes(needle)) : sections;
  }, [q, sections]);

  const groups = useMemo(() => {
    const byCourse = new Map<string, Map<number, Section[]>>();
    for (const s of filtered) {
      const years = byCourse.get(s.course) ?? new Map<number, Section[]>();
      years.set(s.year_level, [...(years.get(s.year_level) ?? []), s]);
      byCourse.set(s.course, years);
    }
    return [...byCourse.entries()].map(([course, years]) => ({ course, years: [...years.entries()].sort((a, b) => a[0] - b[0]) }));
  }, [filtered]);

  const suggested = !q && year ? sections.filter((s) => s.year_level === year) : [];

  const chip = (s: Section, wide = false) => {
    const on = s.id === value;
    return (
      <Pressable
        key={s.id}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={sectionLabel(s)}
        onPress={() => {
          onPick(s);
          setQ('');
        }}
        style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({
          minWidth: wide ? 108 : 76,
          height: 48,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: on ? colors.navy : hovered ? colors.border : colors.borderSoft,
          backgroundColor: on ? colors.navy : hovered ? colors.surface : colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        {on && <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />}
        <Txt weight="semibold" size={15} color={on ? '#FFFFFF' : colors.text}>{wide ? sectionLabel(s) : `${s.year_level}-${s.name}`}</Txt>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType={phone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.45)', justifyContent: phone ? 'flex-end' : 'center', alignItems: 'center', padding: phone ? 0 : 20 }}>
        <Pressable
          onPress={() => {}}
          style={[
            { width: '100%', maxWidth: phone ? undefined : 520, maxHeight: phone ? '88%' : '80%', backgroundColor: colors.card, borderRadius: 28, borderBottomLeftRadius: phone ? 0 : 28, borderBottomRightRadius: phone ? 0 : 28, padding: 20, gap: 14 },
            shadowStyle('lift'),
          ]}
        >
          {phone && <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.track, marginTop: -6 }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Txt weight="bold" size={21} style={{ flex: 1 }} accessibilityRole="header">{tr('Choose your section', 'Piliin ang section mo')}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={16} color={colors.textSoft} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={{ height: 50, borderRadius: 999, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
            <Icon name="search" size={20} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              autoFocus={!phone}
              placeholder={tr('Search, e.g. 4-A or BSCS', 'Hanapin, hal. 4-A o BSCS')}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={tr('Search sections', 'Hanapin ang section')}
              autoCapitalize="characters"
              style={{ flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.regular, fontSize: 16, color: colors.text }}
            />
            {q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={tr('Clear search', 'Burahin ang hinahanap')} onPress={() => setQ('')} hitSlop={8}>
                <Icon name="close" size={16} color={colors.muted} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {loading && <Txt color={colors.muted}>{tr('Loading sections…', 'Kinukuha ang mga section…')}</Txt>}

            {suggested.length > 0 && (
              <View style={{ gap: 10, backgroundColor: colors.brandSoft, borderRadius: 20, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="check" size={16} color={colors.accent} strokeWidth={2} />
                  <Txt weight="semibold" size={14} color={colors.accent}>{tr(`Suggested for you · ${ordinal(year!)}`, `Mungkahi para sa iyo · ${ordinal(year!)}`)}</Txt>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{suggested.map((s) => chip(s, true))}</View>
              </View>
            )}

            {groups.map((g) => (
              <View key={g.course} style={{ gap: 10 }}>
                <Txt weight="bold" size={13} color={colors.muted} >{g.course}</Txt>
                {g.years.map(([y, list]) => (
                  <View key={y} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Txt weight="medium" size={14} color={colors.textSoft} style={{ width: 74 }}>{ordinal(y)}</Txt>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{list.map((s) => chip(s))}</View>
                  </View>
                ))}
              </View>
            ))}

            {!loading && filtered.length === 0 && (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
                <WiseMascot size={110} mood="think" />
                <Txt weight="semibold" size={16}>{tr('No section matches', 'Walang tugmang section')}</Txt>
                <Txt size={14} color={colors.muted} style={{ textAlign: 'center' }}>{tr('Try just the year and letter, like “4A”.', 'Subukan ang taon at letra lang, gaya ng “4A”.')}</Txt>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
