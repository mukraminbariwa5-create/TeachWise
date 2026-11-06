import { useState } from 'react';
import { Redirect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/auth/store';
import { FormSheet } from '@/components/admin/FormSheet';
import { Button } from '@/components/Button';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { confirm, Screen } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/ui';

export default function DepartmentTransfers() {
  const dept = useAuth((s) => s.user?.admin_scope === 'department');
  return dept ? <Redirect href="/admin" /> : <TransferForm />;
}

function TransferForm() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'transfer-options'], queryFn: () => api<{ departments: { id: number; name: string }[]; sections: { id: number; label: string; department_id: number }[] }>('/admin/transfers/options') });
  if (!query.data) return <ScreenState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />;
  return <Screen title={tr('Department transfers', 'Paglipat ng departamento')} subtitle={tr('Coordinate with both deans before recording a transfer.', 'Makipag-ugnayan muna sa dalawang dean bago magtala ng paglipat.')}>
    <Txt>{tr('Use this only for an approved move between departments. Deans manage ordinary account changes. Previous evaluations stay intact. Teachers must finish their current-semester class handover before moving.', 'Gamitin lamang para sa aprubadong paglipat ng departamento. Ang dean ang namamahala sa karaniwang pagbabago. Mananatili ang dating evaluation. Kailangang maayos muna ang kasalukuyang klase ng guro.')}</Txt>
    <Button title={tr('Record department transfer', 'Itala ang paglipat')} onPress={() => setOpen(true)} />
    <FormSheet visible={open} onClose={() => setOpen(false)} title={tr('Record department transfer', 'Itala ang paglipat')} initial={{ id_number: '', role: 'student', department_id: null, section_id: null, reason: '' }}
      fields={[
        { key: 'id_number', label: tr('School ID number', 'ID number sa paaralan'), kind: 'text', required: true, max: 30 },
        { key: 'role', label: tr('Account type', 'Uri ng account'), kind: 'select', required: true, options: [{ value: 'student', label: tr('Student', 'Estudyante') }, { value: 'teacher', label: tr('Teacher', 'Guro') }] },
        { key: 'department_id', label: tr('Destination department', 'Lilipatang departamento'), kind: 'select', searchable: true, required: true, options: query.data.departments.map((d) => ({ value: d.id, label: d.name })) },
        { key: 'section_id', label: tr('Destination section (students)', 'Lilipatang section (estudyante)'), kind: 'select', searchable: true, required: true, visibleIf: (v) => v.role === 'student', options: query.data.sections.map((s) => ({ value: s.id, label: s.label, hint: query.data.departments.find((d) => d.id === s.department_id)?.name })) },
        { key: 'reason', label: tr('Approved transfer reason', 'Dahilan ng aprubadong paglipat'), kind: 'textarea', required: true, max: 1000 },
      ]}
      onSubmit={async (body) => {
        if (!(await confirm({ title: tr('Confirm department transfer?', 'Kumpirmahin ang paglipat?'), message: tr('Confirm that both departments have approved this move. It changes the person’s department access and future evaluation assignments.', 'Kumpirmahing aprubado ito ng dalawang departamento. Magbabago ang access at susunod na mga evaluation.'), confirmLabel: tr('Record transfer', 'Itala ang paglipat') }))) return;
        const result = await api<{ message: string }>('/admin/transfers', { method: 'POST', body: { ...body, confirmed: true } });
        await qc.invalidateQueries({ queryKey: ['admin'] });
        toast({ title: result.message, tone: 'success' });
      }} />
  </Screen>;
}
