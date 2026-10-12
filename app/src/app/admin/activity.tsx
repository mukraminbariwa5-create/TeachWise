import { useState } from 'react';
import { View } from 'react-native';
import { useAdminPages, type AuditEntry, type ClientErrorEntry } from '@/api/admin';
import { DataList, SearchBox } from '@/components/admin/DataList';
import { useDebounced } from '@/components/form/Field';
import { Txt } from '@/components/Txt';
import { Screen, Segmented, Sheet } from '@/components/ui';
import { ago, dateTime } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { colors, fonts, space, text } from '@/theme';

type Tab = 'log' | 'errors';

/** Who changed what (audit log), and app crashes reported from people's devices. */
export default function ActivityScreen() {
  const [tab, setTab] = useState<Tab>('log');
  const scrollHide = useScrollHide();
  return (
    <Screen title={tr('Activity', 'Aktibidad')} subtitle={tr('Changes made by admins and problems reported by the app', 'Mga pagbabagong ginawa ng admin at mga problemang iniulat ng app')} maxWidth={1100} {...scrollHide}>
      <Segmented<Tab>
        label={tr('Show', 'Ipakita')}
        value={tab}
        onChange={setTab}
        options={[
          { key: 'log', label: tr('Activity log', 'Activity log'), icon: 'activity' },
          { key: 'errors', label: tr('App errors', 'Mga error'), icon: 'bug' },
        ]}
      />
      {tab === 'log' ? <AuditLog /> : <Errors />}
    </Screen>
  );
}

function AuditLog() {
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 350);
  const list = useAdminPages<AuditEntry>('activity', { search });
  return (
    <View style={{ gap: space.md }}>
      <SearchBox value={q} onChange={setQ} placeholder={tr('Search activity', 'Hanapin ang aktibidad')} />
      <DataList
        rows={list.data?.pages.flatMap((p) => p.data) ?? []}
        keyOf={(l) => l.id}
        loading={list.isLoading}
        hasMore={!!list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        onMore={() => list.fetchNextPage()}
        empty={{ title: search ? tr('No matches', 'Walang tugma') : tr('No activity yet', 'Wala pang aktibidad'), mood: 'working' }}
        columns={[
          { label: tr('What happened', 'Nangyari'), flex: 3, render: (l) => l.description },
          { label: tr('By', 'Ni'), flex: 1.3, render: (l) => l.user?.name ?? tr('System', 'System'), phone: true },
          { label: tr('When', 'Kailan'), flex: 1.2, render: (l) => ago(l.created_at), phone: true },
        ]}
      />
    </View>
  );
}

function Errors() {
  const list = useAdminPages<ClientErrorEntry>('app-errors');
  const [open, setOpen] = useState<ClientErrorEntry | null>(null);
  return (
    <>
      <DataList
        rows={list.data?.pages.flatMap((p) => p.data) ?? []}
        keyOf={(e) => e.id}
        loading={list.isLoading}
        hasMore={!!list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        onMore={() => list.fetchNextPage()}
        onPress={setOpen}
        empty={{ title: tr('No errors reported', 'Walang naiulat na error'), message: tr('If the app crashes on someone’s device, the details appear here.', 'Kapag nag-crash ang app sa device ng isang tao, lalabas dito ang detalye.'), mood: 'proud' }}
        columns={[
          { label: tr('Error', 'Error'), flex: 3, render: (e) => e.message },
          { label: tr('Screen', 'Screen'), flex: 1.2, render: (e) => e.screen ?? '—' },
          { label: tr('Device', 'Device'), render: (e) => [e.platform, e.app_version && `v${e.app_version}`].filter(Boolean).join(' · ') || '—', phone: true },
          { label: tr('When', 'Kailan'), render: (e) => ago(e.created_at), phone: true },
        ]}
      />
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={tr('Error details', 'Detalye ng error')} maxWidth={720}>
        {open && (
          <>
            <Txt weight="semibold" size={text.bodyLg} selectable>{open.message}</Txt>
            <Txt size={text.small} color={colors.muted}>{[dateTime(open.created_at), open.platform, open.app_version && `v${open.app_version}`, open.screen].filter(Boolean).join(' · ')}</Txt>
            {open.stack ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: space.md }}>
                <Txt size={12} color={colors.textSoft} selectable style={{ fontFamily: fonts.regular, lineHeight: 18 }}>{open.stack}</Txt>
              </View>
            ) : null}
          </>
        )}
      </Sheet>
    </>
  );
}
