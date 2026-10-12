import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useClosePlatformMessage, usePlatformMessages, type PlatformMessage } from '@/api/platform';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { Chip, EmptyState, Pill, Screen } from '@/components/ui';
import { ago } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, shadowStyle, space, text } from '@/theme';

/** Messages and problem reports from school admins to the TeachWise team. */
export default function PlatformMessages() {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const q = usePlatformMessages(status);
  const close = useClosePlatformMessage();
  const scrollHide = useScrollHide();
  const rows = q.data?.data ?? [];

  return (
    <Screen title={tr('Messages', 'Mga mensahe')} subtitle={tr('From school admins: questions, problem reports and account requests', 'Mula sa mga admin ng paaralan: tanong, ulat ng problema at request sa account')} maxWidth={900} {...scrollHide}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        <Chip label={tr('To do', 'Gagawin')} on={status === 'open'} onPress={() => setStatus('open')} />
        <Chip label={tr('Done', 'Tapos')} on={status === 'closed'} onPress={() => setStatus('closed')} />
      </ScrollView>
      {rows.length === 0 && !q.isLoading ? (
        <EmptyState mood="happy" title={status === 'open' ? tr('All caught up', 'Wala nang naiwan') : tr('Nothing here yet', 'Wala pa rito')} />
      ) : (
        rows.map((m) => <MessageCard key={m.id} m={m} onDone={() => close.mutate(m.id, { onSuccess: () => toast({ title: tr('Marked as done', 'Minarkahang tapos'), tone: 'success' }) })} />)
      )}
    </Screen>
  );
}

function MessageCard({ m, onDone }: { m: PlatformMessage; onDone: () => void }) {
  const router = useRouter();
  const meta = (m.meta ?? {}) as { type?: string; app_version?: string; platform?: string; screen?: string };
  const deletion = meta.type === 'account_deletion';
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: 22, padding: space.md, gap: space.sm }, shadowStyle('soft')]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="semibold" size={text.body} numberOfLines={1}>{m.user?.name ?? tr('Deleted user', 'Burado na user')}</Txt>
          <Txt size={text.small} color={colors.muted} numberOfLines={1}>{[m.school?.name, m.user?.department, ago(m.created_at)].filter(Boolean).join(' · ')}</Txt>
        </View>
        <Pill label={deletion ? tr('Account deletion', 'Pagbura ng account') : m.kind === 'problem' ? tr('Problem', 'Problema') : tr('Question', 'Tanong')} tone={deletion ? 'red' : m.kind === 'problem' ? 'orange' : 'navy'} />
      </View>
      <Txt size={text.body} style={{ lineHeight: 22 }} selectable>{m.message}</Txt>
      {(meta.platform || meta.app_version) && <Txt size={text.caption} color={colors.muted}>{[meta.platform, meta.app_version && `v${meta.app_version}`, meta.screen].filter(Boolean).join(' · ')}</Txt>}
      {m.status === 'open' && (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {m.user?.email && <Button title={tr('Reply by email', 'Sumagot sa email')} variant="outline" onPress={() => Linking.openURL(`mailto:${m.user!.email}?subject=${encodeURIComponent('TeachWise support')}`)} />}
          {m.school && <Button title={tr('Open school', 'Buksan ang paaralan')} variant="outline" onPress={() => router.push(`/platform/schools/${m.school!.id}` as Href)} />}
          <Button title={tr('Mark as done', 'Markahang tapos')} onPress={onDone} />
        </View>
      )}
    </View>
  );
}
