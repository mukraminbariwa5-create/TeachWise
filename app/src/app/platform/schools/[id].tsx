import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { usePlatformAction, usePlatformSchool, type AdminInvite } from '@/api/platform';
import { Button } from '@/components/Button';
import { Field } from '@/components/form/Field';
import { InviteCodeSheet } from '@/components/InviteCodeSheet';
import { SchoolBadge } from '@/components/SchoolBadge';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { confirm, ListRow, Pill, Screen, Section, Sheet, StatCard } from '@/components/ui';
import { ago, shortDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, space, text } from '@/theme';

/** One school for the owner: the application, its numbers, admins, and approve / pause / delete. */
export default function PlatformSchool() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = usePlatformSchool(Number(id));
  const action = usePlatformAction();
  const scrollHide = useScrollHide();
  const [invite, setInvite] = useState<AdminInvite | null>(null);
  const [sheet, setSheet] = useState<'pause' | 'delete' | 'invite' | null>(null);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [who, setWho] = useState({ name: '', email: '' });
  const d = q.data;

  const run = (a: Parameters<typeof action.mutate>[0], after?: (r: { message?: string; invite?: AdminInvite }) => void) =>
    action.mutate(a, {
      onSuccess: (r) => {
        if (r.message) toast({ title: r.message, tone: 'success' });
        after?.(r);
      },
      onError: (e) => toast({ title: e instanceof ApiError ? e.firstMessage : tr('Something went wrong.', 'May mali.') }),
    });

  if (!d) return <ScreenState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} />;
  const s = d.school;
  const status = s.status === 'active' ? { label: tr('Active', 'Aktibo'), tone: 'green' as const } : s.status === 'pending' ? { label: tr('Waiting for approval', 'Naghihintay ng apruba'), tone: 'orange' as const } : { label: tr('Paused', 'Naka-pause'), tone: 'grey' as const };

  return (
    <Screen title={s.name} subtitle={[s.location, `${tr('Code', 'Code')} ${s.code}`].filter(Boolean).join(' · ')} maxWidth={900} onBack={() => (router.canGoBack() ? router.back() : router.replace('/platform/schools'))} {...scrollHide}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <SchoolBadge school={s} size={64} />
        <View style={{ flex: 1, gap: 6 }}>
          <Pill label={status.label} tone={status.tone} />
          <Txt size={text.small} color={colors.muted}>{s.approved_at ? tr(`Approved ${shortDate(s.approved_at)}`, `Inaprubahan ${shortDate(s.approved_at)}`) : s.applied_at ? tr(`Applied ${ago(s.applied_at)}`, `Nag-apply ${ago(s.applied_at)}`) : ''}</Txt>
        </View>
      </View>

      {s.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button
            title={tr('Approve and create admin invite', 'Aprubahan at gumawa ng invite')}
            size="lg"
            loading={action.isPending}
            onPress={async () => {
              if (await confirm({ title: tr(`Approve ${s.name}?`, `Aprubahan ang ${s.name}?`), message: tr('The school becomes active with the default evaluation form, and you get an invite code for its first admin.', 'Magiging aktibo ang paaralan na may default na form, at makakakuha ka ng invite code para sa unang admin.'), confirmLabel: tr('Approve', 'Aprubahan'), mood: 'proud' })) {
                run({ id: s.id, action: 'approve' }, (r) => r.invite && setInvite(r.invite));
              }
            }}
            style={{ flex: 1, minWidth: 240 }}
          />
          <Button
            title={tr('Reject', 'Tanggihan')}
            variant="outline"
            onPress={async () => {
              if (await confirm({ title: tr('Reject this application?', 'Tanggihan ang aplikasyon?'), message: tr('It will be removed. Let the person know by email.', 'Aalisin ito. Ipaalam sa tao sa email.'), confirmLabel: tr('Reject', 'Tanggihan'), danger: true })) {
                run({ id: s.id, action: 'reject' }, () => router.replace('/platform/schools'));
              }
            }}
          />
        </View>
      )}

      {s.status !== 'pending' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          <StatCard icon="users" label={tr('Students', 'Estudyante')} value={String(d.stats.students)} />
          <StatCard icon="book" tone="brand" label={tr('Teachers', 'Guro')} value={String(d.stats.teachers)} />
          <StatCard icon="checkCircle" tone="green" label={tr('Evaluations', 'Evaluation')} value={String(d.stats.evaluations)} hint={d.stats.last_active ? tr(`Last active ${ago(d.stats.last_active)}`, `Huling aktibo ${ago(d.stats.last_active)}`) : undefined} />
        </View>
      )}

      <Section title={tr('Application', 'Aplikasyon')}>
        <ListRow icon="user" title={s.contact_name ?? '—'} subtitle={s.contact_position ?? undefined} />
        <ListRow icon="mail" title={s.contact_email ?? '—'} subtitle={s.contact_phone ?? undefined} />
        <ListRow icon="users" title={tr('About how many students', 'Mga ilang estudyante')} value={s.student_count ? s.student_count.toLocaleString() : '—'} last={!s.message} />
        {s.message ? <ListRow icon="chat" title={tr('Message', 'Mensahe')} subtitle={s.message} last /> : null}
      </Section>

      {s.status !== 'pending' && (
        <Section title={tr('School admins', 'Mga admin ng paaralan')} footer={tr('Admins add teachers, students and classes themselves. Send a new invite if the first one was lost.', 'Ang mga admin ang nagdadagdag ng guro, estudyante at klase. Magpadala ng bagong invite kung nawala ang una.')}>
          {d.admins.map((a) => <ListRow key={a.id} icon="shield" title={a.name} subtitle={[a.username, a.email, a.department].filter(Boolean).join(' · ')} />)}
          {d.admin_invites.map((i) => <ListRow key={i.code} icon="key" title={i.code} subtitle={[i.name, i.usable ? tr('Waiting to be used', 'Hindi pa nagagamit') : tr('Expired', 'Expired')].filter(Boolean).join(' · ')} />)}
          <ListRow icon="plus" title={tr('New admin invite', 'Bagong admin invite')} onPress={() => setSheet('invite')} last />
        </Section>
      )}

      {s.deletion_requested_at && (
        <View style={{ backgroundColor: colors.dangerBg, borderRadius: 20, padding: space.md, gap: 4 }}>
          <Txt weight="semibold" size={text.body} color={colors.danger}>{tr(`Deletion requested ${ago(s.deletion_requested_at)}`, `Hiniling na burahin ${ago(s.deletion_requested_at)}`)}</Txt>
          {s.deletion_reason ? <Txt size={text.small} color={colors.danger}>{s.deletion_reason}</Txt> : null}
          <Txt size={text.small} color={colors.danger}>{tr('Confirm by email, pause the school, then delete it below.', 'Kumpirmahin sa email, i-pause ang paaralan, saka burahin sa ibaba.')}</Txt>
        </View>
      )}

      {s.status !== 'pending' && (
        <Section title={tr('Danger zone', 'Mapanganib')}>
          {s.status === 'active' ? (
            <ListRow icon="lock" title={tr('Pause school', 'I-pause ang paaralan')} subtitle={tr('Everyone is signed out and can’t sign in until you reactivate it.', 'Masa-sign out ang lahat at hindi makakapag-sign in hanggang i-activate mo ulit.')} danger onPress={() => setSheet('pause')} last />
          ) : (
            <>
              <ListRow icon="refresh" title={tr('Reactivate school', 'I-activate ulit')} subtitle={s.suspended_reason ?? undefined} onPress={() => run({ id: s.id, action: 'activate' })} />
              <ListRow icon="trash" title={tr('Delete school and all its data', 'Burahin ang paaralan at lahat ng data')} danger onPress={() => setSheet('delete')} last />
            </>
          )}
        </Section>
      )}

      <Sheet visible={sheet === 'pause'} onClose={() => setSheet(null)} title={tr('Pause school', 'I-pause ang paaralan')}>
        <Field label={tr('Reason (shown in the activity log)', 'Dahilan (makikita sa activity log)')} icon="edit" value={reason} onChangeText={setReason} placeholder={tr('e.g. Contract ended', 'hal. Natapos ang kontrata')} />
        <Button title={tr('Pause school', 'I-pause')} size="lg" disabled={reason.trim().length < 3} loading={action.isPending} onPress={() => run({ id: s.id, action: 'suspend', body: { reason } }, () => setSheet(null))} style={{ backgroundColor: colors.danger }} />
      </Sheet>

      <Sheet visible={sheet === 'delete'} onClose={() => setSheet(null)} title={tr('Delete school', 'Burahin ang paaralan')}>
        <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>{tr(`This permanently deletes ${s.name}: every account, class and evaluation. It can’t be undone. Type the school code ${s.code} to confirm.`, `Permanenteng buburahin nito ang ${s.name}: lahat ng account, klase at evaluation. Hindi na maibabalik. I-type ang school code na ${s.code} para kumpirmahin.`)}</Txt>
        <Field label={tr('School code', 'School code')} icon="key" value={typed} onChangeText={(v) => setTyped(v.toUpperCase())} autoCapitalize="characters" />
        <Button title={tr('Delete forever', 'Burahin nang tuluyan')} size="lg" disabled={typed !== s.code} loading={action.isPending} onPress={() => run({ id: s.id, action: 'delete', body: { confirm: typed } }, () => router.replace('/platform/schools'))} style={{ backgroundColor: colors.danger }} />
      </Sheet>

      <Sheet visible={sheet === 'invite'} onClose={() => setSheet(null)} title={tr('New admin invite', 'Bagong admin invite')}>
        <Field label={tr('Name (optional)', 'Pangalan (opsyonal)')} icon="user" value={who.name} onChangeText={(v) => setWho((w) => ({ ...w, name: v }))} />
        <Field label={tr('Email (optional)', 'Email (opsyonal)')} icon="mail" value={who.email} onChangeText={(v) => setWho((w) => ({ ...w, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <Button title={tr('Create invite', 'Gumawa ng invite')} size="lg" loading={action.isPending} onPress={() => run({ id: s.id, action: 'invite-admin', body: { name: who.name || undefined, email: who.email || undefined } }, (r) => { setSheet(null); if (r.invite) setInvite(r.invite); })} />
      </Sheet>

      <InviteCodeSheet visible={!!invite} onClose={() => setInvite(null)} invites={invite ? [invite] : []} school={s.name} role="admin" />
    </Screen>
  );
}
