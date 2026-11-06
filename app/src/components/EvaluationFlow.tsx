import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { Period, Person, Question } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { Icon } from '@/components/Icon';
import { FadeIn } from '@/components/Motion';
import { ProgressBar } from '@/components/ProgressRing';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { WiseMascot } from '@/components/WiseMascot';
import { tap, toast, useHideLauncher } from '@/lib/ui';
import { useAuth } from '@/auth/store';
import { scopedDraftId, clearDraft, getDraft, saveDraft, type Draft } from '@/lib/drafts';
import { tr } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import { useQueryClient } from '@tanstack/react-query';
import { useIsWide } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, fonts, shadowStyle } from '@/theme';

const stages = () => [tr('Rate', 'Rating'), tr('Comment', 'Komento'), tr('Review', 'Suriin'), tr('Done', 'Tapos')];

export interface EvaluationFormData {
  teacher: Person;
  /** e.g. "IT 301 · Data Communications · Midterm" */
  subtitle: string;
  period: Period | null;
  scale: Record<string, string>;
  questions: Question[];
  already_submitted: boolean;
}

export interface EvaluationAnswers {
  answers: { question_id: number; rating?: number; answer_text?: string }[];
  comment?: string;
}

/**
 * The full evaluation experience, shared by students (rating teachers) and teachers (peer evaluation):
 * one question at a time with Professor Wise reacting, Next to move on, comments, a review step,
 * drafts saved on the device, and a celebration at the end.
 */
