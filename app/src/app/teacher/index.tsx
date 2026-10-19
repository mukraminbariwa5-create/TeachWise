import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTeacherDashboard } from '@/api/hooks';
import type { PeerItem, TeacherDashboard } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { CriteriaBars, formatRating, TrendChart, weakestCriterion } from '@/components/Charts';
import { Icon } from '@/components/Icon';
import { FadeIn } from '@/components/Motion';
import { AppBar, PageHeader } from '@/components/PageHeader';
import { ScreenState } from '@/components/ScreenState';
import { ProgressBar } from '@/components/ProgressRing';
import { Bone } from '@/components/Skeleton';
import { StatusChip } from '@/components/StatusChip';
import { Txt } from '@/components/Txt';
import { CommentCard, EmptyState, Panel, StatCard, StatRow } from '@/components/ui';
import { WiseMascot, type Mood } from '@/components/WiseMascot';
import { firstName, greetingWord, shortDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { useLayoutSize } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, space, text } from '@/theme';

/** The teacher's home: how students rate them, the trend, what to work on, and peer evaluation. */
export default function TeacherHome() {
  const size = useLayoutSize();
  const phone = size === 'phone';
  const desktop = size === 'desktop';
  const query = useTeacherDashboard();
  const scrollHide = useScrollHide();
  useTitle(tr('Home', 'Home'));

  if (!query.data) {
    if (query.isLoading) return <DashboardSkeleton phone={phone} />;
    return <ScreenState error={query.error} onRetry={() => query.refetch()} />;
  }
  const d = query.data;

  const left = d.privacy?.locked ? (
    <LockedPanel d={d} />
  ) : (
    <>
      <RatingsPanel d={d} />
      <FocusPanel d={d} />
      <CriteriaPanel d={d} />
    </>
  );
  const right = (
    <>
      {d.peer_evaluation !== false && <PeerPanel d={d} />}
      <FeedbackPanel d={d} />
      <ClassesPanel d={d} />
    </>
  );

  return (
    <ScrollView
      {...scrollHide}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
      contentContainerStyle={{ paddingHorizontal: phone ? space.lg : 52, paddingTop: phone ? 22 : 40, paddingBottom: phone ? 32 : 120, gap: space.lg, width: '100%', maxWidth: 1240, alignSelf: 'center' }}
    >
      {phone ? <AppBar title={tr('Home', 'Home')} subtitle={d.semester?.name} /> : <PageHeader title={tr('Dashboard', 'Dashboard')} />}
      <Hero d={d} phone={phone} />
      <StatRow>
        <StatCard
          compact={phone}
          icon="star"
          label={tr('Student rating', 'Rating ng estudyante')}
          value={formatRating(d.overall.average)}
          empty={tr('Not yet', 'Wala pa')}
          spark={d.trend.map((t) => t.average)}
          delta={d.trend.length >= 2 ? { value: d.trend[d.trend.length - 1].average - d.trend[d.trend.length - 2].average, caption: tr(`${d.trend[d.trend.length - 1].period} vs ${d.trend[d.trend.length - 2].period}`, `${d.trend[d.trend.length - 1].period} kumpara sa ${d.trend[d.trend.length - 2].period}`) } : null}
          hint={tr('Out of 5, all periods', 'Sa 5, lahat ng period')}
        />
        <StatCard compact={phone} icon="users" tone="brand" label={tr('Responses', 'Mga sagot')} value={String(d.overall.responses)} hint={tr('From students', 'Mula sa estudyante')} />
        {d.peer_evaluation !== false && (
          <StatCard
            compact={phone}
            icon="layers"
            tone="green"
            label={tr('Peer rating', 'Peer rating')}
            value={formatRating(d.peer_overall.average)}
            empty={tr('No reviews yet', 'Wala pang review')}
            hint={tr(`${d.peer_overall.responses} colleague review${d.peer_overall.responses === 1 ? '' : 's'}`, `${d.peer_overall.responses} review ng kasamahan`)}
          />
        )}
        <StatCard compact={phone} icon="book" tone="orange" label={tr('Classes', 'Mga klase')} value={String(d.subjects.length)} hint={d.semester?.name} />
      </StatRow>
      {desktop ? (
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.4, gap: space.lg }}>{left}</View>
          <View style={{ flex: 1, gap: space.lg }}>{right}</View>
        </View>
      ) : (
        <>
          {left}
          {right}
        </>
      )}
    </ScrollView>
  );
}

