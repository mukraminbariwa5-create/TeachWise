import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useAdminDelete, useAdminList, useAdminSave, type ApprovedId, type Section } from '@/api/admin';
import { DataList, SearchBox, Toolbar } from '@/components/admin/DataList';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Chip, confirm, Pill, Screen, Sheet } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, fonts, space, text } from '@/theme';

type Filter = 'all' | 'waiting' | 'registered';

/** Student IDs allowed to create an account. Paste a list from a spreadsheet to add many at once. */
export default function ApprovedIdsScreen() {
  const list = useAdminList<ApprovedId>('whitelist');
  const del = useAdminDelete('whitelist');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [importing, setImporting] = useState(false);
  const scrollHide = useScrollHide();

  const all = list.data?.data ?? [];
  const waiting = all.filter((w) => !w.registered).length;
  const rows = all.filter((w) => (filter === 'all' || (filter === 'registered') === w.registered) && (!q || `${w.id_number} ${w.name ?? ''}`.toLowerCase().includes(q.toLowerCase())));

  const remove = async (w: ApprovedId) => {
    if (!(await confirm({ title: tr(`Remove ${w.id_number}?`, `Alisin ang ${w.id_number}?`), message: w.registered ? tr('Their account stays. They just can’t be used to sign up again.', 'Mananatili ang account nila. Hindi na lang ito magagamit para mag-sign up ulit.') : tr('This ID won’t be able to create an account.', 'Hindi na makakagawa ng account ang ID na ito.'), confirmLabel: tr('Remove', 'Alisin'), danger: true }))) return;
    del.mutate(w.id, { onSuccess: () => toast({ title: tr('Removed', 'Naalis'), tone: 'success' }) });
  };

  return (
    <Screen title={tr('Approved IDs', 'Mga aprubadong ID')} subtitle={tr('Only these student IDs can create an account', 'Ang mga student ID lang na ito ang makakagawa ng account')} maxWidth={1000} {...scrollHide}>
      <Toolbar onAdd={() => setImporting(true)} addLabel={tr('Add IDs', 'Magdagdag ng ID')}>
        <SearchBox value={q} onChange={setQ} placeholder={tr('Search ID or name', 'Hanapin ang ID o pangalan')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          <Chip label={tr(`All (${all.length})`, `Lahat (${all.length})`)} on={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={tr(`Not signed up (${waiting})`, `Hindi pa nag-sign up (${waiting})`)} on={filter === 'waiting'} onPress={() => setFilter('waiting')} />
          <Chip label={tr(`Signed up (${all.length - waiting})`, `Naka-sign up (${all.length - waiting})`)} on={filter === 'registered'} onPress={() => setFilter('registered')} />
        </ScrollView>
      </Toolbar>
      <DataList
        rows={rows}
        keyOf={(w) => w.id}
        loading={list.isLoading}
        empty={q || filter !== 'all' ? { title: tr('No matches', 'Walang tugma'), mood: 'think' } : { title: tr('No approved IDs yet', 'Wala pang aprubadong ID'), message: tr('Add the student IDs from the registrar so students can sign up.', 'Idagdag ang mga student ID mula sa registrar para makapag-sign up ang mga estudyante.'), action: { label: tr('Add IDs', 'Magdagdag ng ID'), onPress: () => setImporting(true) } }}
        columns={[
          { label: tr('ID number', 'ID number'), render: (w) => w.id_number },
          { label: tr('Name', 'Pangalan'), flex: 1.6, render: (w) => w.name ?? '—', phone: true },
          { label: tr('Section', 'Section'), render: (w) => w.section?.label ?? '—', phone: true },
          { label: tr('Status', 'Status'), render: (w) => (w.registered ? <Pill label={tr('Signed up', 'Naka-sign up')} tone="green" /> : <Pill label={tr('Not yet', 'Hindi pa')} tone="orange" />), phone: true },
        ]}
        right={(w) => <Button title={tr('Remove', 'Alisin')} variant="outline" onPress={() => remove(w)} />}
      />
      <ImportSheet visible={importing} onClose={() => setImporting(false)} />
    </Screen>
  );
}

interface Parsed {
  id_number: string;
  name: string | null;
  section_id: number | null;
  sectionText: string | null;
}

/** Turns pasted lines into entries: "ID", "ID, Name" or "ID, Name, Section" (commas or tabs). */
function parse(raw: string, sections: Section[]): Parsed[] {
  const byLabel = new Map(sections.map((s) => [s.label.replace(/\s+/g, '').toLowerCase(), s.id]));
  const seen = new Set<string>();
  return raw
    .split(/\r?\n/)
    .map((line) => line.split(/\t|,|;/).map((p) => p.trim()))
    .filter((p) => p[0] && !/^id/i.test(p[0]))
    .map(([id, name, section]) => ({
      id_number: id,
      name: name || null,
      sectionText: section || null,
      section_id: section ? (byLabel.get(section.replace(/\s+/g, '').toLowerCase()) ?? null) : null,
    }))
    .filter((p) => (seen.has(p.id_number) ? false : (seen.add(p.id_number), true)));
}

function ImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const sections = useAdminList<Section>('sections');
  const save = useAdminSave('whitelist');
  const [raw, setRaw] = useState('');
  const entries = useMemo(() => parse(raw, sections.data?.data ?? []), [raw, sections.data]);
  const unknown = entries.filter((e) => e.sectionText && !e.section_id);

  const submit = () =>
    save.mutate(
      { body: { entries: entries.map(({ id_number, name, section_id }) => ({ id_number, name, section_id })) } },
      {
        onSuccess: (r) => {
          toast({ title: String(r.message ?? tr('IDs added', 'Naidagdag ang mga ID')), tone: 'success', mood: 'cheer' });
          setRaw('');
          onClose();
        },
        onError: (e) => toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t add the IDs.', 'Hindi naidagdag ang mga ID.') }),
      }
    );

  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Add approved IDs', 'Magdagdag ng aprubadong ID')} maxWidth={620}>
      <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>
        {tr('Paste one student per line. Copy straight from Excel or Google Sheets: ID number, then name and section if you have them.', 'Isang estudyante bawat linya. Kopyahin mula sa Excel o Google Sheets: ID number, saka pangalan at section kung meron.')}
      </Txt>
      <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: space.sm }}>
        <Txt size={text.small} color={colors.muted} style={{ fontFamily: fonts.regular }}>{'2026-0101, Nadia Hassan, BSIT 4A\n2026-0102, Omar Tulawie, BSIT 4A\n2026-0103'}</Txt>
      </View>
      <TextInput
        value={raw}
        onChangeText={setRaw}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={tr('Paste IDs here…', 'I-paste ang mga ID dito…')}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={tr('IDs to add', 'Mga ID na idadagdag')}
        style={{ minHeight: 160, maxHeight: 280, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.md, fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlignVertical: 'top' }}
      />
      {entries.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="checkCircle" size={16} color={colors.successFg} strokeWidth={2.2} />
          <Txt weight="semibold" size={text.body} color={colors.successFg}>{tr(`${entries.length} ID${entries.length === 1 ? '' : 's'} ready to add`, `${entries.length} ID ang handang idagdag`)}</Txt>
        </View>
      )}
      {unknown.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, backgroundColor: colors.pendingBg, borderRadius: 14, padding: space.sm }}>
          <Icon name="info" size={16} color={colors.pendingFg} />
          <Txt size={text.small} color={colors.pendingFg} style={{ flex: 1, lineHeight: 19 }}>
            {tr(`Section not found for ${unknown.length} line(s) (e.g. “${unknown[0].sectionText}”). They’ll be added without a section; students can pick it when signing up.`, `Hindi nahanap ang section sa ${unknown.length} linya (hal. “${unknown[0].sectionText}”). Idadagdag sila nang walang section; puwede nilang piliin ito sa pag-sign up.`)}
          </Txt>
        </View>
      )}
      <Button title={entries.length ? tr(`Add ${entries.length} ID${entries.length === 1 ? '' : 's'}`, `Idagdag ang ${entries.length} ID`) : tr('Add IDs', 'Idagdag ang mga ID')} size="lg" disabled={!entries.length} loading={save.isPending} onPress={submit} />
    </Sheet>
  );
}
