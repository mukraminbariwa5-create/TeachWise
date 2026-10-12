import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useAdminDelete, useAdminList, useAdminSave } from '@/api/admin';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/ui';
import { space } from '@/theme';
import { ScreenState } from '../ScreenState';
import { DataList, SearchBox, Toolbar, type Column } from './DataList';
import { FormSheet, type FieldDef, type FormValues } from './FormSheet';
import type { Mood } from '../WiseMascot';

/**
 * A complete list + add / edit / delete for one admin resource
 * (sections, subjects, semesters, classes, periods, questions…).
 */
export function CrudSection<T extends { id: number }>({
  resource,
  params,
  columns,
  fields,
  toForm,
  blank,
  noun,
  search,
  empty,
  right,
  filters,
  note,
  canDelete = true,
}: {
  resource: string;
  params?: Record<string, string | number | null | undefined>;
  columns: Column<T>[];
  fields: FieldDef[];
  /** Form values for editing a row. */
  toForm: (row: T) => FormValues;
  /** Form values for a new one. */
  blank: FormValues;
  /** "section", "subject"… used in titles and messages. */
  noun: string;
  search?: (row: T, q: string) => boolean;
  empty: { title: string; message?: string; mood?: Mood };
  right?: (row: T) => ReactNode;
  filters?: ReactNode;
  note?: string;
  canDelete?: boolean;
}) {
  const list = useAdminList<T>(resource, params);
  const save = useAdminSave(resource);
  const del = useAdminDelete(resource);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [q, setQ] = useState('');

  if (!list.data && !list.isLoading) return <ScreenState error={list.error} onRetry={() => list.refetch()} />;
  const rows = (list.data?.data ?? []).filter((r) => !q || !search || search(r, q.toLowerCase()));
  const row = editing && editing !== 'new' ? editing : null;

  return (
    <View style={{ gap: space.md }}>
      <Toolbar onAdd={() => setEditing('new')} addLabel={tr(`Add ${noun}`, `Magdagdag ng ${noun}`)}>
        {search && <SearchBox value={q} onChange={setQ} />}
        {filters}
      </Toolbar>
      <DataList
        rows={rows}
        columns={columns}
        keyOf={(r) => r.id}
        onPress={(r) => setEditing(r)}
        right={right}
        loading={list.isLoading}
        empty={q ? { title: tr('No matches', 'Walang tugma'), message: tr('Try a different search.', 'Subukan ang ibang hanap.'), mood: 'think' } : { ...empty, action: { label: tr(`Add ${noun}`, `Magdagdag ng ${noun}`), onPress: () => setEditing('new') } }}
      />
      <FormSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={row ? tr(`Edit ${noun}`, `I-edit ang ${noun}`) : tr(`New ${noun}`, `Bagong ${noun}`)}
        fields={fields}
        initial={row ? toForm(row) : blank}
        note={note}
        onSubmit={async (body) => {
          await save.mutateAsync({ id: row?.id, body });
          toast({ title: row ? tr('Saved', 'Na-save') : tr(`${cap(noun)} added`, `Naidagdag ang ${noun}`), tone: 'success' });
        }}
        onDelete={
          row && canDelete
            ? async () => {
                const r = await del.mutateAsync(row.id);
                toast({ title: r.message, tone: 'success' });
              }
            : undefined
        }
        deleteLabel={tr(`Delete this ${noun}?`, `Burahin ang ${noun} na ito?`)}
      />
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