function Hero({ d, phone }: { d: TeacherDashboard; phone: boolean }) {
  const router = useRouter();
  const pendingPeers = d.peer_period?.is_open ? d.peers.filter((p) => p.status === 'pending') : [];
  const avg = d.overall.average;
  const trend = d.trend;
  const change = trend.length >= 2 ? trend[trend.length - 1].average - trend[trend.length - 2].average : null;

  let mood: Mood = 'hello';
  let title: string;
  let body: string;
  let cta: { label: string; onPress: () => void } | null = null;

  if (pendingPeers.length > 0) {
    mood = 'point';
    title = tr(`${pendingPeers.length} peer evaluation${pendingPeers.length > 1 ? 's' : ''} to do`, `${pendingPeers.length} peer evaluation ang gagawin`);
    body = tr(`${d.peer_period!.name} closes ${shortDate(d.peer_period!.closes_at)}. Each takes about 3 minutes.`, `Magsasara ang ${d.peer_period!.name} sa ${shortDate(d.peer_period!.closes_at)}. Mga 3 minuto bawat isa.`);
    cta = { label: tr(`Evaluate ${firstName(pendingPeers[0].teacher.name)}`, `I-evaluate si ${firstName(pendingPeers[0].teacher.name)}`), onPress: () => router.push(`/teacher/peers/${pendingPeers[0].teacher.id}` as Href) };
  } else if (d.privacy?.locked && d.overall.responses > 0) {
    mood = 'working';
    title = tr(`${d.overall.responses} of ${d.privacy.min_responses} responses so far`, `${d.overall.responses} sa ${d.privacy.min_responses} sagot pa lang`);
    body = tr('To keep students anonymous, your results appear once enough of them have answered.', 'Para manatiling anonymous ang mga estudyante, lalabas ang resulta kapag sapat na ang sumagot.');
  } else if (avg == null) {
    mood = 'working';
    title = tr('No student feedback yet', 'Wala pang feedback mula sa estudyante');
    body = tr('Your results will appear here as soon as students submit their evaluations.', 'Lalabas dito ang resulta mo kapag nagpasa na ang mga estudyante.');
  } else {
    mood = avg >= 4.2 ? 'proud' : avg >= 3.5 ? 'happy' : 'teach';
    title = tr(`Students rate you ${avg.toFixed(2)} out of 5`, `${avg.toFixed(2)} sa 5 ang rating sa iyo ng mga estudyante`);
    body =
      change == null
        ? tr(`Based on ${d.overall.responses} anonymous evaluations.`, `Batay sa ${d.overall.responses} anonymous na evaluation.`)
        : change >= 0.05
          ? tr(`Up ${change.toFixed(2)} from the last period.`, `Tumaas ng ${change.toFixed(2)} mula sa nakaraang period.`)
          : change <= -0.05
            ? tr(`Down ${Math.abs(change).toFixed(2)} from the last period. Your focus area below can help.`, `Bumaba ng ${Math.abs(change).toFixed(2)} mula sa nakaraang period. Makakatulong ang focus area sa ibaba.`)
            : tr('Steady compared with the last period.', 'Halos pareho sa nakaraang period.');
    cta = { label: tr('Open my full report', 'Buksan ang buong report'), onPress: () => router.push('/teacher/report') };
  }

  const sticker = phone ? 112 : 190;
  return (
    <FadeIn>
      <View style={{ backgroundColor: colors.frame, borderRadius: phone ? 30 : 36, paddingVertical: phone ? 22 : 30, paddingLeft: phone ? 22 : 34, paddingRight: phone ? sticker - 4 : sticker + 8, minHeight: phone ? 150 : 176 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: phone ? 30 : 36, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -50, top: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        </View>
        <Txt weight="medium" size={phone ? 13 : 15} color={colors.onFrameMuted}>{`${greetingWord().replace(',', '')}, ${firstName(d.teacher.name)}`}</Txt>
        <Txt weight="bold" size={phone ? 22 : 30} color="#FFFFFF" style={{ marginTop: 4, letterSpacing: -0.5, lineHeight: phone ? 28 : 36 }} accessibilityRole="header">{title}</Txt>
        <Txt size={phone ? 14 : 16} color={colors.onFrameMuted} style={{ marginTop: 6, lineHeight: phone ? 20 : 23 }}>{body}</Txt>
        {cta && (
          <Pressable
            accessibilityRole="button"
            onPress={cta.onPress}
            style={({ hovered }: { hovered?: boolean }) => ({ marginTop: phone ? 14 : 18, alignSelf: 'flex-start', height: phone ? 42 : 48, paddingHorizontal: phone ? 16 : 22, borderRadius: 999, backgroundColor: hovered ? '#E9EAFB' : '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8 })}
          >
            <Txt weight="semibold" size={phone ? 14 : 16} color="#0B0B6E" numberOfLines={1}>{cta.label}</Txt>
          </Pressable>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', right: phone ? -4 : 14, bottom: 0 }}>
          <WiseMascot size={sticker} mood={mood} shadow={false} />
        </View>
      </View>
    </FadeIn>
  );
}

/** Too few answers yet: nothing is shown, so nobody can work out who said what. */
function LockedPanel({ d }: { d: TeacherDashboard }) {
  const min = d.privacy?.min_responses ?? 3;
  const n = d.overall.responses;
  return (
    <Panel title={tr('Your results are on their way', 'Paparating na ang resulta mo')} subtitle={tr('Protecting student anonymity', 'Pinoprotektahan ang pagiging anonymous ng estudyante')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <WiseMascot size={96} mood="shy" float={false} shadow={false} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>
            {tr(`Ratings, trends and comments appear after at least ${min} students have evaluated you. That way no single answer can be traced back to anyone.`, `Lalabas ang rating, trend at komento kapag hindi bababa sa ${min} estudyante ang nag-evaluate sa iyo. Sa ganoon, walang sagot na matutunton kaninuman.`)}
          </Txt>
          <ProgressBar value={n / min} height={8} />
          <Txt size={text.small} color={colors.muted}>{tr(`${n} of ${min}`, `${n} sa ${min}`)}</Txt>
        </View>
      </View>
    </Panel>
  );
}

function RatingsPanel({ d }: { d: TeacherDashboard }) {
  return (
    <Panel title={tr('Rating over time', 'Rating sa paglipas ng panahon')} subtitle={tr('Average student rating per evaluation period', 'Average na rating ng estudyante bawat period')}>
      {d.trend.length >= 2 ? (
        <TrendChart points={d.trend} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trendUp" size={24} color={colors.accent} strokeWidth={2} />
          </View>
          <Txt size={text.body} color={colors.muted} style={{ flex: 1, lineHeight: 22 }}>
            {d.trend.length === 1
              ? tr(`So far: ${d.trend[0].average.toFixed(2)} in ${d.trend[0].period}. Your trend line appears after the next evaluation period.`, `Sa ngayon: ${d.trend[0].average.toFixed(2)} sa ${d.trend[0].period}. Lalabas ang trend pagkatapos ng susunod na period.`)
              : tr('Your trend appears once students have evaluated you in at least two periods.', 'Lalabas ang trend kapag na-evaluate ka na ng mga estudyante sa hindi bababa sa dalawang period.')}
          </Txt>
        </View>
      )}
    </Panel>
  );
}

function CriteriaPanel({ d }: { d: TeacherDashboard }) {
  const weak = weakestCriterion(d.criteria);
  if (d.criteria.length === 0) return null;
  return (
    <Panel title={tr('By criteria', 'Ayon sa pamantayan')} subtitle={tr('What students rate highest and lowest', 'Ang pinakamataas at pinakamababang rating ng estudyante')}>
      <CriteriaBars criteria={d.criteria} />
      {weak && !(d.focus && d.focus.length) && (
        <Txt size={text.small} color={colors.muted}>{tr(`Focus area: ${weak.category}`, `Focus area: ${weak.category}`)}</Txt>
      )}
    </Panel>
  );
}

/** "What to work on": the lowest-rated areas, each with a few small, concrete things to try. */
function FocusPanel({ d }: { d: TeacherDashboard }) {
  const router = useRouter();
  const focus = d.focus ?? [];
  if (focus.length === 0) return null;
  return (
    <Panel title={tr('What to work on', 'Ano ang pagtutuunan')} subtitle={tr('Small changes in your lowest-rated areas lift your overall rating the most', 'Ang maliliit na pagbabago sa pinakamababang rating ang pinakamalaking makakapagpataas ng kabuuang rating mo')}>
      {focus.map((f, i) => (
        <View key={f.question_id} style={{ gap: space.sm, paddingTop: i ? space.md : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.borderSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.pendingBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lightbulb" size={20} color={colors.pendingFg} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="semibold" size={text.bodyLg} numberOfLines={1}>{f.category}</Txt>
              <Txt size={text.small} color={colors.muted}>{tr(`Rated ${formatRating(f.average)} out of 5`, `${formatRating(f.average)} sa 5 ang rating`)}</Txt>
            </View>
          </View>
          {f.tips.map((tip, k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingLeft: 4 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <Txt weight="bold" size={text.caption} color={colors.accent}>{String(k + 1)}</Txt>
              </View>
              <Txt size={text.body} color={colors.textSoft} style={{ flex: 1, lineHeight: 21 }}>{tip}</Txt>
            </View>
          ))}
        </View>
      ))}
      <Pressable accessibilityRole="link" onPress={() => router.push('/teacher/wise')} style={({ hovered }: { hovered?: boolean }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, marginLeft: -12, borderRadius: 999, backgroundColor: hovered ? colors.surface : 'transparent' })}>
        <Txt weight="semibold" size={text.body} color={colors.accent}>{tr('Ask Professor Wise for more ideas', 'Humingi pa ng ideya kay Professor Wise')}</Txt>
      </Pressable>
    </Panel>
  );
}

function PeerPanel({ d }: { d: TeacherDashboard }) {
  const router = useRouter();
  const p = d.peer_period;
  const subtitle = !p
    ? tr('No peer evaluation scheduled', 'Walang nakatakdang peer evaluation')
    : p.is_open
      ? tr(`${p.name} · closes ${shortDate(p.closes_at)}`, `${p.name} · magsasara ${shortDate(p.closes_at)}`)
      : tr(`${p.name} · opens ${shortDate(p.opens_at)}`, `${p.name} · magbubukas ${shortDate(p.opens_at)}`);

  return (
    <Panel title={tr('Peer evaluation', 'Peer evaluation')} subtitle={subtitle}>
      {d.peers.length === 0 ? (
        <Txt size={text.body} color={colors.muted} style={{ lineHeight: 22 }}>{tr('No colleagues share your subjects this semester.', 'Walang kasamahan na may parehong subject ngayong semestre.')}</Txt>
      ) : (
        d.peers.map((peer) => <PeerRow key={peer.teacher.id} peer={peer} open={!!p?.is_open} onPress={() => router.push(`/teacher/peers/${peer.teacher.id}` as Href)} />)
      )}
    </Panel>
  );
}

function PeerRow({ peer, open, onPress }: { peer: PeerItem; open: boolean; onPress: () => void }) {
  const canEvaluate = open && peer.status === 'pending';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Avatar name={peer.teacher.name} initials={peer.teacher.initials} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="semibold" size={text.bodyLg} numberOfLines={1}>{peer.teacher.name}</Txt>
        <Txt size={text.small} color={colors.muted} numberOfLines={1}>{peer.shared_subjects.join(', ')}</Txt>
      </View>
      {canEvaluate ? <Button title={tr('Evaluate', 'I-evaluate')} onPress={onPress} /> : <StatusChip status={peer.status} compact />}
    </View>
  );
}

function FeedbackPanel({ d }: { d: TeacherDashboard }) {
  const router = useRouter();
  return (
    <Panel title={tr('Recent comments', 'Mga bagong komento')} subtitle={tr('Anonymous, from your students', 'Anonymous, mula sa mga estudyante mo')} action={d.recent_feedback.length ? { label: tr('See all', 'Lahat'), onPress: () => router.push('/teacher/feedback') } : undefined}>
      {d.recent_feedback.length === 0 ? (
        <Txt size={text.body} color={colors.muted}>{tr('No written comments yet.', 'Wala pang nakasulat na komento.')}</Txt>
      ) : (
        d.recent_feedback.map((c, i) => <CommentCard key={i} comment={c.comment} rating={c.rating} meta={[c.subject_code, c.submitted_at && shortDate(c.submitted_at)].filter(Boolean).join(' · ')} />)
      )}
    </Panel>
  );
}

function ClassesPanel({ d }: { d: TeacherDashboard }) {
  if (d.subjects.length === 0) {
    return (
      <Panel title={tr('My classes', 'Mga klase ko')}>
        <EmptyState mood="shy" title={tr('No classes assigned', 'Walang naka-assign na klase')} message={tr('Ask the admin to assign your classes for this semester.', 'Hilingin sa admin na i-assign ang mga klase mo ngayong semestre.')} />
      </Panel>
    );
  }
  return (
    <Panel title={tr('My classes', 'Mga klase ko')} subtitle={d.semester?.name}>
      {d.subjects.map((c, i) => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: i ? space.sm : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.borderSoft }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="book" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight="semibold" size={text.body} numberOfLines={1}>{[c.subject.code, c.subject.name].filter(Boolean).join(' · ')}</Txt>
            <Txt size={text.small} color={colors.muted} numberOfLines={1}>{[c.section, c.schedule].filter(Boolean).join(' · ')}</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt weight="semibold" size={text.bodyLg}>{formatRating(c.average)}</Txt>
            <Txt size={text.caption} color={colors.muted}>{tr(`${c.responses} responses`, `${c.responses} sagot`)}</Txt>
          </View>
        </View>
      ))}
    </Panel>
  );
}

function DashboardSkeleton({ phone }: { phone: boolean }) {
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
      <Bone height={240} radius={26} />
    </View>
  );
}
