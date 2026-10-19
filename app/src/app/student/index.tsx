import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStudentDashboard, useWise } from '@/api/hooks';
import type { StudentDashboard } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { FadeIn } from '@/components/Motion';
import { GettingStarted } from '@/components/GettingStarted';
import { AppBar, PageHeader, SearchPill } from '@/components/PageHeader';
import { ProgressBar, ProgressRing, useCountUp } from '@/components/ProgressRing';
import { ScreenState } from '@/components/ScreenState';
import { Bone, BoneRow } from '@/components/Skeleton';
import { StatusChip } from '@/components/StatusChip';
import { Txt } from '@/components/Txt';
import { Sticker, type StickerName } from '@/components/Sticker';
import { WiseHead, WiseMascot, type Mood } from '@/components/WiseMascot';
import { TourTarget, useTour, type TourStep } from '@/components/Tour';
import { BadgeCelebration } from '@/components/Badge';
import { getPref, setPref } from '@/lib/prefs';
import { useTitle } from '@/lib/useTitle';
import { tap, toast, useScrollHide, useUI } from '@/lib/ui';
import { draftIds } from '@/lib/drafts';
import { tr } from '@/lib/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { keys } from '@/api/hooks';
import { greetingWord, parts, periodProgress, shortDate, time } from '@/lib/format';
import { useLayoutSize } from '@/lib/useLayout';
import { colors, radius, shadowStyle, space } from '@/theme';

type Teacher = StudentDashboard['teachers'][number];

export default function StudentHome() {
  const size = useLayoutSize();
  const query = useStudentDashboard();
  const tour = useDashboardTour(query.data);
  useTitle(tr('Dashboard', 'Dashboard'));

  if (!query.data) {
    if (query.isLoading) return <DashboardSkeleton phone={size === 'phone'} />;
    return <ScreenState error={query.error} onRetry={() => query.refetch()} />;
  }

  return (
    <>
      {size === 'phone' ? <PhoneDashboard data={query.data} tour={tour} refreshing={query.isRefetching} onRefresh={() => query.refetch()} /> : <WebDashboard data={query.data} tour={tour} />}
      <BadgeCelebration data={query.data} />
    </>
  );
}

// ---------------------------------------------------------------- guided tour

/**
 * The first time a student opens the dashboard (or when they pick "Take the tour"),
 * Professor Wise walks them through it with a spotlight. Waits for the intro to finish.
 */
function tourSteps(data: StudentDashboard): TourStep[] {
  const canEvaluate = !!data.period && data.teachers.length > 0;
  return [
    { target: 'hero', mood: 'lecture', title: tr('Your next step', 'Ang susunod mong gagawin'), text: tr('This card always tells you **what to do next**, and how long it will take.', 'Laging sinasabi ng card na ito **kung ano ang susunod**, at gaano katagal ito.') },
    { target: 'teachers', mood: 'wink', title: tr('Your teachers', 'Ang mga guro mo'), text: tr('These are the teachers you can evaluate this period. **Tap one** to see their details.', 'Ito ang mga gurong puwede mong i-evaluate ngayon. **Pindutin ang isa** para makita ang detalye.') },
    ...(canEvaluate ? [{ target: 'evaluate', mood: 'teach' as const, title: tr('Evaluate in 3 minutes', 'Mag-evaluate sa loob ng 3 minuto'), text: tr('Tap **Evaluate Now** to rate a teacher. It’s **anonymous**, so be honest.', 'Pindutin ang **Evaluate Now** para i-rate ang guro. **Anonymous** ito, kaya maging tapat.') }] : []),
    { target: 'progress', mood: 'proud', title: tr('Watch your progress', 'Bantayan ang progress mo'), text: tr('This ring fills up as you go. Finish them all and **I’ll celebrate with you**!', 'Napupuno ang bilog habang tumatagal. Tapusin lahat at **magdiriwang tayo**!') },
    { target: 'ask', mood: 'hello', title: tr('I’m always here', 'Lagi akong nandito'), text: tr('Stuck on something? **Ask me** anything about evaluations, any time.', 'May hindi ka maintindihan? **Tanungin mo ako** tungkol sa evaluation, kahit kailan.') },
  ];
}

/**
 * New students are offered a short guided tour (a card on the dashboard, never forced).
 * "Not now" hides it for good; Help → "Take the tour again" brings it back.
 */
function useDashboardTour(data: StudentDashboard | undefined) {
  const requested = useTour((s) => s.requested);
  const introOpen = useUI((s) => s.introOpen);
  const running = useTour((s) => !!s.steps);
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    getPref('tourDone').then((done) => setOffer(done !== '1'));
  }, [running]);

  // "Take the tour again" from Help.
  useEffect(() => {
    if (!data || introOpen || running || !requested) return;
    const t = setTimeout(() => useTour.getState().start(tourSteps(data)), 600);
    return () => clearTimeout(t);
  }, [data, introOpen, requested, running]);

  return {
    offer: offer && !running && !!data,
    start: () => {
      setOffer(false);
      if (data) useTour.getState().start(tourSteps(data));
    },
    dismiss: () => {
      setOffer(false);
      setPref('tourDone', '1');
      toast({ title: tr('No problem!', 'Walang problema!'), body: tr('You can take the tour any time from Help.', 'Puwede kang mag-tour kahit kailan mula sa Tulong.'), mood: 'wink' });
    },
  };
}

