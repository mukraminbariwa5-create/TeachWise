import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { usePlatformSchools } from '@/api/platform';
import { DataList, SearchBox, Toolbar } from '@/components/admin/DataList';
import { useDebounced } from '@/components/form/Field';
import { Chip, Pill, Screen } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { space } from '@/theme';

type Status = 'pending' | 'active' | 'suspended' | null;

/** Every school on TeachWise, with applications first. */
export default function PlatformSchools() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 350);
  const list = usePlatformSchools(status, search);
  const scrollHide = useScrollHide();

  return (
    <Screen title={tr('Schools', 'Mga paaralan')} subtitle={tr('Approve applications, send first-admin invites, pause or remove schools.', 'Aprubahan ang aplikasyon, magpadala ng invite sa unang admin, i-pause o alisin ang paaralan.')} maxWidth={1100} {...scrollHide}>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder={tr('Search school, code or place', 'Hanapin ang paaralan, code o lugar')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          {([null, 'pending', 'active', 'suspended'] as Status[]).map((s) => (
            <Chip key={String(s)} label={s === null ? tr('All', 'Lahat') : s === 'pending' ? tr('Waiting', 'Naghihintay') : s === 'active' ? tr('Active', 'Aktibo') : tr('Paused', 'Naka-pause')} on={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
      </Toolbar>
      <DataList
        rows={list.data?.data ?? []}
        keyOf={(s) => s.id}
        loading={list.isLoading}
        onPress={(s) => router.push(`/platform/schools/${s.id}` as Href)}
        empty={{ title: search || status ? tr('No matches', 'Walang tugma') : tr('No schools yet', 'Wala pang paaralan'), mood: 'think' }}
        columns={[
          { label: tr('School', 'Paaralan'), flex: 2.4, render: (s) => s.name },
          { label: tr('Code', 'Code'), render: (s) => s.code },
          { label: tr('Place', 'Lugar'), flex: 1.2, render: (s) => s.location ?? '—', phone: true },
          { label: tr('Students', 'Estudyante'), align: 'right', render: (s) => String(s.students ?? 0), phone: true },
          { label: tr('Status', 'Status'), render: (s) => <Pill label={s.status === 'active' ? tr('Active', 'Aktibo') : s.status === 'pending' ? tr('Waiting', 'Naghihintay') : tr('Paused', 'Naka-pause')} tone={s.status === 'active' ? 'green' : s.status === 'pending' ? 'orange' : 'grey'} />, phone: true },
        ]}
      />
    </Screen>
  );
}
