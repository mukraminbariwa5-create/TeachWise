import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ApiError } from '@/api/client';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/ui';
import { colors, space, text } from '@/theme';
import { Button } from '../Button';
import { Field, PasswordField, Toggle, type FieldState } from '../form/Field';
import { Icon, type IconName } from '../Icon';
import { Txt } from '../Txt';
import { confirm, Sheet } from '../ui';

export type FormValues = Record<string, string | number | boolean | null>;

export interface Option {
  value: string | number | null;
  label: string;
  hint?: string;
}

interface Base {
  key: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Only show this field when it returns true, e.g. Section for students. */
  visibleIf?: (v: FormValues) => boolean;
}

export type FieldDef =
  | (Base & { kind: 'text' | 'email' | 'number' | 'textarea'; icon?: IconName; placeholder?: string; max?: number })
  | (Base & { kind: 'password'; placeholder?: string })
  | (Base & { kind: 'datetime' | 'date'; placeholder?: string })
  | (Base & { kind: 'select'; options: Option[]; icon?: IconName; searchable?: boolean })
  | (Base & { kind: 'toggle' });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What's wrong with a value right now, or null. Runs as you type. */
function check(f: FieldDef, v: FormValues[string]): string | null {
  const empty = v === null || v === undefined || v === '';
  if (empty) return f.required ? tr('Required', 'Kailangan') : null;
  if (f.kind === 'email' && !EMAIL.test(String(v))) return tr('Enter a valid email address', 'Maglagay ng tamang email');
  if (f.kind === 'number' && !/^\d+$/.test(String(v))) return tr('Numbers only', 'Numero lang');
  if (f.kind === 'datetime' && !DATETIME.test(String(v))) return tr('Use the format 2026-10-20 08:00', 'Gamitin ang format na 2026-10-20 08:00');
  if (f.kind === 'date' && !DATE.test(String(v))) return tr('Use the format 2026-10-20', 'Gamitin ang format na 2026-10-20');
  if (f.kind === 'password' && String(v).length < 8) return tr('At least 8 characters', 'Hindi bababa sa 8 character');
  return null;
}

/**
 * Add / edit form in a sheet, built from a list of fields. Checks values as you type,
 * shows the server's messages next to the right field, and offers Delete when editing.
 */
