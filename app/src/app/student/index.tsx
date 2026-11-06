import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useUiScale } from '@/lib/uiScale';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { keys, useStudentDashboard } from '@/api/hooks';
import type { StudentDashboard } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { BadgeCelebration } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PageHeader, SearchPill } from '@/components/PageHeader';
import { ProgressBar, ProgressRing } from '@/components/ProgressRing';
import { ScreenState } from '@/components/ScreenState';
import { TourTarget, useTour, type TourStep } from '@/components/Tour';
import { Txt } from '@/components/Txt';
import { WiseMascot } from '@/components/WiseMascot';
import { draftIds, scopedDraftId } from '@/lib/drafts';
import { greetingWord, isClosingSoon, shortDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { getPref, setPref } from '@/lib/prefs';
import { useLayoutSize } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { tap, useHideLauncher, useUI } from '@/lib/ui';
import { colors } from '@/theme';

type Teacher = StudentDashboard['teachers'][number];

/** The same content order on every device; desktop adds a helpful side column. */
export default function StudentHome() {
  const query = useStudentDashboard();
  useTitle(tr('Dashboard', 'Dashboard'));
  if (!query.data) return <ScreenState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />;
  return <><Dashboard data={query.data} refreshing={query.isRefetching} onRefresh={() => query.refetch()} /><BadgeCelebration data={query.data} /></>;
}

function Dashboard({ data, refreshing, onRefresh }: { data: StudentDashboard; refreshing: boolean; onRefresh: () => void }) {
  useHideLauncher();
  const size = useLayoutSize();
  const columns = useWindowDimensions().width >= 1320;
  const phone = size === 'phone';
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const drafts = useQuery({ queryKey: ['drafts', data.student.id, data.period?.id], queryFn: draftIds, staleTime: 0 });
  const tour = useDashboardTour(data);
  const pending = data.teachers.filter((t) => t.status === 'pending');
  const completed = data.teachers.filter((t) => t.status === 'completed');
  const matches = (t: Teacher) => `${t.subject.name} ${t.subject.code ?? ''} ${t.teacher.name}`.toLowerCase().includes(search.trim().toLowerCase());
  const first = data.student.name.split(' ')[0];
  const open = (t: Teacher) => router.push(`/student/evaluate/${t.offering_id}`);
  const openPeriod = !!data.period?.is_open;
  const upcoming = !!data.period && new Date(data.period.opens_at).getTime() > Date.now();

  useEffect(() => {
    if (!openPeriod || !pending[0]) return;
    const id = pending[0].offering_id;
    qc.prefetchQuery({ queryKey: keys.form(id), queryFn: () => api(`/student/offerings/${id}/form`), staleTime: 60_000 });
  }, [data.teachers, openPeriod, qc]);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 1440, alignSelf: 'center', padding: phone ? 20 : size === 'tablet' ? 24 : 32, paddingTop: phone ? 14 : 32, paddingBottom: phone ? 34 : 80, gap: phone ? 22 : 28 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      {!phone && <PageHeader title={tr('Dashboard', 'Dashboard')} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <WiseMascot size={phone ? 104 : 90} mood="happy" float={false} shadow={false} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Txt weight="bold" size={phone ? 24 : 30} accessibilityRole="header">{phone ? tr(`Hi, ${first}`, `Kumusta, ${first}`) : `${greetingWord()} ${first}`}</Txt>
          <Txt size={14} color={colors.muted}>{[data.student.section?.label, data.semester?.name].filter(Boolean).join(' · ')}</Txt>
          <Txt size={phone ? 15 : 17} color={colors.textSoft}>{!data.period ? tr('No evaluation period is open yet.', 'Wala pang bukas na evaluation.') : pending.length ? tr(`${pending.length} class${pending.length === 1 ? '' : 'es'} left`, `${pending.length} klase pa`) : tr('You’re all caught up. Thank you!', 'Tapos ka na. Salamat!')}</Txt>
        </View>
      </View>

      <View style={{ flexDirection: columns ? 'row' : 'column', gap: 28, alignItems: 'flex-start' }}>
        <View style={{ flex: columns ? 1 : undefined, width: columns ? undefined : '100%', minWidth: 0, gap: 22 }}>
          <TourTarget id="hero"><ProgressSummary data={data} /></TourTarget>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt weight="semibold" size={phone ? 20 : 23} accessibilityRole="header">{tr('Your classes to evaluate', 'Mga klase mong ie-evaluate')}</Txt>
              {!phone && <Txt size={13} color={colors.muted}>{tr(`${pending.length} remaining`, `${pending.length} pa`)}</Txt>}
            </View>
            {(data.teachers.length > 4 || !phone) && <SearchPill value={search} onChange={setSearch} placeholder={tr('Search classes or teachers', 'Maghanap ng klase o guro')} />}
            <TourTarget id="teachers" style={{ gap: 12 }}>
              {pending.filter(matches).map((t, i) => {
                const card = <ClassCard teacher={t} wide={!phone} upcoming={upcoming} draft={(drafts.data ?? []).includes(scopedDraftId(t.offering_id, data.student.id, data.period?.id))} disabled={!openPeriod} onPress={() => open(t)} />;
                return i === 0 ? <TourTarget key={t.offering_id} id="evaluate">{card}</TourTarget> : <View key={t.offering_id}>{card}</View>;
              })}
              {pending.filter(matches).length === 0 && <View style={{ ...panel(), padding: 22, gap: 8 }}>
                <Txt weight="semibold" size={18}>{search ? tr('No matching classes', 'Walang tugmang klase') : pending.length === 0 && completed.length > 0 ? tr('All evaluations completed', 'Tapos lahat ng evaluation') : tr('No classes to evaluate yet', 'Wala pang klaseng ie-evaluate')}</Txt>
                <Txt size={15} color={colors.textSoft}>{search ? tr('Try a different subject or teacher name.', 'Subukan ang ibang subject o pangalan ng guro.') : data.teachers.length === 0 ? tr('Your classes will appear here when your school assigns them.', 'Lalabas dito ang mga klase kapag na-assign na ng paaralan.') : tr('You can find your submitted evaluations in History.', 'Makikita ang mga naipasa mo sa Kasaysayan.')}</Txt>
              </View>}
            </TourTarget>
          </View>

          {completed.length > 0 && <View style={{ gap: 12 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCompleted }} onPress={() => { tap(); setShowCompleted((v) => !v); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Txt weight="semibold" size={17}>{tr(`Completed (${completed.length})`, `Tapos (${completed.length})`)}</Txt>
              <View style={{ transform: [{ rotate: showCompleted ? '180deg' : '0deg' }] }}><Icon name="chevronDown" size={18} /></View>
            </Pressable>
            {showCompleted && <View style={panel()}>{completed.filter(matches).map((t, i) => <Pressable key={t.offering_id} accessibilityRole="button" accessibilityLabel={tr(`View history for ${t.subject.name}`, `Tingnan ang kasaysayan ng ${t.subject.name}`)} onPress={() => router.push('/student/history')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderColor: colors.borderSoft }}>
              <Avatar name={t.teacher.name} initials={t.teacher.initials} size={38} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Txt weight="medium" size={15}>{t.subject.name}</Txt><Txt size={13} color={colors.textSoft}>{t.teacher.name}</Txt></View>
              <Icon name="checkCircle" size={19} color={colors.successFg} />
            </Pressable>)}</View>}
          </View>}
          {phone && <PrivacyNote />}
          {tour.offer && <View style={{ ...panel(), padding: 16, gap: 10 }}>
            <Txt weight="semibold" size={16}>{tr('New here? Take a quick tour', 'Bago ka rito? Mag-tour saglit')}</Txt>
            <Txt size={14} color={colors.muted}>{tr('Professor Wise will show you around.', 'Ipapakita ni Professor Wise kung paano ito gamitin.')}</Txt>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}><Button title={tr('Show me around', 'Ipakita mo')} onPress={tour.start} /><Button title={tr('Not now', 'Mamaya na')} variant="outline" onPress={tour.dismiss} /></View>
          </View>}
        </View>

        {!phone && <View style={{ width: columns ? 300 : '100%', gap: 18 }}>
          <TourTarget id="progress" style={{ ...panel(), padding: 24, gap: 20, alignItems: 'center' }}>
            <Txt weight="semibold" size={20} accessibilityRole="header">{tr('Your progress', 'Progress mo')}</Txt>
            <ProgressRing value={data.progress.percent / 100} size={150} stroke={14} color={colors.brand}><Txt weight="bold" size={30}>{`${data.progress.percent}%`}</Txt></ProgressRing>
            <Txt size={15} color={colors.textSoft}>{tr(`${data.progress.completed} of ${data.progress.total} completed`, `${data.progress.completed} sa ${data.progress.total} ang tapos`)}</Txt>
          </TourTarget>
          <PrivacyNote />
          <Pressable accessibilityRole="button" onPress={() => router.push('/student/wise')} style={{ ...panel(), padding: 20, gap: 8 }}><Txt weight="semibold" size={18}>{tr('Need a little help?', 'Kailangan ng tulong?')}</Txt><Txt size={14} color={colors.textSoft}>{tr('Ask Professor Wise about the evaluation process.', 'Tanungin si Professor Wise tungkol sa evaluation.')}</Txt><Txt weight="semibold" size={14} color={colors.accent} style={{ marginTop: 4 }}>{tr('Ask Wise →', 'Tanungin si Wise →')}</Txt></Pressable>
        </View>}
      </View>
    </ScrollView>
  );
}

function panel(): ViewStyle { return { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border }; }

function ClassCard({ teacher: t, wide, upcoming, draft, disabled, onPress }: { teacher: Teacher; wide: boolean; upcoming: boolean; draft: boolean; disabled: boolean; onPress: () => void }) {
  const { desktop } = useUiScale();
  return <View style={{ ...panel(), padding: desktop ? 22 : 16, gap: 16, flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch' }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: wide ? 1 : undefined, minWidth: 0 }}>
      <Avatar name={t.teacher.name} initials={t.teacher.initials} size={42} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Txt weight="semibold" size={18}>{t.subject.name}</Txt>
        <Txt size={14} color={colors.textSoft}>{t.teacher.name}</Txt>
        {t.subject.code && <Txt size={12} color={colors.muted}>{t.subject.code}</Txt>}
        {draft && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}><Icon name="clipboard" size={13} color={colors.muted} /><Txt size={12} color={colors.muted}>{tr('Draft saved', 'Naka-save ang draft')}</Txt></View>}
      </View>
    </View>
    <Button title={disabled ? upcoming ? tr('Not open yet', 'Hindi pa bukas') : tr('Evaluation closed', 'Sarado ang evaluation') : draft ? tr('Continue', 'Ituloy') : tr('Start evaluation', 'Simulan ang evaluation')} variant={draft ? 'outline' : 'primary'} disabled={disabled} onPress={onPress} style={wide ? { width: desktop ? 196 : 156 } : undefined} />
  </View>;
}

function ProgressSummary({ data }: { data: StudentDashboard }) {
  const open = data.period?.is_open;
  const upcoming = !!data.period && new Date(data.period.opens_at).getTime() > Date.now();
  const soon = isClosingSoon(data.period);
  const dateLabel = open ? soon ? tr('Closing soon · closes', 'Malapit nang magsara · magsasara') : tr('Closes', 'Magsasara') : upcoming ? tr('Opens', 'Bubukas') : tr('Closed', 'Sarado');
  return <View style={{ borderRadius: 16, backgroundColor: colors.brandSoft, padding: 18, gap: 12 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <Txt weight="semibold" size={18} style={{ flex: 1 }}>{tr(`${data.progress.completed} of ${data.progress.total} completed`, `${data.progress.completed} sa ${data.progress.total} ang tapos`)}</Txt>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}><Txt weight="semibold" size={13} color={colors.accent}>{`${data.progress.percent}%`}</Txt></View>
    </View>
    <ProgressBar value={data.progress.percent / 100} height={8} color={colors.brand} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Icon name="calendar" size={16} color={colors.muted} />
      <Txt size={13} color={soon ? colors.urgentFg : colors.textSoft} style={{ flex: 1 }}>{data.period ? `${data.period.name} · ${dateLabel} ${shortDate(upcoming ? data.period.opens_at : data.period.closes_at)}` : tr('Waiting for the next evaluation period', 'Naghihintay sa susunod na evaluation')}</Txt>
    </View>
  </View>;
}

function PrivacyNote() {
  return <View style={{ backgroundColor: colors.brandSoft, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><Icon name="shield" size={22} color={colors.brand} /><Txt size={14} color={colors.textSoft} style={{ flex: 1, lineHeight: 21 }}>{tr('Your identity is hidden from teachers. Your feedback helps improve your classes.', 'Hindi makikita ng guro ang pangalan mo. Nakakatulong ang feedback mo sa pagpapabuti ng klase.')}</Txt></View>;
}

function dashboardSteps(data: StudentDashboard): TourStep[] {
  return [
    { target: 'hero', mood: 'lecture', title: tr('Your progress', 'Progress mo'), text: tr('See how many evaluations you have finished and when the period closes.', 'Tingnan kung ilan ang natapos mo at kailan magsasara ang evaluation.') },
    { target: 'teachers', mood: 'wink', title: tr('Your classes', 'Mga klase mo'), text: tr('Your pending classes appear here. Each card shows the subject and teacher.', 'Nandito ang mga klase na hindi pa tapos. Makikita ang subject at guro.') },
    ...(data.period?.is_open && data.teachers.some((t) => t.status === 'pending') ? [{ target: 'evaluate', mood: 'teach' as const, title: tr('Start an evaluation', 'Simulan ang evaluation'), text: tr('Rate one teacher at a time. Your answers are anonymous.', 'Mag-rate ng isang guro. Anonymous ang mga sagot mo.') }] : []),
    { target: 'ask', mood: 'hello', title: tr('Ask Professor Wise', 'Tanungin si Professor Wise'), text: tr('Tap my head whenever you need help with evaluations.', 'Pindutin ang ulo ko kung kailangan mo ng tulong sa evaluation.') },
  ];
}

function useDashboardTour(data: StudentDashboard) {
  const requested = useTour((s) => s.requested);
  const running = useTour((s) => !!s.steps);
  const introOpen = useUI((s) => s.introOpen);
  const [offer, setOffer] = useState(false);
  useEffect(() => { getPref('tourDone').then((done) => setOffer(done !== '1')); }, [running]);
  useEffect(() => {
    if (!requested || running || introOpen) return;
    const timer = setTimeout(() => useTour.getState().start(dashboardSteps(data)), 600);
    return () => clearTimeout(timer);
  }, [requested, running, introOpen, data]);
  return { offer: offer && !running, start: () => { setOffer(false); useTour.getState().start(dashboardSteps(data)); }, dismiss: () => { setOffer(false); setPref('tourDone', '1'); } };
}
