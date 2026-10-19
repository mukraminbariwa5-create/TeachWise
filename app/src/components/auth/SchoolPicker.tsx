import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/api/client';
import type { PublicSchool } from '@/api/types';
import { tr } from '@/lib/i18n';
import { tap } from '@/lib/ui';
import { colors, space, text } from '@/theme';
import { Button } from '../Button';
import { Field, useDebounced } from '../form/Field';
import { Icon } from '../Icon';
import { SchoolBadge } from '../SchoolBadge';
import { Txt } from '../Txt';
import { Sheet } from '../ui';

/**
 * "Which school?" Search by name, place or school email, or type the code your school gave you.
 * Schools not on TeachWise yet can apply from here.
 */
export function SchoolPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (s: PublicSchool) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'search' | 'code'>('search');
  const [code, setCode] = useState('');
  const [results, setResults] = useState<PublicSchool[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = useDebounced(q.trim(), 300);

  useEffect(() => {
    if (search.length < 2) {
      setResults(null);
      return;
    }
    let alive = true;
    setBusy(true);
    api<{ data: PublicSchool[] }>(`/schools?q=${encodeURIComponent(search)}`, { token: null })
      .then((r) => alive && setResults(r.data))
      .catch(() => alive && setResults([]))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [search]);

  const choose = (s: PublicSchool) => {
    tap();
    onPick(s);
    onClose();
    setQ('');
    setCode('');
    setMode('search');
  };

  const findCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ school: PublicSchool }>(`/schools/${encodeURIComponent(code.trim())}`, { token: null });
      choose(r.school);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tr('Couldn’t check the code. Are you online?', 'Hindi ma-check ang code. Naka-online ka ba?'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Find your school', 'Hanapin ang paaralan mo')}>
      {mode === 'search' ? (
        <>
          <Field
            label={tr('School name, city or school email', 'Pangalan ng paaralan, lungsod o school email')}
            icon="search"
            value={q}
            onChangeText={setQ}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            placeholder={tr('e.g. Mindanao State University', 'hal. Mindanao State University')}
            right={busy ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
          />
          <View style={{ gap: 4 }}>
            {(results ?? []).map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`${s.name}${s.location ? `, ${s.location}` : ''}`}
                onPress={() => choose(s)}
                style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: 16, backgroundColor: pressed ? colors.track : hovered ? colors.surface : 'transparent' })}
              >
                <SchoolBadge school={s} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="semibold" size={text.bodyLg} numberOfLines={2}>{s.name}</Txt>
                  {s.location ? <Txt size={text.small} color={colors.muted}>{s.location}</Txt> : null}
                </View>
                <Icon name="chevronRight" size={16} color={colors.muted} strokeWidth={2.2} />
              </Pressable>
            ))}
            {results && results.length === 0 && !busy && (
              <Txt size={text.body} color={colors.muted} style={{ padding: space.sm, lineHeight: 22 }}>
                {tr('No school found. Check the spelling, try the city, or use the code from your school.', 'Walang nahanap. I-check ang spelling, subukan ang lungsod, o gamitin ang code mula sa paaralan mo.')}
              </Txt>
            )}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setMode('code')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
            <Icon name="key" size={18} color={colors.accent} />
            <Txt weight="semibold" size={text.body} color={colors.accent}>{tr('I have a school code', 'May school code ako')}</Txt>
          </Pressable>
        </>
      ) : (
        <>
          <Field
            label={tr('School code', 'School code')}
            icon="key"
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setError(null);
            }}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="MSUSULU"
            hint={tr('Your school shares this code (or a join link) with students.', 'Ibinabahagi ng paaralan mo ang code na ito (o join link) sa mga estudyante.')}
            state={error ? 'invalid' : 'idle'}
            message={error ?? undefined}
            onSubmitEditing={findCode}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title={tr('Back', 'Bumalik')} variant="outline" onPress={() => setMode('search')} />
            <Button title={tr('Find school', 'Hanapin')} loading={busy} disabled={code.length < 3} onPress={findCode} style={{ flex: 1 }} />
          </View>
        </>
      )}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: space.md, gap: 4 }}>
        <Txt size={text.small} color={colors.muted}>{tr('Is your school not on TeachWise yet?', 'Wala pa ba sa TeachWise ang paaralan mo?')}</Txt>
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            onClose();
            router.push('/register-school');
          }}
          style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Txt weight="semibold" size={text.body} color={colors.accent}>{tr('Register your school', 'Irehistro ang paaralan mo')}</Txt>
        </Pressable>
      </View>
    </Sheet>
  );
}

/** The chosen school above the sign-in / sign-up form, with "Change". */
export function SchoolBar({ school, onChange, optional }: { school: PublicSchool | null; onChange: () => void; optional?: boolean }) {
  if (!school) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onChange}
        style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: hovered ? colors.navy : colors.border, paddingHorizontal: space.md })}
      >
        <Icon name="search" size={20} color={colors.accent} />
        <Txt weight="semibold" size={text.body} color={colors.accent} style={{ flex: 1 }}>{tr('Choose your school', 'Piliin ang paaralan mo')}</Txt>
        {optional ? <Txt size={text.caption} color={colors.muted}>{tr('optional', 'opsyonal')}</Txt> : null}
      </Pressable>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, borderRadius: 18, backgroundColor: colors.surface, paddingHorizontal: space.sm, paddingVertical: 8 }}>
      <SchoolBadge school={school} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={text.caption} color={colors.muted}>{tr('School', 'Paaralan')}</Txt>
        <Txt weight="semibold" size={text.body} numberOfLines={1}>{school.name}</Txt>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Change school', 'Palitan ang paaralan')} onPress={onChange} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }}>
        <Txt weight="semibold" size={text.small} color={colors.accent}>{tr('Change', 'Palitan')}</Txt>
      </Pressable>
    </View>
  );
}
