import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ApiError } from '@/api/client';
import { useAdminCounts, useAdminDashboard, useSendReminders, type AdminDashboard } from '@/api/admin';
import { Avatar } from '@/components/Avatar';
import { formatRating } from '@/components/Charts';
import { Icon, type IconName } from '@/components/Icon';
import { FadeIn } from '@/components/Motion';
import { AppBar, PageHeader } from '@/components/PageHeader';
import { ScreenState } from '@/components/ScreenState';
import { Bone } from '@/components/Skeleton';
import { Txt } from '@/components/Txt';
import { SetupChecklist } from '@/components/admin/SetupChecklist';
import { confirm, Panel, StatCard, StatRow } from '@/components/ui';
import { WiseMascot, type Mood } from '@/components/WiseMascot';
import { firstName, greetingWord, shortDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { useLayoutSize } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { useAuth } from '@/auth/store';
import { colors, space, text } from '@/theme';

/** The admin's overview: the current period, completion, what needs attention and how faculty are rated. */
export default function AdminHome() {
  const size = useLayoutSize();
  const phone = size === 'phone';
  const query = useAdminDashboard();
  const user = useAuth((s) => s.user);
  const scrollHide = useScrollHide();
  useTitle(tr('Overview', 'Overview'));

  if (!query.data) {
    if (query.isLoading) return <Skeleton phone={phone} />;
    return <ScreenState error={query.error} onRetry={() => query.refetch()} />;
  }
  const d = query.data;
  const dept = user?.admin_scope === 'department';

  return (
    <ScrollView
      {...scrollHide}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
      contentContainerStyle={{ paddingHorizontal: phone ? space.lg : 52, paddingTop: phone ? 22 : 40, paddingBottom: phone ? 32 : 120, gap: space.lg, width: '100%', maxWidth: 1240, alignSelf: 'center' }}
    >
      {phone ? <AppBar title={tr('Overview', 'Overview')} subtitle={d.semester?.name} /> : <PageHeader title={tr('Overview', 'Overview')} />}
      <Hero d={d} phone={phone} />
      {!dept && <SetupChecklist />}
      <Stats d={d} compact={phone} />
      <Attention />
      <View style={{ flexDirection: size === 'desktop' ? 'row' : 'column', gap: space.lg, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, alignSelf: 'stretch' }}>
          <Completion d={d} />
        </View>
        <View style={{ flex: 1, alignSelf: 'stretch' }}>
          <Faculty d={d} />
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * "Good morning, Hana" for a person; shared office accounts like "DSU Registrar" get
 * "Good morning" plus the school or department, never "Good morning, DSU · DSU".
 */
function adminGreeting(name: string, place: string | null): string {
  const hello = greetingWord().replace(',', '');
  const first = firstName(name);
  const office = !first || /^[A-Z0-9]{2,}$/.test(first) || (!!place && place.toLowerCase().startsWith(first.toLowerCase()));
  if (office) return place ? `${hello}, ${place}` : hello;
  return `${hello}, ${first}`;
}

/** Students, faculty, this period's answers (with progress) and the average rating (with its trend). */
function Stats({ d, compact }: { d: AdminDashboard; compact: boolean }) {
  const trend = (d.trend ?? []).filter((t) => t.average !== null);
  const current = d.period ? trend.find((t) => t.period_id === d.period!.id) : undefined;
  const latest = current ?? trend[trend.length - 1];
  const previous = latest ? trend[trend.indexOf(latest) - 1] : undefined;
  const average = latest?.average ?? d.stats.average_rating;
  const expected = d.completion.expected;
  return (
    <StatRow>
      <StatCard compact={compact} icon="users" label={tr('Students', 'Mga estudyante')} value={String(d.stats.students)} hint={tr('Active accounts', 'Aktibong account')} />
      <StatCard compact={compact} icon="book" tone="brand" label={tr('Faculty', 'Faculty')} value={String(d.stats.faculty)} hint={tr('Active teachers', 'Aktibong guro')} />
      <StatCard
        compact={compact}
        icon="checkCircle"
        tone="green"
        label={d.period ? tr(`Answers in ${d.period.name}`, `Mga sagot sa ${d.period.name}`) : tr('Answers', 'Mga sagot')}
        value={String(d.stats.evaluations_submitted)}
        progress={expected ? d.completion.completed / expected : undefined}
        hint={expected ? tr(`${d.completion.percent}% of ${expected} expected`, `${d.completion.percent}% sa ${expected} inaasahan`) : tr('No classes to evaluate yet', 'Wala pang klaseng ie-evaluate')}
      />
      <StatCard
        compact={compact}
        icon="star"
        tone="orange"
        label={latest ? tr(`${latest.name} average`, `Average sa ${latest.name}`) : tr('Average rating', 'Average na rating')}
        value={formatRating(average)}
        empty={tr('No ratings yet', 'Wala pang rating')}
        spark={trend.map((t) => t.average as number)}
        delta={latest && previous ? { value: (latest.average as number) - (previous.average as number), caption: tr(`since ${previous.name}`, `mula ${previous.name}`) } : null}
        hint={tr('All teachers, out of 5', 'Lahat ng guro, sa 5')}
      />
    </StatRow>
  );
}

function Hero({ d, phone }: { d: AdminDashboard; phone: boolean }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const school = useAuth((s) => s.school);
  const reminders = useSendReminders();
  const p = d.period;

  let mood: Mood = 'hello';
  let title: string;
  let body: string;
  let cta: { label: string; onPress: () => void; busy?: boolean } | null = null;

  if (!p) {
    mood = 'idea';
    title = tr('No evaluation period scheduled', 'Walang nakatakdang evaluation period');
    body = tr('Create one and students will be notified when it opens.', 'Gumawa ng isa at maaabisuhan ang mga estudyante pagbukas nito.');
    cta = { label: tr('Set up a period', 'Gumawa ng period'), onPress: () => router.push('/admin/evaluation') };
  } else if (!p.is_open) {
    mood = 'working';
    title = tr(`${p.name} opens ${shortDate(p.opens_at)}`, `Magbubukas ang ${p.name} sa ${shortDate(p.opens_at)}`);
    body = tr('Make sure classes, sections and approved IDs are ready before it starts.', 'Siguraduhing handa ang mga klase, section at aprubadong ID bago ito magsimula.');
    cta = { label: tr('Review setup', 'Suriin ang setup'), onPress: () => router.push('/admin/academics') };
  } else {
    mood = d.completion.percent >= 80 ? 'proud' : 'lecture';
    title = tr(`${p.name}: ${d.completion.percent}% complete`, `${p.name}: ${d.completion.percent}% tapos`);
    body = tr(`${d.completion.completed} of ${d.completion.expected} evaluations in. Closes ${shortDate(p.closes_at)}.`, `${d.completion.completed} sa ${d.completion.expected} na evaluation ang pasok. Magsasara ${shortDate(p.closes_at)}.`);
    if (d.completion.percent < 100 && user?.admin_scope !== 'department') {
      cta = {
        label: tr('Remind students', 'Paalalahanan ang mga estudyante'),
        busy: reminders.isPending,
        onPress: async () => {
          if (!(await confirm({ title: tr('Send a reminder?', 'Magpadala ng paalala?'), message: tr('Every student with pending evaluations gets a notification.', 'Makakatanggap ng notification ang bawat estudyanteng may hindi pa tapos.'), confirmLabel: tr('Send', 'Ipadala'), mood: 'please' }))) return;
          reminders.mutate(undefined, {
            onSuccess: (r) => toast({ title: r.message, tone: 'success', mood: 'cheer' }),
            onError: (e) => toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t send reminders.', 'Hindi naipadala ang paalala.') }),
          });
        },
      };
    }
  }

  const sticker = phone ? 112 : 190;
  return (
    <FadeIn>
      <View style={{ backgroundColor: colors.frame, borderRadius: phone ? 30 : 36, paddingVertical: phone ? 22 : 30, paddingLeft: phone ? 22 : 34, paddingRight: phone ? sticker - 4 : sticker + 8, minHeight: phone ? 150 : 176 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: phone ? 30 : 36, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -50, top: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        </View>
        <Txt weight="medium" size={phone ? 13 : 15} color={colors.onFrameMuted} numberOfLines={1}>{adminGreeting(user?.name ?? '', user?.admin_scope === 'department' ? user?.department ?? null : school?.short_name ?? school?.name ?? null)}</Txt>
        <Txt weight="bold" size={phone ? 22 : 30} color="#FFFFFF" style={{ marginTop: 4, letterSpacing: -0.5, lineHeight: phone ? 28 : 36 }} accessibilityRole="header">{title}</Txt>
        <Txt size={phone ? 14 : 16} color={colors.onFrameMuted} style={{ marginTop: 6, lineHeight: phone ? 20 : 23 }}>{body}</Txt>
        {p?.is_open && (
          <View style={{ marginTop: 14, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', maxWidth: 420 }} accessibilityLabel={`${d.completion.percent}%`}>
            <View style={{ width: `${d.completion.percent}%`, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
          </View>
        )}
        {cta && (
          <Pressable
            accessibilityRole="button"
            disabled={cta.busy}
            onPress={cta.onPress}
            style={({ hovered }: { hovered?: boolean }) => ({ marginTop: phone ? 14 : 18, alignSelf: 'flex-start', height: phone ? 42 : 48, paddingHorizontal: phone ? 16 : 22, borderRadius: 999, backgroundColor: hovered ? '#E9EAFB' : '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8, opacity: cta.busy ? 0.7 : 1 })}
          >
            <Txt weight="semibold" size={phone ? 14 : 16} color="#0B0B6E" numberOfLines={1}>{cta.busy ? tr('Sending…', 'Ipinapadala…') : cta.label}</Txt>
          </Pressable>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', right: phone ? -4 : 14, bottom: 0 }}>
          <WiseMascot size={sticker} mood={mood} shadow={false} />
        </View>
      </View>
    </FadeIn>
  );
}

/** Things waiting for the admin. Hidden when there's nothing to do. */
function Attention() {
  const router = useRouter();
  const counts = useAdminCounts();
  const all: { icon: IconName; label: string; count: number; href: string }[] = [
    { icon: 'key', label: tr('Password reset requests', 'Mga request na i-reset ang password'), count: counts.passwords, href: '/admin/requests' },
    { icon: 'inbox', label: tr('Messages and reports', 'Mga mensahe at ulat'), count: counts.inbox, href: '/admin/requests?tab=inbox' },
  ];
  const items = all.filter((i) => i.count > 0);
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {items.map((i) => (
        <Pressable
          key={i.label}
          accessibilityRole="button"
          onPress={() => router.push(i.href as Href)}
          style={({ hovered }: { hovered?: boolean }) => ({ flex: 1, minWidth: 260, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: hovered ? colors.urgentBg : colors.pendingBg, borderRadius: 20, padding: space.md })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={i.icon} size={20} color={colors.pendingFg} />
          </View>
          <Txt weight="semibold" size={text.body} color={colors.pendingFg} style={{ flex: 1 }}>{i.label}</Txt>
          <Txt weight="bold" size={text.h3} color={colors.pendingFg}>{String(i.count)}</Txt>
          <Icon name="chevronRight" size={16} color={colors.pendingFg} strokeWidth={2.2} />
        </Pressable>
      ))}
    </View>
  );
}

function Completion({ d }: { d: AdminDashboard }) {
  const rows = [...d.completion.by_section].sort((a, b) => a.percent - b.percent);
  return (
    <Panel title={tr('Completion by section', 'Pagkumpleto ayon sa section')} subtitle={d.period ? d.period.name : tr('No period yet', 'Wala pang period')}>
      {rows.length === 0 ? (
        <Txt size={text.body} color={colors.muted}>{tr('Add sections, classes and students to see completion here.', 'Magdagdag ng section, klase at estudyante para makita ang pagkumpleto rito.')}</Txt>
      ) : (
        rows.map((s) => (
          <View key={s.section_id} style={{ gap: 6 }} accessible accessibilityLabel={`${s.label}: ${s.percent}%, ${s.completed} / ${s.expected}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Txt weight="medium" size={text.body} style={{ flex: 1 }}>{s.label}</Txt>
              <Txt size={text.small} color={colors.muted}>{`${s.completed} / ${s.expected}`}</Txt>
              <Txt weight="semibold" size={text.body} color={s.percent < 25 && d.period?.is_open ? colors.urgentFg : colors.text} style={{ width: 52, textAlign: 'right' }}>{`${s.percent}%`}</Txt>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' }}>
              <View style={{ width: `${s.percent}%`, height: 8, borderRadius: 4, backgroundColor: s.percent >= 100 ? colors.successFg : s.percent < 25 && d.period?.is_open ? colors.urgent : colors.navy }} />
            </View>
          </View>
        ))
      )}
    </Panel>
  );
}

function Faculty({ d }: { d: AdminDashboard }) {
  const router = useRouter();
  const rated = [...d.faculty].sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  return (
    <Panel title={tr('Faculty ratings', 'Rating ng faculty')} subtitle={tr('All periods, from students', 'Lahat ng period, mula sa estudyante')} action={{ label: tr('Reports', 'Mga report'), onPress: () => router.push('/admin/reports') }}>
      {rated.length === 0 ? (
        <Txt size={text.body} color={colors.muted}>{tr('No teachers yet.', 'Wala pang guro.')}</Txt>
      ) : (
        rated.slice(0, 8).map((t) => (
          <Pressable key={t.id} accessibilityRole="button" onPress={() => router.push(`/admin/reports?teacher=${t.id}` as Href)} style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: 14, padding: 6, marginHorizontal: -6, backgroundColor: hovered ? colors.surface : 'transparent' })}>
            <Avatar name={t.name} initials={t.initials} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="semibold" size={text.body} numberOfLines={1}>{t.name}</Txt>
              <Txt size={text.small} color={colors.muted}>{tr(`${t.responses} responses`, `${t.responses} sagot`)}</Txt>
            </View>
            <RatingMeter value={t.average} />
          </Pressable>
        ))
      )}
    </Panel>
  );
}

/** A short bar and the score, coloured so strong and struggling teachers stand out at a glance. */
function RatingMeter({ value }: { value: number | null }) {
  const tone = value === null ? colors.muted : value >= 4 ? colors.successFg : value >= 3 ? colors.accent : colors.urgentFg;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ width: 72, height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' }}>
        {value !== null && <View style={{ width: `${Math.max(4, ((value - 1) / 4) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: tone }} />}
      </View>
      <Txt weight="bold" size={text.title} color={value === null ? colors.muted : colors.text} style={{ width: 42, textAlign: 'right' }}>{formatRating(value)}</Txt>
    </View>
  );
}

function Skeleton({ phone }: { phone: boolean }) {
  return (
    <View style={{ padding: phone ? space.lg : 52, gap: space.lg, width: '100%', maxWidth: 1240, alignSelf: 'center' }}>
      <Bone height={40} width={220} />
      <Bone height={phone ? 150 : 176} radius={32} />
      <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, minWidth: 150 }}>
            <Bone height={130} radius={24} />
          </View>
        ))}
      </View>
    </View>
  );
}
