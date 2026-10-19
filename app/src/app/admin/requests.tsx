import { useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/store';
import { useAdminCounts, useAdminPages, useCloseMessage, usePasswordRequests, useResolvePasswordRequest, type InboxMessage, type PasswordRequest } from '@/api/admin';
import { DataList } from '@/components/admin/DataList';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Chip, confirm, EmptyState, Pill, Screen, Segmented, Sheet } from '@/components/ui';
import { WiseMascot } from '@/components/WiseMascot';
import { ago } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, shadowStyle, space, text } from '@/theme';

type Tab = 'passwords' | 'inbox';

/** Password resets and messages from users, in one place. */
export default function RequestsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'inbox' ? 'inbox' : 'passwords');
  const counts = useAdminCounts();
  const dept = useAuth((s) => s.user?.admin_scope === 'department');
  const scrollHide = useScrollHide();
  return (
    <Screen title={tr('Requests', 'Mga request')} subtitle={tr('Password resets, messages and problem reports', 'Pag-reset ng password, mga mensahe at ulat ng problema')} maxWidth={1000} {...scrollHide}>
      {!dept && (
      <Segmented<Tab>
        label={tr('Show', 'Ipakita')}
        value={tab}
        onChange={setTab}
        options={[
          { key: 'passwords', label: counts.passwords ? tr(`Passwords (${counts.passwords})`, `Password (${counts.passwords})`) : tr('Passwords', 'Password'), icon: 'key' },
          { key: 'inbox', label: counts.inbox ? tr(`Messages (${counts.inbox})`, `Mensahe (${counts.inbox})`) : tr('Messages', 'Mensahe'), icon: 'inbox' },
        ]}
      />
      )}
      {tab === 'passwords' || dept ? <Passwords /> : <Inbox />}
    </Screen>
  );
}

function Passwords() {
  const list = usePasswordRequests();
  const resolve = useResolvePasswordRequest();
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);

  const reset = async (r: PasswordRequest) => {
    const ok = await confirm({
      title: tr(`Reset ${r.user.name}’s password?`, `I-reset ang password ni ${r.user.name}?`),
      message: tr(`Check that this is really ${r.user.id_number}${r.user.section ? ` from ${r.user.section.label}` : ''}. They’ll be signed out everywhere and get a temporary password.`, `Siguraduhing si ${r.user.id_number}${r.user.section ? ` ng ${r.user.section.label}` : ''} talaga ito. Masa-sign out sila sa lahat ng device at bibigyan ng temporary password.`),
      confirmLabel: tr('Reset password', 'I-reset'),
      mood: 'stern',
    });
    if (!ok) return;
    resolve.mutate(r.id, {
      onSuccess: (res) => setTemp({ name: r.user.name, password: res.temporary_password }),
      onError: (e) => toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t reset the password.', 'Hindi na-reset ang password.') }),
    });
  };

  return (
    <>
      <DataList
        rows={list.data?.data ?? []}
        keyOf={(r) => r.id}
        loading={list.isLoading}
        empty={{ title: tr('No password requests', 'Walang request sa password'), message: tr('When someone taps “Forgot password?”, their request shows up here.', 'Kapag may pumindot ng “Nakalimutan ang password?”, lalabas dito ang request nila.'), mood: 'happy' }}
        columns={[
          { label: tr('Person', 'Tao'), flex: 2, render: (r) => r.user.name },
          { label: tr('ID number', 'ID number'), render: (r) => r.user.id_number, phone: true },
          { label: tr('Section / role', 'Section / role'), render: (r) => r.user.section?.label ?? r.user.role, phone: true },
          { label: tr('Requested', 'Hiniling'), render: (r) => ago(r.requested_at), phone: true },
        ]}
        right={(r) => (r.status === 'pending' ? <Button title={tr('Reset', 'I-reset')} onPress={() => reset(r)} /> : <Pill label={tr('Done', 'Tapos')} tone="green" />)}
      />
      <Sheet visible={!!temp} onClose={() => setTemp(null)} title={tr('Temporary password', 'Temporary password')}>
        {temp && (
          <View style={{ alignItems: 'center', gap: space.md }}>
            <WiseMascot size={110} mood="wink" float={false} />
            <Txt size={text.body} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 22 }}>
              {tr(`Give this to ${temp.name} in person or by a private message. They should change it right after signing in.`, `Ibigay ito kay ${temp.name} nang personal o sa pribadong mensahe. Dapat nila itong palitan pagka-sign in.`)}
            </Txt>
            <View style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: space.md, paddingHorizontal: space.xl, borderWidth: 1.5, borderColor: colors.borderSoft, borderStyle: 'dashed' }}>
              <Txt weight="bold" size={text.h1} selectable style={{ letterSpacing: 2 }}>{temp.password}</Txt>
            </View>
            {Platform.OS === 'web' && (
              <Button
                title={tr('Copy', 'Kopyahin')}
                variant="outline"
                onPress={() => {
                  navigator.clipboard?.writeText(temp.password);
                  toast({ title: tr('Copied', 'Nakopya'), tone: 'success' });
                }}
              />
            )}
            <Txt size={text.small} color={colors.muted} style={{ textAlign: 'center' }}>{tr('This is shown only once.', 'Isang beses lang ito ipapakita.')}</Txt>
          </View>
        )}
      </Sheet>
    </>
  );
}