export function EvaluationFlow({
  form: data,
  loading,
  error,
  onRetry,
  draftKey,
  homeHref,
  submitting,
  submitError,
  onSubmit,
}: {
  form: EvaluationFormData | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Where the draft is kept, e.g. the class offering id or "peer-12". */
  draftKey: string | number;
  homeHref: string;
  submitting: boolean;
  submitError: unknown;
  onSubmit: (answers: EvaluationAnswers, onSuccess: () => void) => void;
}) {
  const insets = useSafeAreaInsets();
  const accountId = useAuth((state) => state.user?.id ?? 0);
  const id = scopedDraftId(draftKey, accountId, data?.period?.id);
  const router = useRouter();
  const wide = useIsWide();
  const form = { data };
  useHideLauncher();
  useTitle(data ? `${tr('Evaluate', 'Mag-evaluate')} ${data.teacher.name}` : tr('Evaluate', 'Mag-evaluate'));

  // step 0..n-1 = rating questions, n = comments, n+1 = review
  const [step, setStep] = useState(0);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();
  // A draft from last time: offered once, then answers are saved as you go.
  const [offer, setOffer] = useState<Draft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const draftWrite = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!form.data || draftChecked) return;
    setDraftChecked(true);
    if (form.data.already_submitted || !form.data.period?.is_open) return;
    getDraft(id).then((d) => {
      if (d && (Object.keys(d.ratings).length || d.comment || Object.values(d.texts ?? {}).some((value) => value.trim()))) setOffer(d);
    });
  }, [form.data, draftChecked, id]);

  const answered = Object.keys(ratings).length > 0 || comment.trim() !== '' || Object.values(texts).some((t) => t.trim());
  const persist = () => {
    setSaveState('saving');
    const write = draftWrite.current.catch(() => {}).then(() => saveDraft(id, { step, ratings, texts, comment }));
    draftWrite.current = write;
    return write;
  };
  useEffect(() => {
    if (!draftChecked || offer || done || !answered) return;
    let active = true;
    setSaveState('saving');
    const timer = setTimeout(() => {
      persist().then(() => { if (active) { setSavedAt(Date.now()); setSaveState('saved'); } })
        .catch(() => { if (active) setSaveState('error'); });
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [ratings, texts, comment, step, draftChecked, offer, done, answered, id]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !answered || done || saveState === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [answered, done, saveState]);

  const ratingQs: Question[] = form.data?.questions.filter((q) => q.type === 'rating') ?? [];
  const textQs: Question[] = form.data?.questions.filter((q) => q.type === 'text') ?? [];
  const n = ratingQs.length;
  const commentStep = n;
  const reviewStep = n + 1;
  const current = step < n ? ratingQs[step] : undefined;

  const cancelAdvance = () => {
    if (advance.current) clearTimeout(advance.current);
    advance.current = null;
  };
  const goTo = (s: number) => {
    cancelAdvance();
    setStep(s);
  };

  /** Pick a rating. Professor Wise reacts; the person moves on with Next when they are ready. */
  const pick = (value: number) => {
    if (!current) return;
    tap();
    setRatings((r) => ({ ...r, [current.id]: value }));
  };

  /** Next: the following question, or straight back to the review when changing one answer. */
  const next = () => {
    if (!current || ratings[current.id] === undefined) return;
    if (editingFromReview) {
      setEditingFromReview(false);
      goTo(reviewStep);
    } else {
      goTo(Math.min(step + 1, commentStep));
    }
  };

  useEffect(() => cancelAdvance, []);

  // Computers: number keys 1–5 rate, arrow keys move between questions.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || done || offer) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (current && /^[1-5]$/.test(e.key)) pick(Number(e.key));
      else if (e.key === 'ArrowLeft' && step > 0) goTo(step - 1);
      else if (e.key === 'ArrowRight' && current && ratings[current.id] !== undefined) next();
      else if (e.key === 'ArrowRight' && step === commentStep && ratingQs.every((q) => ratings[q.id] !== undefined)) goTo(reviewStep);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const goHome = () => router.replace(homeHref as Href);
  const saveAndExit = async () => {
    if (!answered) { goHome(); return; }
    try { await persist(); setSaveState('saved'); await qc.invalidateQueries({ queryKey: ['drafts'] }); goHome(); }
    catch { setSaveState('error'); }
  };
  const back = () => (answered && !done ? void saveAndExit() : router.canGoBack() ? router.back() : goHome());

  if (!form.data) return <ScreenState loading={loading} error={error} onRetry={onRetry} />;

  const { teacher, period, already_submitted } = form.data;
  // Scale words in the chosen language (the server sends English).
  // The school's own rating labels, already in the person's language.
  const scale = form.data.scale;
  const allRated = ratingQs.every((q) => ratings[q.id] !== undefined);

  const send = () => {
    onSubmit(
      {
        answers: [
          ...ratingQs.map((q) => ({ question_id: q.id, rating: ratings[q.id] })),
          ...textQs.filter((q) => texts[q.id]?.trim()).map((q) => ({ question_id: q.id, answer_text: texts[q.id].trim() })),
        ],
        comment: comment.trim() || undefined,
      },
      () => {
        tap(30);
        draftWrite.current.catch(() => {}).then(() => clearDraft(id)).then(() => qc.invalidateQueries({ queryKey: ['drafts'] }));
        setDone(true);
        toast({ title: tr('Evaluation sent', 'Naipadala ang evaluation'), body: tr(`${teacher.name} will only see combined, anonymous results.`, ` Pinagsama-sama at anonymous na resulta lang ang makikita ni ${teacher.name}.`), tone: 'success', mood: 'proud' });
      }
    );
  };

  const blocked = already_submitted ? tr('You already evaluated this teacher for this period.', 'Na-evaluate mo na ang gurong ito ngayong period.') : !period?.is_open ? period && new Date(period.opens_at).getTime() > Date.now() ? tr(`This evaluation opens ${shortDate(period.opens_at)}.`, `Magbubukas ang evaluation sa ${shortDate(period.opens_at)}.`) : tr('The evaluation period is closed right now.', 'Sarado ang evaluation ngayon.') : null;
  const stage = done ? 3 : step === reviewStep ? 2 : step === commentStep ? 1 : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={{ flex: 1 }} ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: wide ? 32 : 20, paddingBottom: 24, gap: 18, width: '100%', maxWidth: 860, alignSelf: 'center', flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Back', 'Bumalik')}
          onPress={back}
          style={[{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, shadowStyle('soft')]}
        >
          <Icon name="arrowLeft" size={20} strokeWidth={2} />
        </Pressable>
        <Txt weight="semibold" size={22} accessibilityRole="header" style={{ flex: 1 }}>{step === reviewStep ? tr('Review', 'Suriin') : tr('Evaluate', 'Mag-evaluate')}</Txt>
        {!done && !blocked && !offer && <Pressable accessibilityRole="button" onPress={() => void saveAndExit()} disabled={saveState === 'saving'} style={{ minHeight: 44, maxWidth: '40%', justifyContent: 'center' }}><Txt weight="medium" size={14} color={colors.accent}>{tr('Save & exit', 'I-save at lumabas')}</Txt></Pressable>}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="shield" size={15} color={colors.brand} /><Txt size={12} color={colors.textSoft}>{tr('Anonymous feedback', 'Anonymous na feedback')}</Txt></View>
      <View style={{ backgroundColor: colors.frame, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={teacher.name} initials={teacher.initials} size={52} />
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={18} color="#FFFFFF">{teacher.name}</Txt>
          <Txt size={14} color={colors.onNavyMuted}>{form.data.subtitle}</Txt>
        </View>
      </View>

      {!blocked && wide && <Stepper current={stage} />}

      {done ? (
        <FadeIn style={{ flex: 1 }}>
          <View style={[{ flex: 1, backgroundColor: colors.card, borderRadius: 28, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'hidden' }, shadowStyle('soft')]}>
            <View>
              <WiseMascot size={wide ? 210 : 170} mood="party" />
              <Confetti spread={wide ? 260 : 200} />
            </View>
            <Txt weight="bold" size={26} accessibilityRole="header" style={{ textAlign: 'center' }}>{tr('Evaluation sent', 'Naipadala ang evaluation')}</Txt>
            <Txt size={16} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 24, maxWidth: 420 }}>
              {tr('Thank you. Your answers are anonymous and help your teacher improve.', 'Salamat. Anonymous ang mga sagot mo at makakatulong ito sa guro mo.')}
            </Txt>
            <Button title={tr('Back to Home', 'Bumalik sa Home')} size="lg" onPress={goHome} style={{ marginTop: 10 }} />
          </View>
        </FadeIn>
      ) : blocked ? (
        <View style={[{ backgroundColor: colors.card, borderRadius: 28, padding: 28, gap: 16, alignItems: 'center' }, shadowStyle('soft')]}>
          <WiseMascot size={150} mood={already_submitted ? 'proud' : 'stern'} />
          <Txt size={17} style={{ lineHeight: 25, textAlign: 'center' }}>{blocked}</Txt>
          <Button title={tr('Back to Home', 'Bumalik sa Home')} variant="outline" onPress={goHome} />
        </View>
      ) : offer ? (
        <FadeIn>
          <View style={[{ backgroundColor: colors.card, borderRadius: 28, padding: 24, gap: 16, alignItems: 'center' }, shadowStyle('soft')]}>
            <WiseMascot size={wide ? 160 : 130} mood="writing" />
            <Txt weight="bold" size={22} style={{ textAlign: 'center' }} accessibilityRole="header">{tr('Continue where you left off?', 'Ituloy kung saan ka tumigil?')}</Txt>
            <Txt size={16} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 23, maxWidth: 420 }}>
              {tr(
                `You already answered ${Object.keys(offer.ratings).length} of ${n} questions. I kept them safe on this device.`,
                `Nasagutan mo na ang ${Object.keys(offer.ratings).length} sa ${n} tanong. Itinabi ko ang mga ito sa device na ito.`
              )}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
              <Button
                title={tr('Start over', 'Magsimula ulit')}
                variant="outline"
                size="lg"
                onPress={() => {
                  clearDraft(id);
                  setOffer(null);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title={tr('Continue', 'Ituloy')}
                size="lg"
                onPress={() => {
                  setRatings(offer.ratings);
                  setTexts(offer.texts);
                  setComment(offer.comment);
                  setStep(Math.min(offer.step, n + 1));
                  setOffer(null);
                  tap();
                }}
                style={{ flex: 1.3 }}
              />
            </View>
          </View>
        </FadeIn>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt weight="semibold" size={14}>{step < n ? tr(`Question ${step + 1} of ${n}`, `Tanong ${step + 1} sa ${n}`) : step === commentStep ? tr('Almost done', 'Malapit na') : tr('Last check', 'Huling silip')}</Txt>
              <Txt size={14} color={colors.muted}>{step < n ? current?.category ?? '' : step === commentStep ? tr('Comments', 'Komento') : tr('Review', 'Suriin')}</Txt>
            </View>
            <ProgressBar value={Math.min(1, (step + 1) / (n + 2))} height={8} />

          </View>

          <FadeIn key={step} distance={16}>
            <View style={{ borderRadius: 16, borderWidth: wide ? 1 : 0, borderColor: colors.borderSoft, paddingVertical: wide ? 24 : 6, paddingHorizontal: wide ? 24 : 0, gap: 18, backgroundColor: wide ? colors.card : colors.surface }}>
              {step < n && current ? (
                <>
                  <Reaction value={ratings[current.id] ?? null} wide={wide} />
                  <Txt weight="semibold" size={wide ? 24 : 21} style={{ lineHeight: wide ? 30 : 27, marginHorizontal: 4 }} accessibilityRole="header">
                    {current.text}
                  </Txt>
                  <RatingCards scale={scale} value={ratings[current.id]} onPick={pick} wide={wide} />
                  {wide && <Txt size={13} color={colors.muted} style={{ textAlign: 'center' }}>{tr('Tip: press 1 to 5 to choose, then → for the next question. ← goes back.', 'Tip: pindutin ang 1 hanggang 5 para pumili, saka → para sa susunod na tanong. ← para bumalik.')}</Txt>}
                </>
              ) : step === commentStep ? (
                <View style={{ gap: 16 }}>
                  <Reaction value="comment" wide={wide} />
                  <Txt weight="semibold" size={20} accessibilityRole="header" style={{ marginHorizontal: 4 }}>{tr('Anything else to share?', 'May gusto ka pang ibahagi?')}</Txt>
                  {textQs.map((q) => (
                    <LabeledInput key={q.id} label={q.text} value={texts[q.id] ?? ''} onChange={(v) => setTexts((t) => ({ ...t, [q.id]: v }))} />
                  ))}
                  <LabeledInput label={tr('Comments (optional, anonymous)', 'Komento (opsyonal, anonymous)')} placeholder={tr('Share what helps you learn, or what could improve', 'Ibahagi kung ano ang nakakatulong sa pag-aaral mo, o ano ang puwedeng pagbutihin')} value={comment} onChange={setComment} />
                </View>
              ) : (
                <Review
                  questions={ratingQs}
                  ratings={ratings}
                  scale={scale}
                  extra={[...textQs.map((q) => ({ label: q.text, value: texts[q.id]?.trim() ?? '' })), { label: tr('Comments', 'Komento'), value: comment.trim() }]}
                  wide={wide}
                  onEdit={(i) => {
                    setEditingFromReview(true);
                    goTo(i);
                  }}
                  onEditComments={() => goTo(commentStep)}
                />
              )}
            </View>
          </FadeIn>

          {!!submitError && (
            <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.dangerBg, borderRadius: 14, padding: 12 }}>
              <Txt size={15} color={colors.danger}>{submitError instanceof ApiError ? submitError.firstMessage : tr('Could not submit. Please try again.', 'Hindi naipasa. Pakisubukan ulit.')}</Txt>
            </View>
          )}

          {step < n && current && ratings[current.id] === undefined && (
            <Txt size={13} color={colors.muted} style={{ textAlign: 'center', marginBottom: -4 }}>{tr('Pick a rating to continue.', 'Pumili ng rating para magpatuloy.')}</Txt>
          )}
          {step === reviewStep && <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.brandSoft, flexDirection: 'row', gap: 8 }}><Icon name="shield" size={18} color={colors.brand} /><Txt size={14} style={{ flex: 1, lineHeight: 20 }}>{tr('Your identity will not be shown to your teacher. Submitted evaluations cannot be changed.', 'Hindi makikita ng guro ang pangalan mo. Hindi na mababago ang naipasang evaluation.')}</Txt></View>}

        </>
      )}
    </ScrollView>
    {!done && !blocked && !offer && <View testID="evaluation-actions" style={{ backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: wide ? 28 : 20, paddingTop: 10, paddingBottom: Math.max(12, insets.bottom), width: '100%' }}>
      <View style={{ width: '100%', maxWidth: 796, alignSelf: 'center', gap: 8 }}>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Icon name={saveState === 'error' ? 'info' : 'checkCircle'} size={14} color={saveState === 'error' ? colors.danger : colors.muted} />
          <Txt size={12} color={saveState === 'error' ? colors.danger : colors.muted} style={{ flex: 1 }}>{saveState === 'error' ? tr('Could not save on this device. Keep this screen open.', 'Hindi na-save sa device. Panatilihing bukas ang screen.') : saveState === 'saving' ? tr('Saving draft…', 'Sine-save ang draft…') : savedAt || saveState === 'saved' ? tr('Draft saved on this device', 'Naka-save ang draft sa device na ito') : tr('Your draft saves as you go.', 'Awtomatikong sine-save ang draft habang sumasagot.')}</Txt>
          {saveState === 'error' && <Pressable accessibilityRole="button" onPress={() => persist().then(() => { setSavedAt(Date.now()); setSaveState('saved'); }).catch(() => setSaveState('error'))} style={{ minHeight: 44, justifyContent: 'center' }}><Txt weight="semibold" size={13} color={colors.accent}>{tr('Retry save', 'I-save ulit')}</Txt></Pressable>}
        </View>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Button title={tr('Previous', 'Nakaraan')} variant="outline" size="lg" disabled={step === 0} onPress={() => goTo(Math.max(0, step - 1))} style={{ flex: 1 }} />
            {step < n ? (
              <Button title={editingFromReview ? tr('Back to review', 'Bumalik sa pagsusuri') : tr('Next', 'Susunod')} size="lg" disabled={!current || ratings[current.id] === undefined} onPress={next} style={{ flex: 1.4 }} />
            ) : step === commentStep ? (
              <Button title={tr('Review answers', 'Suriin ang sagot')} size="lg" disabled={!allRated} onPress={() => goTo(reviewStep)} style={{ flex: 1.4 }} />
            ) : (
              <Button title={tr('Submit anonymously', 'Ipasa nang anonymous')} size="lg" disabled={!allRated} loading={submitting} onPress={send} style={{ flex: 1.4 }} />
            )}
          </View>
      </View>
    </View>}
    </KeyboardAvoidingView>
  );
}