/** "New here? Take a 30-second tour" card. */
function TourOffer({ onStart, onDismiss, phone }: { onStart: () => void; onDismiss: () => void; phone?: boolean }) {
  return (
    <FadeIn>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: phone ? 24 : 28, padding: phone ? 14 : 18, borderWidth: 1.5, borderColor: colors.brandSoft }, shadowStyle('soft')]}>
        <View style={{ width: phone ? 48 : 56, height: phone ? 48 : 56, borderRadius: 28, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', alignSelf: 'flex-start' }}>
          <WiseHead size={phone ? 34 : 40} mood="wink" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt weight="semibold" size={phone ? 16 : 18}>{tr('New here? Take a quick tour', 'Bago ka rito? Mag-tour saglit')}</Txt>
          <Txt size={phone ? 13 : 14} color={colors.muted}>{tr('30 seconds. I’ll show you where everything is.', '30 segundo. Ipapakita ko kung nasaan ang lahat.')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable accessibilityRole="button" onPress={onStart} style={({ hovered }: { hovered?: boolean }) => ({ height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: hovered ? colors.navyDeep : colors.navy, justifyContent: 'center' })}>
              <Txt weight="semibold" size={14} color="#FFFFFF">{tr('Show me around', 'Ipakita mo')}</Txt>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDismiss} style={({ hovered }: { hovered?: boolean }) => ({ height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: hovered ? colors.track : 'transparent', justifyContent: 'center' })}>
              <Txt weight="semibold" size={14} color={colors.muted}>{tr('Not now', 'Mamaya na')}</Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </FadeIn>
  );
}

// ---------------------------------------------------------------- shared logic

/** Hours until the period closes, when it is open and closing within a day. */
function urgentHours(data: StudentDashboard): number | null {
  if (!data.period?.is_open) return null;
  const hours = Math.floor((new Date(data.period.closes_at).getTime() - Date.now()) / 3_600_000);
  return hours <= 24 ? Math.max(0, hours) : null;
}

function useDashboardState(data: StudentDashboard) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(
    data.teachers.find((t) => t.status === 'pending')?.offering_id ?? data.teachers[0]?.offering_id ?? null
  );

  const [filter, setFilter] = useState<Filter>('all');
  const drafts = useQuery({ queryKey: ['drafts'], queryFn: draftIds, staleTime: 0 });
  const qc = useQueryClient();

  const teachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.teachers
      .filter((t) => filter === 'all' || (filter === 'pending' ? t.status === 'pending' : t.status === 'completed'))
      .filter((t) => !q || `${t.teacher.name} ${t.subject.code ?? ''} ${t.subject.name}`.toLowerCase().includes(q));
  }, [data.teachers, search, filter]);

  const counts = {
    all: data.teachers.length,
    pending: data.teachers.filter((t) => t.status === 'pending').length,
    done: data.teachers.filter((t) => t.status === 'completed').length,
  };
  const hasDraft = (t: Teacher) => t.status === 'pending' && (drafts.data ?? []).includes(String(t.offering_id));

  const selected = data.teachers.find((t) => t.offering_id === selectedId) ?? data.teachers[0];

  // Load the selected teacher's form in the background, so "Evaluate Now" opens instantly.
  useEffect(() => {
    if (!selected || selected.status !== 'pending' || !data.period?.is_open) return;
    qc.prefetchQuery({ queryKey: keys.form(selected.offering_id), queryFn: () => api(`/student/offerings/${selected.offering_id}/form`), staleTime: 60_000 });
  }, [selected, data.period, qc]);
  const canEvaluate = (t: Teacher) => t.status === 'pending' && !!data.period?.is_open;
  const open = (t: Teacher) => (t.status === 'completed' ? router.push('/student/history') : router.push(`/student/evaluate/${t.offering_id}`));
  const nextPending = data.teachers.find(canEvaluate);
  const allDone = data.progress.total > 0 && data.progress.completed === data.progress.total;

  /** The navy pill under "Schedule" switches between teachers. */
  const cycleSelected = () => {
    if (!data.teachers.length) return;
    const i = data.teachers.findIndex((t) => t.offering_id === selected?.offering_id);
    setSelectedId(data.teachers[(i + 1) % data.teachers.length].offering_id);
  };

  return { search, setSearch, teachers, selected, setSelectedId, canEvaluate, open, nextPending, allDone, cycleSelected, urgent: urgentHours(data), filter, setFilter, counts, hasDraft };
}

type Filter = 'all' | 'pending' | 'done';