export function FormSheet({
  visible,
  onClose,
  title,
  fields,
  initial,
  submitLabel,
  onSubmit,
  onDelete,
  deleteLabel,
  note,
  extraAction,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  fields: FieldDef[];
  initial: FormValues;
  submitLabel?: string;
  onSubmit: (values: FormValues) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
  deleteLabel?: string;
  note?: string;
  /** Another action for the record, e.g. "Give a temporary password". */
  extraAction?: { label: string; onPress: () => void };
}) {
  const [values, setValues] = useState<FormValues>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [server, setServer] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setValues(initial);
      setTouched({});
      setServer({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const shown = fields.filter((f) => !f.visibleIf || f.visibleIf(values));
  const problems = useMemo(() => Object.fromEntries(shown.map((f) => [f.key, check(f, values[f.key])])), [shown, values]);
  const valid = shown.every((f) => !problems[f.key]);

  const set = (key: string, v: FormValues[string]) => {
    setValues((s) => ({ ...s, [key]: v }));
    setServer((s) => ({ ...s, [key]: [] }));
  };

  const submit = async () => {
    setTouched(Object.fromEntries(shown.map((f) => [f.key, true])));
    if (!valid) return;
    setBusy(true);
    try {
      const body: FormValues = {};
      shown.forEach((f) => {
        const v = values[f.key];
        body[f.key] = f.kind === 'number' && v !== '' && v !== null ? Number(v) : v === '' ? null : v;
      });
      await onSubmit(body);
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setServer(e.errors);
        if (!Object.keys(e.errors).length) toast({ title: e.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    if (!(await confirm({ title: deleteLabel ?? tr('Delete?', 'Burahin?'), message: tr('This can’t be undone.', 'Hindi na ito maibabalik.'), confirmLabel: tr('Delete', 'Burahin'), danger: true }))) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t delete.', 'Hindi nabura.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} maxWidth={560}>
      {note ? <Txt size={text.small} color={colors.muted} style={{ lineHeight: 19 }}>{note}</Txt> : null}
      {shown.map((f) => {
        const err = server[f.key]?.[0] ?? (touched[f.key] ? problems[f.key] : null);
        const state: FieldState = err ? 'invalid' : 'idle';
        const v = values[f.key];
        const blur = () => setTouched((t) => ({ ...t, [f.key]: true }));

        if (f.kind === 'toggle') return <Toggle key={f.key} label={f.label} hint={f.hint} value={!!v} onChange={(x) => set(f.key, x)} />;
        if (f.kind === 'select') return <SelectField key={f.key} def={f} value={v as Option['value']} onChange={(x) => set(f.key, x)} error={err ?? undefined} />;
        if (f.kind === 'password')
          return <PasswordField key={f.key} label={f.label} value={String(v ?? '')} onChangeText={(x) => set(f.key, x)} onBlur={blur} autoComplete="password-new" placeholder={f.placeholder} hint={f.hint} state={state} message={err ?? undefined} />;
        return (
          <Field
            key={f.key}
            label={f.required ? f.label : `${f.label} ${tr('(optional)', '(opsyonal)')}`}
            icon={'icon' in f && f.icon ? f.icon : f.kind === 'email' ? 'mail' : f.kind === 'datetime' || f.kind === 'date' ? 'calendar' : 'edit'}
            value={v === null || v === undefined ? '' : String(v)}
            onChangeText={(x) => set(f.key, x)}
            onBlur={blur}
            placeholder={'placeholder' in f ? f.placeholder : f.kind === 'datetime' ? '2026-10-20 08:00' : f.kind === 'date' ? '2026-10-20' : undefined}
            keyboardType={f.kind === 'number' ? 'number-pad' : f.kind === 'email' ? 'email-address' : 'default'}
            autoCapitalize={f.kind === 'email' ? 'none' : 'sentences'}
            multiline={f.kind === 'textarea'}
            max={'max' in f ? f.max : undefined}
            hint={f.hint}
            state={state}
            message={err ?? undefined}
          />
        );
      })}
      {extraAction && <Button title={extraAction.label} variant="outline" onPress={extraAction.onPress} disabled={busy} />}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xxs }}>
        {onDelete && <Button title={tr('Delete', 'Burahin')} variant="outline" onPress={remove} disabled={busy} style={{ borderColor: colors.danger }} />}
        <Button title={submitLabel ?? tr('Save', 'I-save')} size="lg" loading={busy} onPress={submit} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

/** A choice field: short lists show as chips, long ones open an inline searchable list. */
function SelectField({ def, value, onChange, error }: { def: Extract<FieldDef, { kind: 'select' }>; value: Option['value']; onChange: (v: Option['value']) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = def.options.find((o) => o.value === value);
  const label = def.required ? def.label : `${def.label} ${tr('(optional)', '(opsyonal)')}`;

  if (def.options.length <= 4 && !def.searchable) {
    return (
      <View style={{ gap: 8 }}>
        <Txt weight="medium" size={14} color={colors.textSoft}>{label}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }} accessibilityRole="radiogroup">
          {def.options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable key={String(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)} style={{ minHeight: 42, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', borderWidth: 1.5, borderColor: on ? colors.navy : colors.border, backgroundColor: on ? colors.chip : colors.card }}>
                <Txt weight={on ? 'semibold' : 'medium'} size={text.body} color={on ? colors.accent : colors.textSoft}>{o.label}</Txt>
              </Pressable>
            );
          })}
        </View>
        {error ? <Txt size={13} color={colors.danger}>{error}</Txt> : def.hint ? <Txt size={13} color={colors.muted}>{def.hint}</Txt> : null}
      </View>
    );
  }

  const filtered = def.options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="medium" size={14} color={colors.textSoft}>{label}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${def.label}: ${current?.label ?? tr('not chosen', 'wala pang pinili')}`}
        onPress={() => setOpen((o) => !o)}
        style={{ minHeight: 54, borderRadius: 16, borderWidth: 1.5, borderColor: error ? colors.danger : open ? colors.navy : colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}
      >
        <Icon name={def.icon ?? 'list'} size={20} color={current ? colors.accent : colors.muted} />
        <Txt size={16} color={current ? colors.text : colors.placeholder} style={{ flex: 1 }} numberOfLines={1}>{current?.label ?? tr('Choose…', 'Pumili…')}</Txt>
        <Icon name="chevronDown" size={16} color={colors.muted} strokeWidth={2.2} />
      </Pressable>
      {open && (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface, padding: space.xs, gap: 4 }}>
          {def.options.length > 8 && <Field label={tr('Search', 'Hanapin')} icon="search" value={q} onChangeText={setQ} autoFocus />}
          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filtered.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={String(o.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ('');
                  }}
                  style={({ hovered }: { hovered?: boolean }) => ({ minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: on ? colors.chip : hovered ? colors.card : 'transparent' })}
                >
                  <View style={{ flex: 1 }}>
                    <Txt weight={on ? 'semibold' : 'regular'} size={text.body}>{o.label}</Txt>
                    {o.hint ? <Txt size={text.caption} color={colors.muted}>{o.hint}</Txt> : null}
                  </View>
                  {on && <Icon name="check" size={16} color={colors.accent} strokeWidth={2.6} />}
                </Pressable>
              );
            })}
            {filtered.length === 0 && <Txt size={text.body} color={colors.muted} style={{ padding: space.sm }}>{tr('No matches', 'Walang tugma')}</Txt>}
          </ScrollView>
        </View>
      )}
      {error ? <Txt size={13} color={colors.danger}>{error}</Txt> : def.hint ? <Txt size={13} color={colors.muted}>{def.hint}</Txt> : null}
    </View>
  );
}