/** Neutral choices keep every rating equally prominent. */
function RatingCards({ scale, value, onPick, wide }: { scale: Record<string, string>; value?: number; onPick: (n: number) => void; wide: boolean }) {
  const entries = Object.entries(scale).map(([v, label]) => ({ n: Number(v), label }));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={tr('Choose a rating', 'Pumili ng rating')} style={{ gap: 10 }}>
      {entries.map(({ n, label }) => {
        const selected = value === n;
        return <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={`${n}, ${label}`} onPress={() => onPick(n)}
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({ minHeight: wide ? 54 : 48, borderRadius: 12, borderWidth: 1.5, borderColor: selected ? colors.navy : hovered ? colors.brand : colors.border, backgroundColor: selected ? colors.brandSoft : colors.card, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, paddingHorizontal: 16, opacity: pressed ? 0.85 : 1 })}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.navy : colors.muted, alignItems: 'center', justifyContent: 'center' }}>{selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.navy }} />}</View>
          <Txt weight="semibold" size={16}>{String(n)}</Txt>
          <Txt weight={selected ? 'semibold' : 'regular'} size={16} style={{ flex: 1 }}>{label}</Txt>
        </Pressable>;
      })}
    </View>
  );
}

/** Every answer on one screen before sending. Tap any row to change it. */
function Review({
  questions,
  ratings,
  scale,
  extra,
  wide,
  onEdit,
  onEditComments,
}: {
  questions: Question[];
  ratings: Record<number, number>;
  scale: Record<string, string>;
  extra: { label: string; value: string }[];
  wide: boolean;
  onEdit: (i: number) => void;
  onEditComments: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Txt weight="semibold" size={22} accessibilityRole="header">{tr('Review your answers', 'Suriin ang mga sagot mo')}</Txt>
      <Txt size={14} color={colors.textSoft}>{tr('Check your answers before submitting.', 'Suriin ang mga sagot bago ipasa.')}</Txt>
      <View style={{ gap: 8 }}>
        {questions.map((q, i) => {
          const v = ratings[q.id];
          return (
            <Pressable
              key={q.id}
              accessibilityRole="button"
              accessibilityLabel={tr(`${q.text}. Your answer: ${v ? `${v}, ${scale[String(v)]}` : 'none'}. Change`, `${q.text}. Sagot mo: ${v ? `${v}, ${scale[String(v)]}` : 'wala'}. Palitan`)}
              onPress={() => onEdit(i)}
              style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: hovered ? colors.surface : colors.card, borderWidth: 1, borderColor: colors.borderSoft })}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                {q.category ? <Txt weight="semibold" size={13} color={colors.muted}>{q.category}</Txt> : null}
                <Txt size={15} style={{ lineHeight: 20 }}>{q.text}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: '42%' }}>
                <Txt weight="medium" size={14} color={colors.accent}>{v ? `${v} · ${scale[String(v)]}` : '–'}</Txt>
                <Txt weight="medium" size={13} color={colors.brandText}>{tr('Edit', 'Palitan')}</Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
      {extra.some((e) => e.value) ? (
        <Pressable accessibilityRole="button" onPress={onEditComments} style={({ hovered }: { hovered?: boolean }) => ({ padding: 14, borderRadius: 18, backgroundColor: hovered ? colors.surface : colors.card, borderWidth: 1, borderColor: colors.borderSoft, gap: 8 })}>
          {extra.filter((e) => e.value).map((e) => (
            <View key={e.label} style={{ gap: 2 }}>
              <Txt weight="semibold" size={13} color={colors.muted}>{e.label}</Txt>
              <Txt size={15} style={{ lineHeight: 21 }}>{e.value}</Txt>
            </View>
          ))}
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={onEditComments} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Txt weight="semibold" size={14} color={colors.accent}>{tr('+ Add a comment (optional)', '+ Magdagdag ng komento (opsyonal)')}</Txt>
        </Pressable>
      )}
    </View>
  );
}