function Inbox() {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const list = useAdminPages<InboxMessage>('inbox', { status });
  const close = useCloseMessage();
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={{ gap: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        <Chip label={tr('To do', 'Gagawin')} on={status === 'open'} onPress={() => setStatus('open')} />
        <Chip label={tr('Done', 'Tapos')} on={status === 'closed'} onPress={() => setStatus('closed')} />
      </ScrollView>
      {rows.length === 0 && !list.isLoading ? (
        <EmptyState mood="happy" title={status === 'open' ? tr('No open messages', 'Walang bukas na mensahe') : tr('Nothing here yet', 'Wala pa rito')} message={status === 'open' ? tr('Messages and problem reports from users show up here.', 'Lalabas dito ang mga mensahe at ulat ng problema mula sa mga user.') : undefined} />
      ) : (
        rows.map((m) => <MessageCard key={m.id} m={m} onDone={() => close.mutate(m.id, { onSuccess: () => toast({ title: tr('Marked as done', 'Minarkahang tapos'), tone: 'success' }) })} />)
      )}
      {list.hasNextPage && <Button title={tr('Load more', 'Mag-load pa')} variant="outline" loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} style={{ alignSelf: 'center' }} />}
    </View>
  );
}

function MessageCard({ m, onDone }: { m: InboxMessage; onDone: () => void }) {
  const deletion = m.meta && (m.meta as { type?: string }).type === 'account_deletion';
  const kind = deletion ? tr('Account deletion', 'Pagbura ng account') : m.kind === 'problem' ? tr('Problem report', 'Ulat ng problema') : tr('Message', 'Mensahe');
  const meta = m.meta as { app_version?: string; platform?: string; screen?: string } | null;
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: 22, padding: space.md, gap: space.sm }, shadowStyle('soft')]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {m.user ? <Avatar name={m.user.name} initials={m.user.initials} size={40} /> : <Icon name="user" size={24} color={colors.muted} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="semibold" size={text.body} numberOfLines={1}>{m.user?.name ?? tr('Deleted user', 'Burado na user')}</Txt>
          <Txt size={text.small} color={colors.muted} numberOfLines={1}>{[m.user?.id_number, m.user?.section?.label ?? m.user?.role, ago(m.created_at)].filter(Boolean).join(' · ')}</Txt>
        </View>
        <Pill label={kind} tone={deletion ? 'red' : m.kind === 'problem' ? 'orange' : 'navy'} />
      </View>
      <Txt size={text.body} style={{ lineHeight: 22 }} selectable>{m.message}</Txt>
      {meta && (meta.app_version || meta.platform) && <Txt size={text.caption} color={colors.muted}>{[meta.platform, meta.app_version && `v${meta.app_version}`, meta.screen].filter(Boolean).join(' · ')}</Txt>}
      {m.status === 'open' && (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {m.user?.email && (
            <Button
              title={tr('Reply by email', 'Sumagot sa email')}
              variant="outline"
              onPress={() => {
                Linking.openURL(`mailto:${m.user!.email}?subject=${encodeURIComponent('TeachWise')}`);
              }}
            />
          )}
          <Button title={tr('Mark as done', 'Markahang tapos')} onPress={onDone} />
        </View>
      )}
    </View>
  );
}