/** All · Pending · Evaluated, with counts. */
function FilterChips({ value, onChange, counts }: { value: Filter; onChange: (f: Filter) => void; counts: Record<Filter, number> }) {
  const items: { key: Filter; label: string }[] = [
    { key: 'all', label: tr('All', 'Lahat') },
    { key: 'pending', label: tr('Pending', 'Hindi pa tapos') },
    { key: 'done', label: tr('Evaluated', 'Tapos na') },
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${it.label}, ${counts[it.key]}`}
            onPress={() => {
              tap();
              onChange(it.key);
            }}
            style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({
              height: 38,
              paddingLeft: 14,
              paddingRight: 6,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: on ? colors.navy : hovered ? colors.track : colors.card,
              borderWidth: 1,
              borderColor: on ? colors.navy : colors.borderSoft,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Txt weight="semibold" size={14} color={on ? '#FFFFFF' : colors.textSoft}>{it.label}</Txt>
            <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.chip, alignItems: 'center', justifyContent: 'center' }}>
              <Txt weight="bold" size={12} color={on ? '#FFFFFF' : colors.accent}>{String(counts[it.key])}</Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Draft" pill for an evaluation that was started but not sent. */
function DraftPill() {
  return (
    <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: colors.brandSoft, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="clipboard" size={12} color={colors.accent} strokeWidth={2.2} />
      <Txt weight="semibold" size={12} color={colors.accent}>{tr('Draft', 'Draft')}</Txt>
    </View>
  );
}

function shortTeacher(name: string) {
  const words = name.split(/\s+/);
  return words.length > 2 ? `${words[0]} ${words[1]}` : name; // "Prof. Liza Santos" -> "Prof. Liza"
}

function scheduleRows(data: StudentDashboard, urgent: number | null) {
  const period = data.period!;
  const pending = data.progress.total - data.progress.completed;
  return [
    { iso: period.opens_at, text: tr(`Opens ${time(period.opens_at)}`, `Bubukas ${time(period.opens_at)}`), now: false },
    ...(period.is_open
      ? [{ iso: new Date().toISOString(), text: pending ? (urgent !== null ? tr(`${pending} due in ${urgent}h`, `${pending} sa loob ng ${urgent}h`) : tr(`${pending} evaluation${pending > 1 ? 's' : ''} due`, `${pending} evaluation pa`)) : tr('All evaluations done', 'Tapos lahat ng evaluation'), now: true }]
      : []),
    { iso: period.closes_at, text: tr(`Closes ${time(period.closes_at)}`, `Magsasara ${time(period.closes_at)}`), now: false },
  ];
}

// ================================================================ computer

function WebDashboard({ data, tour }: { data: StudentDashboard; tour: TourControl }) {
  const s = useDashboardState(data);
  const { width } = useWindowDimensions();
  const twoColumns = width >= 1280;
  const sideWidth = Math.min(430, Math.max(340, Math.round(width * 0.27)));
  const scrollHide = useScrollHide();

  return (
    <ScrollView {...scrollHide} contentContainerStyle={{ paddingLeft: 52, paddingRight: 36, paddingTop: 40, paddingBottom: 120, gap: 30 }}>
      <FadeIn>
        <PageHeader
          title={tr('Dashboard', 'Dashboard')}
          search={{ value: s.search, onChange: s.setSearch, placeholder: tr('Search', 'Maghanap') }}
          action={s.nextPending ? { icon: 'plus', label: tr(`Start evaluating ${s.nextPending.teacher.name}`, `Simulan ang pag-evaluate kay ${s.nextPending.teacher.name}`), onPress: () => s.open(s.nextPending!) } : undefined}
        >
          {s.urgent !== null && !s.allDone && <UrgentChip hours={s.urgent} />}
        </PageHeader>
      </FadeIn>

      <View style={{ flexDirection: twoColumns ? 'row' : 'column', gap: 36, alignItems: 'flex-start' }}>
        <View style={{ flex: twoColumns ? 1 : undefined, width: twoColumns ? undefined : '100%', minWidth: 0, gap: 22 }}>
          <TourTarget id="hero">
            <Hero data={data} s={s} />
          </TourTarget>
          {tour.offer && <TourOffer onStart={tour.start} onDismiss={tour.dismiss} />}
          <GettingStarted data={data} />
          <FadeIn delay={80} style={{ gap: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <Txt weight="semibold" size={30} accessibilityRole="header">{tr('Teachers to evaluate', 'Mga gurong ie-evaluate')}</Txt>
              {data.period && <PeriodPill data={data} />}
            </View>
            <FilterChips value={s.filter} onChange={s.setFilter} counts={s.counts} />

            <TourTarget id="teachers" style={{ gap: 4 }}>
              {s.teachers.length === 0 && (
                <EmptyNote
                  sticker={s.search || s.filter !== 'all' ? (s.filter === 'pending' && !s.search ? 'celebrate' : 'think') : 'back'}
                  text={
                    s.search
                      ? tr('No teacher matches your search.', 'Walang gurong tugma sa hinahanap mo.')
                      : s.filter === 'pending'
                        ? tr('Nothing pending. You’re all caught up!', 'Wala nang natitira. Tapos ka na!')
                        : s.filter === 'done'
                          ? tr('You haven’t evaluated anyone yet.', 'Wala ka pang na-evaluate.')
                          : tr('No classes are assigned to your section yet. Please check with your admin.', 'Wala pang klaseng naka-assign sa section mo. Pakitanong sa admin.')
                  }
                />
              )}
              {s.teachers.map((t, i) => (
                <FadeIn key={t.offering_id} delay={120 + i * 60}>
                  <TeacherRow t={t} draft={s.hasDraft(t)} selected={t.offering_id === s.selected?.offering_id} onSelect={() => s.setSelectedId(t.offering_id)} onOpen={() => s.open(t)} disabled={t.status === 'pending' && !data.period?.is_open} />
                </FadeIn>
              ))}
            </TourTarget>
          </FadeIn>

          {data.period && s.selected && (
            <FadeIn delay={300} style={{ gap: 24, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <Txt weight="semibold" size={30} accessibilityRole="header" style={{ flex: 1 }}>{tr('Schedule', 'Iskedyul')}</Txt>
                <Txt size={16} color={colors.textSoft}>{shortDate(new Date().toISOString())}</Txt>
                <NavyPill text={shortTeacher(s.selected.teacher.name)} onPress={s.cycleSelected} />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 38 }}>
                <TeacherCard t={s.selected} canEvaluate={s.canEvaluate(s.selected)} onPress={() => s.open(s.selected!)} />
                <View style={{ flex: 1, minWidth: 380, gap: 34 }}>
                  {scheduleRows(data, s.urgent).map((r) => {
                    const p = parts(r.iso);
                    const fill = r.now ? (s.urgent !== null && !s.allDone ? colors.urgent : colors.navy) : 'transparent';
                    return (
                      <View key={r.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 40 }}>
                        <View style={{ width: 230, height: 100, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 30, paddingHorizontal: 30, backgroundColor: fill, borderWidth: r.now ? 0 : 1.5, borderColor: colors.border }}>
                          <Txt weight="semibold" size={36} color={r.now ? '#FFFFFF' : colors.text}>{String(p.day)}</Txt>
                          <View>
                            <Txt size={20} color={r.now ? '#FFFFFF' : colors.text}>{p.month}</Txt>
                            <Txt weight="semibold" size={20} color={r.now ? '#FFFFFF' : colors.text}>{p.weekday}</Txt>
                          </View>
                        </View>
                        <Txt size={19} color={r.now && s.urgent !== null && !s.allDone ? colors.urgentFg : colors.textSoft} style={{ flexShrink: 1 }}>{r.text}</Txt>
                      </View>
                    );
                  })}
                </View>
              </View>
            </FadeIn>
          )}
        </View>

        <FadeIn delay={160} style={twoColumns ? { width: sideWidth, gap: 24 } : { width: '100%', gap: 24 }}>
          <SideCard data={data} allDone={s.allDone} onOpen={s.open} />
          <WiseTip />
        </FadeIn>
      </View>
    </ScrollView>
  );
}

function TeacherRow({ t, selected, onSelect, onOpen, disabled, draft }: { t: Teacher; selected: boolean; onSelect: () => void; onOpen: () => void; disabled: boolean; draft?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${t.teacher.name}, ${t.subject.name}, ${t.status === 'completed' ? tr('evaluated', 'tapos na') : tr('pending', 'hindi pa')}`}
      onPress={onSelect}
      style={({ hovered }: { hovered?: boolean }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 22, paddingVertical: 14, paddingHorizontal: 26, marginHorizontal: -26, borderRadius: 34 },
        selected ? { backgroundColor: colors.card, ...shadowStyle('lift') } : hovered ? { backgroundColor: colors.track } : null,
      ]}
    >
      <Avatar name={t.teacher.name} initials={t.teacher.initials} size={66} />
      <Txt weight="semibold" size={19} numberOfLines={1} style={{ flex: 1.3, minWidth: 0 }}>{t.teacher.name}</Txt>
      <Txt size={16} color={colors.textSoft} numberOfLines={1} style={{ flex: 1.1, minWidth: 0 }}>
        {[t.subject.code, t.subject.name].filter(Boolean).join(' · ')}
      </Txt>
      <View style={{ width: 112, alignItems: 'flex-start' }}>
        {draft ? <DraftPill /> : <StatusChip status={t.status} compact />}
      </View>
      <DotsAction label={t.status === 'completed' ? tr('View', 'Tingnan') : draft ? tr('Continue', 'Ituloy') : tr('Evaluate', 'I-evaluate')} teacher={t.teacher.name} disabled={disabled} onPress={onOpen} />
    </Pressable>
  );
}