/** A consistent, neutral guide regardless of the selected answer. */
function Reaction({ value, wide }: { value: number | 'comment' | null; wide: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <WiseMascot size={wide ? 78 : 66} mood="happy" float={false} shadow={false} />
    <View style={{ flex: 1, backgroundColor: colors.brandSoft, borderRadius: 16, padding: 14 }}>
      <Txt size={14} style={{ lineHeight: 21 }}>{value === 'comment' ? tr('Comments are optional and anonymous.', 'Opsyonal at anonymous ang komento.') : tr('Choose the answer that reflects your experience.', 'Piliin ang sagot na ayon sa karanasan mo.')}</Txt>
    </View>
  </View>;
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="medium" size={15}>{label}</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={label}
        multiline
        maxLength={2000}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ minHeight: 110, borderWidth: 1.5, borderColor: focused ? colors.navy : colors.border, borderRadius: 18, padding: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlignVertical: 'top', backgroundColor: colors.card }}
      />
      <Txt size={12} color={colors.muted} style={{ alignSelf: 'flex-end' }}>{`${value.length} / 2000`}</Txt>
    </View>
  );
}

/** "1 Rate · 2 Comment · 3 Review · 4 Done", like Padala's send guide. */
function Stepper({ current }: { current: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={tr(`Step ${current + 1} of 4: ${stages()[current]}`, `Hakbang ${current + 1} sa 4: ${stages()[current]}`)} style={{ flexDirection: 'row', gap: 8 }}>
      {stages().map((label, i) => {
        const on = i === current;
        const past = i < current;
        return (
          <View key={label} style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: on || past ? colors.navy : colors.track }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: past ? colors.successFg : 'transparent', borderWidth: past ? 0 : 1.5, borderColor: on ? colors.navy : colors.border }}>
                {past ? <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3} /> : <Txt weight="semibold" size={11} color={on ? colors.accent : colors.muted}>{String(i + 1)}</Txt>}
              </View>
              <Txt weight={on ? 'semibold' : 'medium'} size={13} color={on ? colors.text : colors.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}
