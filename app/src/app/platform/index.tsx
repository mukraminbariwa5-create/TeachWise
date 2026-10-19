import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { usePlatformOverview } from '@/api/platform';
import { Icon } from '@/components/Icon';
import { SchoolRow } from '@/components/SchoolRow';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { EmptyState, Panel, Screen, StatCard, StatRow } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { colors, space, text } from '@/theme';

/** The owner's overview: schools waiting for approval, how many people use TeachWise, and app health. */
export default function PlatformHome() {
  const router = useRouter();
  const q = usePlatformOverview();
  const scrollHide = useScrollHide();
  const d = q.data;

  return (
    <Screen title={tr('TeachWise overview', 'Overview ng TeachWise')} subtitle={tr('Schools, people and app health. Evaluation answers stay private to each school.', 'Mga paaralan, tao at kalusugan ng app. Pribado sa bawat paaralan ang mga sagot sa evaluation.')} maxWidth={1100} onRefresh={() => q.refetch()} refreshing={q.isRefetching} {...scrollHide}>
      {!d ? (
        <ScreenState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <StatRow>
            <StatCard icon="book" label={tr('Active schools', 'Aktibong paaralan')} value={String(d.schools.active)} hint={d.schools.suspended ? tr(`${d.schools.suspended} paused`, `${d.schools.suspended} naka-pause`) : undefined} />
            <StatCard icon="inbox" tone="orange" label={tr('Waiting for approval', 'Naghihintay ng apruba')} value={String(d.schools.pending)} />
            <StatCard icon="users" tone="brand" label={tr('Students', 'Mga estudyante')} value={d.people.students.toLocaleString()} hint={tr(`${d.people.teachers.toLocaleString()} teachers`, `${d.people.teachers.toLocaleString()} guro`)} />
            <StatCard icon="checkCircle" tone="green" label={tr('Evaluations, last 30 days', 'Evaluation, nakaraang 30 araw')} value={d.evaluations.last_30_days.toLocaleString()} hint={tr(`${d.evaluations.total.toLocaleString()} in total`, `${d.evaluations.total.toLocaleString()} lahat`)} />
          </StatRow>

          <Panel title={tr('Applications', 'Mga aplikasyon')} subtitle={tr('Check that the person really works at the school before approving.', 'Siguraduhing nagtatrabaho talaga sa paaralan ang tao bago aprubahan.')} action={{ label: tr('All schools', 'Lahat'), onPress: () => router.push('/platform/schools') }}>
            {d.pending.length === 0 ? (
              <EmptyState mood="happy" title={tr('No applications waiting', 'Walang naghihintay na aplikasyon')} message={tr('New schools apply from “For schools” on the sign-in page.', 'Nag-a-apply ang bagong paaralan mula sa “Para sa paaralan” sa sign-in page.')} />
            ) : (
              d.pending.map((s) => <SchoolRow key={s.id} s={s} onPress={() => router.push(`/platform/schools/${s.id}` as Href)} />)
            )}
          </Panel>

          {d.deletion_requests.length > 0 && (
            <Panel title={tr('Deletion requests', 'Mga request na burahin')} subtitle={tr('Confirm with the school by email before deleting anything.', 'Kumpirmahin sa paaralan sa email bago magbura.')}>
              {d.deletion_requests.map((s) => <SchoolRow key={s.id} s={s} onPress={() => router.push(`/platform/schools/${s.id}` as Href)} />)}
            </Panel>
          )}

          <Pressable accessibilityRole="button" onPress={() => router.push('/platform/errors')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: d.errors_last_7_days ? colors.pendingBg : colors.successBg, borderRadius: 20, padding: space.md }}>
            <Icon name={d.errors_last_7_days ? 'bug' : 'checkCircle'} size={20} color={d.errors_last_7_days ? colors.pendingFg : colors.successFg} />
            <Txt weight="semibold" size={text.body} color={d.errors_last_7_days ? colors.pendingFg : colors.successFg} style={{ flex: 1 }}>
              {d.errors_last_7_days ? tr(`${d.errors_last_7_days} app errors in the last 7 days`, `${d.errors_last_7_days} error sa app nitong 7 araw`) : tr('No app errors in the last 7 days', 'Walang error sa app nitong 7 araw')}
            </Txt>
            <Icon name="chevronRight" size={16} color={colors.muted} strokeWidth={2.2} />
          </Pressable>
        </>
      )}
    </Screen>
  );
}