/** The "••" from the design. On hover it opens up into a labelled button so it's clear what it does. */
function DotsAction({ label, teacher, disabled, onPress }: { label: string; teacher: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${teacher}`}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        height: 40,
        minWidth: 44,
        paddingHorizontal: hovered ? 14 : 0,
        borderRadius: 999,
        backgroundColor: hovered && !disabled ? colors.navy : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      })}
    >
      {({ hovered }: { hovered?: boolean }) =>
        hovered && !disabled ? (
          <>
            <Txt weight="semibold" size={14} color="#FFFFFF">{label}</Txt>
            <Icon name="chevronRight" size={14} color="#FFFFFF" strokeWidth={2.4} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 4, opacity: disabled ? 0.35 : 1 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text }} />
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text }} />
          </View>
        )
      }
    </Pressable>
  );
}

function TeacherCard({ t, canEvaluate, onPress, compact }: { t: Teacher; canEvaluate: boolean; onPress: () => void; compact?: boolean }) {
  const blocked = !canEvaluate && t.status === 'pending';
  return (
    <View style={[{ width: compact ? '100%' : 250, backgroundColor: colors.card, borderRadius: 34, paddingVertical: compact ? 22 : 34, paddingHorizontal: 22, alignItems: 'center', gap: 6 }, shadowStyle('soft')]}>
      <Avatar name={t.teacher.name} initials={t.teacher.initials} size={compact ? 76 : 90} />
      <Txt weight="semibold" size={19} style={{ marginTop: 14, textAlign: 'center' }}>{t.teacher.name}</Txt>
      <Txt size={16} color={colors.textSoft} style={{ textAlign: 'center' }}>{[t.subject.code, t.subject.name].filter(Boolean).join(' · ')}</Txt>
      <Txt size={16} color={colors.textSoft} style={{ textAlign: 'center' }}>{t.schedule ?? t.teacher.department ?? ''}</Txt>
      <TourTarget id="evaluate" style={{ marginTop: 18 }}>
      <Pressable
        accessibilityRole="button"
        disabled={blocked}
        onPress={onPress}
        style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({
          transform: [{ scale: pressed ? 0.96 : 1 }],
          height: 50,
          paddingHorizontal: 28,
          borderRadius: 999,
          backgroundColor: blocked ? colors.disabled : hovered ? colors.navyDeep : colors.navy,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Txt weight="semibold" size={18} color="#FFFFFF">{t.status === 'completed' ? tr('View Evaluation', 'Tingnan') : tr('Evaluate Now', 'I-evaluate Na')}</Txt>
      </Pressable>
      </TourTarget>
    </View>
  );
}

function SideCard({ data, allDone, phone, onOpen }: { data: StudentDashboard; allDone: boolean; phone?: boolean; onOpen: (t: Teacher) => void }) {
  const pp = data.period?.is_open ? periodProgress(data.period.opens_at, data.period.closes_at) : null;
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: phone ? space.xl : space.xxl, paddingVertical: phone ? space.xl : space.xxl, gap: space.xxl }, shadowStyle('soft')]}>
      <View style={{ gap: phone ? space.lg : space.xl }}>
        <Txt weight="semibold" size={phone ? 24 : 28} accessibilityRole="header">{tr('My Subjects', 'Mga Subject Ko')}</Txt>
        {data.subjects.length === 0 && <EmptyNote text={tr('Your subjects will show here once your section has classes.', 'Lalabas dito ang mga subject mo kapag may klase na ang section mo.')} />}
        {data.subjects.map((sub) => {
          const t = data.teachers.find((x) => x.subject.name === sub.name && (x.subject.code ?? null) === (sub.code ?? null));
          const done = t?.status === 'completed';
          const blocked = !t || (t.status === 'pending' && !data.period?.is_open);
          return (
            <Pressable
              key={`${sub.code}-${sub.name}`}
              accessibilityRole="button"
              accessibilityLabel={t ? `${sub.name}, ${t.teacher.name}, ${done ? tr('evaluated', 'tapos na') : tr('not yet evaluated', 'hindi pa na-evaluate')}` : sub.name}
              disabled={blocked && !done}
              onPress={() => t && onOpen(t)}
              style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 10, margin: -10, borderRadius: 22, backgroundColor: hovered && !(blocked && !done) ? colors.surface : 'transparent', transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: done ? colors.successBg : colors.navy, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={done ? 'check' : 'book'} size={22} color={done ? colors.successFg : '#FFFFFF'} strokeWidth={done ? 2.6 : 1.7} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt weight="semibold" size={phone ? 16 : 18} numberOfLines={2}>{sub.name}</Txt>
                <Txt size={14} color={colors.textSoft} numberOfLines={1}>{[`${sub.units} ${tr('Units', 'Yunit')}`, sub.code, t ? shortTeacher(t.teacher.name) : null].filter(Boolean).join(' · ')}</Txt>
              </View>
              {t && !(blocked && !done) && <Icon name="chevronRight" size={18} color={colors.muted} strokeWidth={2.2} />}
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 26 }}>
        <Txt weight="semibold" size={phone ? 24 : 28} accessibilityRole="header">{tr('Evaluation Progress', 'Progress ng Evaluation')}</Txt>
        <TourTarget id="progress" style={{ alignItems: 'center', alignSelf: 'center' }}>
          <View accessible accessibilityLabel={tr(`${data.progress.percent} percent, ${data.progress.completed} of ${data.progress.total} evaluations done`, `${data.progress.percent} porsiyento, ${data.progress.completed} sa ${data.progress.total} evaluation ang tapos`)}>
            <Donut percent={data.progress.percent} size={phone ? 180 : 200} done={allDone} />
          </View>
        </TourTarget>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt weight="semibold" size={15}>{tr('Progress', 'Progress')}</Txt>
            <Txt size={15} color={colors.textSoft}>{pp ? tr(`Day ${Math.max(1, pp.day)} of ${pp.totalDays}`, `Araw ${Math.max(1, pp.day)} sa ${pp.totalDays}`) : tr(`${data.progress.completed} of ${data.progress.total}`, `${data.progress.completed} sa ${data.progress.total}`)}</Txt>
          </View>
          <ProgressBar value={pp ? pp.ratio : data.progress.percent / 100} height={8} />
        </View>
      </View>
    </View>
  );
}

/** Thick ring with a raised centre, as in the design. Fills up when it appears; turns green with a tick at 100%. */
function Donut({ percent, size, done }: { percent: number; size: number; done: boolean }) {
  const stroke = Math.round(size * 0.2);
  const inner = size - stroke * 2 + 14;
  const shown = Math.round(useCountUp(percent));
  return (
    <ProgressRing value={percent / 100} size={size} stroke={stroke} color={done ? colors.successFg : colors.navy}>
      <View style={[{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, shadowStyle('lift')]}>
        {done ? (
          <>
            <WiseHead size={Math.round(inner * 0.42)} mood="laugh" pop />
            <Txt weight="semibold" size={14} color={colors.successFg}>{tr('All done', 'Tapos lahat')}</Txt>
          </>
        ) : (
          <Txt weight="medium" size={Math.round(size * 0.22)} style={{ letterSpacing: -1 }}>{`${shown}%`}</Txt>
        )}
      </View>
    </ProgressRing>
  );
}

/** A personal tip from Professor Wise, under the progress card. */
function WiseTip() {
  const router = useRouter();
  const wise = useWise();
  if (!wise.data?.tip) return null;

  return (
    <View style={{ backgroundColor: colors.frame, borderRadius: 32, padding: 26, paddingTop: 22, gap: 14 }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, bottom: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(142,144,255,0.22)', justifyContent: 'center', marginBottom: 6 }}>
            <Txt weight="semibold" size={12} color="#C9CBFF" style={{ letterSpacing: 0.6 }}>{tr('TIP FOR YOU', 'TIP PARA SA IYO')}</Txt>
          </View>
          <Txt weight="semibold" size={19} color="#FFFFFF">{tr('Professor Wise says', 'Sabi ni Professor Wise')}</Txt>
        </View>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lightbulb" size={26} color="#FFD66B" strokeWidth={1.9} />
        </View>
      </View>
      <Txt size={16} color="#FFFFFF" style={{ lineHeight: 23 }}>{wise.data.tip}</Txt>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/student/wise')}
        style={({ hovered }: { hovered?: boolean }) => ({ alignSelf: 'flex-start', height: 44, paddingHorizontal: 20, borderRadius: 999, backgroundColor: hovered ? '#E9EAFB' : '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8 })}
      >
        <Txt weight="semibold" size={15} color="#0B0B6E">{tr('Ask Professor Wise', 'Magtanong kay Professor Wise')}</Txt>
        <Icon name="chevronRight" size={14} color="#0B0B6E" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

type DashState = ReturnType<typeof useDashboardState>;
type TourControl = ReturnType<typeof useDashboardTour>;

/**
 * The welcome card at the top: one sentence about where the student stands,
 * one button for the next step, and Professor Wise in a matching pose.
 */
function Hero({ data, s, phone }: { data: StudentDashboard; s: DashState; phone?: boolean }) {
  const pending = data.progress.total - data.progress.completed;
  const next = s.nextPending;
  let mood: Mood = 'lecture';
  let title = '';
  let body = '';
  let cta: { label: string; onPress: () => void } | null = null;

  if (!data.period) {
    mood = 'working';
    title = tr('No evaluation is open yet', 'Wala pang bukas na evaluation');
    body = tr('You’ll get a notification as soon as the next one starts.', 'Makakatanggap ka ng notification kapag nagsimula na ang susunod.');
  } else if (s.allDone) {
    mood = 'party';
    title = tr('All evaluations submitted!', 'Naipasa na lahat ng evaluation!');
    body = tr(`Thank you! Your ${data.period.name} feedback helps your teachers improve.`, `Salamat! Nakakatulong ang ${data.period.name} feedback mo sa mga guro.`);
    cta = { label: tr('See my history', 'Tingnan ang kasaysayan'), onPress: () => s.open(data.teachers.find((t) => t.status === 'completed')!) };
  } else if (!data.period.is_open) {
    mood = 'stern';
    title = tr(`${data.period.name} opens soon`, `Malapit nang magbukas ang ${data.period.name}`);
    body = tr(`You’ll be able to evaluate ${pending} teacher${pending === 1 ? '' : 's'} once it opens on ${shortDate(data.period.opens_at)}.`, `Maie-evaluate mo ang ${pending} guro pagbukas nito sa ${shortDate(data.period.opens_at)}.`);
  } else if (s.urgent !== null) {
    mood = 'surprised';
    title = s.urgent <= 1 ? tr('Closes within the hour!', 'Magsasara sa loob ng isang oras!') : tr(`Closes in ${s.urgent} hours!`, `Magsasara sa loob ng ${s.urgent} oras!`);
    body = `${pending} teacher${pending === 1 ? '' : 's'} left. Each one takes about 3 minutes.`;
  } else {
    mood = data.progress.completed > 0 ? 'cheer' : 'lecture';
    title = data.progress.completed > 0 ? tr(`Nice work! ${pending} to go`, `Galing! ${pending} pa`) : tr(`${pending} teacher${pending === 1 ? '' : 's'} to evaluate`, `${pending} guro ang ie-evaluate`);
    body = tr(`About ${pending * 3} minutes in total. It’s anonymous, so be honest.`, `Mga ${pending * 3} minuto lahat. Anonymous ito, kaya maging tapat.`);
  }
  if (next && !s.allDone) cta = { label: s.hasDraft(next) ? tr(`Continue with ${shortTeacher(next.teacher.name)}`, `Ituloy kay ${shortTeacher(next.teacher.name)}`) : tr(`Start with ${shortTeacher(next.teacher.name)}`, `Simulan kay ${shortTeacher(next.teacher.name)}`), onPress: () => s.open(next) };

  const stickerSize = phone ? 132 : 196;
  const urgentTone = mood === 'surprised';

  return (
    <FadeIn style={{ marginTop: phone ? 26 : 30 }}>
      <View style={{ backgroundColor: urgentTone ? colors.urgentCard : colors.frame, borderRadius: phone ? 30 : 36, paddingVertical: phone ? 22 : 30, paddingLeft: phone ? 22 : 34, paddingRight: phone ? stickerSize * 0.86 : stickerSize + 8, minHeight: phone ? 150 : 176, overflow: 'visible' }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: phone ? 30 : 36, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -50, top: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)' }} />
          <View style={{ position: 'absolute', right: 90, bottom: -90, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        </View>
        <Txt weight="medium" size={phone ? 13 : 15} color={urgentTone ? '#FFF1E8' : colors.onFrameMuted}>{`${greetingWord().replace(',', '')}, ${data.student.name.split(' ')[0]}`}</Txt>
        <Txt weight="bold" size={phone ? 22 : 30} color="#FFFFFF" style={{ marginTop: 4, letterSpacing: -0.5, lineHeight: phone ? 28 : 36 }} accessibilityRole="header">{title}</Txt>
        <Txt size={phone ? 14 : 16} color={urgentTone ? '#FFF1E8' : colors.onFrameMuted} style={{ marginTop: 6, lineHeight: phone ? 20 : 23 }}>{body}</Txt>
        {cta && (
          <Pressable
            accessibilityRole="button"
            onPress={cta.onPress}
            style={({ hovered }: { hovered?: boolean }) => ({ marginTop: phone ? 14 : 18, alignSelf: 'flex-start', height: phone ? 42 : 48, paddingHorizontal: phone ? 16 : 22, borderRadius: 999, backgroundColor: hovered ? '#E9EAFB' : '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8 })}
          >
            <Txt weight="semibold" size={phone ? 14 : 16} color={urgentTone ? '#8A2E07' : '#0B0B6E'} numberOfLines={1}>{cta.label}</Txt>
            <Icon name="chevronRight" size={14} color={urgentTone ? '#8A2E07' : '#0B0B6E'} strokeWidth={2.4} />
          </Pressable>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', right: phone ? 0 : 14, bottom: 0 }}>
          <WiseMascot size={stickerSize} mood={mood} shadow={false} />
        </View>
      </View>
    </FadeIn>
  );
}

function EmptyNote({ text, sticker }: { text: string; sticker?: StickerName }) {
  if (!sticker) return <Txt size={16} color={colors.muted} style={{ paddingVertical: 12 }}>{text}</Txt>;
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
      <Sticker name={sticker} size={110} />
      <Txt size={16} color={colors.muted} style={{ textAlign: 'center', maxWidth: 340 }}>{text}</Txt>
    </View>
  );
}

function UrgentChip({ hours }: { hours: number }) {
  return (
    <View style={{ height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.urgentBg, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
      <Icon name="clock" size={18} color={colors.urgentFg} strokeWidth={2} />
      <Txt weight="semibold" size={15} color={colors.urgentFg}>{hours <= 1 ? tr('Closes within the hour', 'Magsasara sa loob ng isang oras') : tr(`Closes in ${hours} hours`, `Magsasara sa loob ng ${hours} oras`)}</Txt>
    </View>
  );
}

/** Shows the period and whether it is open (it isn't a menu, so no arrow). */
function PeriodPill({ data }: { data: StudentDashboard }) {
  const open = !!data.period?.is_open;
  return (
    <View style={[{ height: 50, paddingHorizontal: 24, borderRadius: 999, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10 }, shadowStyle('soft')]}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: open ? colors.successFg : colors.muted }} />
      <Txt size={18} color={colors.textSoft}>{`${data.period?.name} · ${open ? tr('Open', 'Bukas') : tr('Upcoming', 'Paparating')}`}</Txt>
    </View>
  );
}

function NavyPill({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr(`Showing ${text}. Switch teacher`, `Ipinapakita si ${text}. Palitan ang guro`)}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({ height: 50, paddingHorizontal: 28, borderRadius: 999, backgroundColor: hovered ? colors.navyDeep : colors.navy, flexDirection: 'row', alignItems: 'center', gap: 10 })}
    >
      <Txt size={18} color="#FFFFFF">{text}</Txt>
      <Icon name="chevronDown" size={16} color="#FFFFFF" strokeWidth={2.2} />
    </Pressable>
  );
}

function DashboardSkeleton({ phone }: { phone: boolean }) {
  return (
    <View style={{ padding: phone ? 20 : 48, gap: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
        <Bone width={phone ? 160 : 200} height={34} />
        {!phone && <Bone width={360} height={52} radius={26} />}
      </View>
      <View style={{ flexDirection: 'row', gap: 32 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Bone width={phone ? 220 : 280} height={28} />
          {[0, 1, 2, 3].map((i) => (
            <BoneRow key={i} avatar={phone ? 52 : 66} />
          ))}
        </View>
        {!phone && (
          <View style={{ width: 360, gap: 20 }}>
            <Bone height={300} radius={36} />
            <Bone height={160} radius={32} />
          </View>
        )}
      </View>
    </View>
  );
}

// ================================================================ phone

function PhoneDashboard({ data, tour, refreshing, onRefresh }: { data: StudentDashboard; tour: TourControl; refreshing: boolean; onRefresh: () => void }) {
  const s = useDashboardState(data);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, gap: 22 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      <FadeIn style={{ gap: 16 }}>
        <AppBar title={tr('Dashboard', 'Dashboard')} subtitle={data.student.section?.label ?? tr('Student', 'Estudyante')} />
        <SearchPill value={s.search} onChange={s.setSearch} placeholder={tr('Search teachers', 'Maghanap ng guro')} />
      </FadeIn>

      <TourTarget id="hero">
        <Hero data={data} s={s} phone />
      </TourTarget>
      {tour.offer && <TourOffer onStart={tour.start} onDismiss={tour.dismiss} phone />}
      <GettingStarted data={data} compact />

      <FadeIn delay={80}>
       <TourTarget id="teachers" style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt weight="semibold" size={22} accessibilityRole="header">{tr('Teachers to evaluate', 'Mga gurong ie-evaluate')}</Txt>
          {data.period && <Txt weight="medium" size={14} color={data.period.is_open ? colors.successFg : colors.textSoft}>{`${data.period.name} · ${data.period.is_open ? tr('Open', 'Bukas') : tr('Upcoming', 'Paparating')}`}</Txt>}
        </View>
        <FilterChips value={s.filter} onChange={s.setFilter} counts={s.counts} />
        {s.teachers.length === 0 && (
          <EmptyNote
            sticker={s.search || s.filter !== 'all' ? (s.filter === 'pending' && !s.search ? 'celebrate' : 'think') : 'back'}
            text={
              s.search
                ? tr('No teacher matches your search.', 'Walang gurong tugma sa hinahanap mo.')
                : s.filter === 'pending'
                  ? tr('Nothing pending. You’re all caught up!', 'Wala nang natitira. Tapos ka na!')
                  : s.filter === 'done'
                    ? tr('You haven’t evaluated anyone yet.', 'Wala ka pang na-evaluate.')
                    : tr('No classes are assigned to your section yet.', 'Wala pang klaseng naka-assign sa section mo.')
            }
          />
        )}
        {s.teachers.map((t, i) => {
          const on = t.offering_id === s.selected?.offering_id;
          const blocked = t.status === 'pending' && !data.period?.is_open;
          return (
            <FadeIn key={t.offering_id} delay={120 + i * 60}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.teacher.name}, ${t.subject.name}, ${t.status === 'completed' ? tr('evaluated', 'tapos na') : tr('pending', 'hindi pa')}`}
                onPress={() => s.setSelectedId(t.offering_id)}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: -12, borderRadius: 26 }, on ? { backgroundColor: colors.card, ...shadowStyle('lift') } : null]}
              >
                <Avatar name={t.teacher.name} initials={t.teacher.initials} size={52} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Txt weight="semibold" size={16} numberOfLines={1}>{t.teacher.name}</Txt>
                  <Txt size={13} color={colors.textSoft} numberOfLines={1}>{[t.subject.code, t.subject.name].filter(Boolean).join(' · ')}</Txt>
                  <View style={{ flexDirection: 'row' }}>
                    {s.hasDraft(t) ? <DraftPill /> : <StatusChip status={t.status} compact />}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.status === 'completed' ? tr(`View evaluation for ${t.teacher.name}`, `Tingnan ang evaluation kay ${t.teacher.name}`) : tr(`Evaluate ${t.teacher.name}`, `I-evaluate si ${t.teacher.name}`)}
                  disabled={blocked}
                  onPress={() => s.open(t)}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: blocked ? colors.track : t.status === 'completed' ? colors.chip : colors.navy, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="chevronRight" size={20} color={t.status === 'completed' ? colors.accent : '#FFFFFF'} strokeWidth={2.4} />
                </Pressable>
              </Pressable>
            </FadeIn>
          );
        })}
       </TourTarget>
      </FadeIn>

      {data.period && s.selected && (
        <FadeIn delay={300} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Txt weight="semibold" size={22} style={{ flex: 1 }} accessibilityRole="header">{tr('Schedule', 'Iskedyul')}</Txt>
            <NavyPill text={shortTeacher(s.selected.teacher.name)} onPress={s.cycleSelected} />
          </View>
          <TeacherCard t={s.selected} canEvaluate={s.canEvaluate(s.selected)} onPress={() => s.open(s.selected!)} compact />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {scheduleRows(data, s.urgent).map((r) => {
              const p = parts(r.iso);
              const fill = r.now ? (s.urgent !== null && !s.allDone ? colors.urgent : colors.navy) : 'transparent';
              return (
                <View key={r.text} style={{ flex: 1, gap: 8 }}>
                  <View style={{ height: 86, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: fill, borderWidth: r.now ? 0 : 1.5, borderColor: colors.border }}>
                    <Txt weight="semibold" size={26} color={r.now ? '#FFFFFF' : colors.text}>{String(p.day)}</Txt>
                    <Txt weight="medium" size={13} color={r.now ? '#FFFFFF' : colors.text}>{`${p.month} · ${p.weekday.slice(0, 3)}`}</Txt>
                  </View>
                  <Txt size={12} color={colors.textSoft} style={{ textAlign: 'center' }}>{r.text}</Txt>
                </View>
              );
            })}
          </View>
        </FadeIn>
      )}

      <FadeIn delay={360} style={{ gap: 20 }}>
        <WiseTip />
        <SideCard data={data} allDone={s.allDone} phone onOpen={s.open} />
      </FadeIn>
    </ScrollView>
  );
}
