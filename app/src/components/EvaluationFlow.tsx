import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ApiError } from '@/api/client';
import type { Period, Person, Question } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { Icon } from '@/components/Icon';
import { FadeIn } from '@/components/Motion';
import { ProgressBar } from '@/components/ProgressRing';
import { RichText } from '@/components/RichText';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { WiseHead, WiseMascot, type HeadMood, type Mood } from '@/components/WiseMascot';
import { tap, toast, useHideLauncher } from '@/lib/ui';
import { clearDraft, getDraft, saveDraft, type Draft } from '@/lib/drafts';
import { tr } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useIsWide } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, fonts, shadowStyle } from '@/theme';

/** Professor Wise's face for each point on the scale. */
const FACES: Record<number, HeadMood> = { 1: 'tired', 2: 'squint', 3: 'neutral', 4: 'grin', 5: 'laugh' };
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
  const id = draftKey;
  const router = useRouter();
  const wide = useIsWide();
  const form = { data };
  useHideLauncher();
  useTitle(data ? `${tr('Evaluate', 'Mag-evaluate')} ${data.teacher.name}` : tr('Evaluate', 'Mag-evaluate'));

  // step 0..n-1 = rating questions, n = comments, n+1 = review
  const [step, setStep] = useState(0);
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

  useEffect(() => {
    if (!form.data || draftChecked) return;
    setDraftChecked(true);
    if (form.data.already_submitted || !form.data.period?.is_open) return;
    getDraft(id).then((d) => {
      if (d && (Object.keys(d.ratings).length || d.comment)) setOffer(d);
    });
  }, [form.data, draftChecked, id]);

  const answered = Object.keys(ratings).length > 0 || comment.trim() !== '' || Object.values(texts).some((t) => t.trim());
  useEffect(() => {
    if (!draftChecked || offer || done || !answered) return;
    const t = setTimeout(() => {
      saveDraft(id, { step, ratings, texts, comment }).then(() => setSavedAt(Date.now()));
    }, 500);
    return () => clearTimeout(t);
  }, [ratings, texts, comment, step, draftChecked, offer, done, answered, id]);

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
  const back = () => (router.canGoBack() ? router.back() : goHome());

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
        clearDraft(id);
        qc.invalidateQueries({ queryKey: ['drafts'] });
        setDone(true);
        toast({ title: tr('Evaluation sent', 'Naipadala ang evaluation'), body: tr(`Thank you! ${teacher.name} will only see combined, anonymous results.`, `Salamat! Pinagsama-sama at anonymous na resulta lang ang makikita ni ${teacher.name}.`), tone: 'success', mood: 'proud' });
      }
    );
  };

  const blocked = already_submitted ? tr('You already evaluated this teacher for this period. Thank you!', 'Na-evaluate mo na ang gurong ito ngayong period. Salamat!') : !period?.is_open ? tr('The evaluation period is closed right now.', 'Sarado ang evaluation ngayon.') : null;
  const stage = done ? 3 : step === reviewStep ? 2 : step === commentStep ? 1 : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? 40 : 20, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 820, alignSelf: 'center', flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Back', 'Bumalik')}
          onPress={back}
          style={[{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, shadowStyle('soft')]}
        >
          <Icon name="arrowLeft" size={20} strokeWidth={2} />
        </Pressable>
        <Txt weight="semibold" size={22} accessibilityRole="header">{tr('Evaluate', 'Mag-evaluate')}</Txt>
      </View>

      <View style={{ backgroundColor: colors.frame, borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={teacher.name} initials={teacher.initials} size={52} />
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={18} color="#FFFFFF">{teacher.name}</Txt>
          <Txt size={14} color={colors.onNavyMuted}>{form.data.subtitle}</Txt>
        </View>
      </View>

      {!blocked && <Stepper current={stage} />}

      {done ? (
        <FadeIn style={{ flex: 1 }}>
          <View style={[{ flex: 1, backgroundColor: colors.card, borderRadius: 28, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'hidden' }, shadowStyle('soft')]}>
            <View>
              <WiseMascot size={wide ? 210 : 170} mood="party" />
              <Confetti spread={wide ? 260 : 200} />
            </View>
            <Txt weight="bold" size={26} accessibilityRole="header" style={{ textAlign: 'center' }}>{tr('Evaluation submitted!', 'Naipasa ang evaluation!')}</Txt>
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
            {savedAt && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
                <Icon name="checkCircle" size={13} color={colors.successFg} strokeWidth={2.2} />
                <Txt size={12} color={colors.successFg}>{tr('Draft saved on this device', 'Naka-save ang draft sa device na ito')}</Txt>
              </View>
            )}
          </View>

          <FadeIn key={step} distance={16}>
            <View style={[{ backgroundColor: colors.card, borderRadius: 28, paddingVertical: 22, paddingHorizontal: wide ? 24 : 16, gap: 14 }, shadowStyle('soft')]}>
              {step < n && current ? (
                <>
                  <Reaction value={ratings[current.id] ?? null} wide={wide} />
                  <Txt weight="semibold" size={wide ? 22 : 20} style={{ lineHeight: wide ? 30 : 27, marginHorizontal: 4 }} accessibilityRole="header">
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
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title={tr('Previous', 'Nakaraan')} variant="outline" size="lg" disabled={step === 0} onPress={() => goTo(Math.max(0, step - 1))} style={{ flex: 1 }} />
            {step < n ? (
              <Button title={editingFromReview ? tr('Back to review', 'Bumalik sa pagsusuri') : tr('Next', 'Susunod')} size="lg" disabled={!current || ratings[current.id] === undefined} onPress={next} style={{ flex: 1.4 }} />
            ) : step === commentStep ? (
              <Button title={tr('Review answers', 'Suriin ang sagot')} size="lg" disabled={!allRated} onPress={() => goTo(reviewStep)} style={{ flex: 1.4 }} />
            ) : (
              <Button title={tr('Submit evaluation', 'Ipasa ang evaluation')} size="lg" disabled={!allRated} loading={submitting} onPress={send} style={{ flex: 1.4 }} />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Each point on the scale has its own colour, from warm (1) to green (5), so the choice reads at a glance. */
const rateColors = (n: number) => {
  const k = Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
  return { tint: colors[`rate${k}Bg`], strong: colors[`rate${k}`] };
};

/**
 * Five big cards, each with Professor Wise's face for that rating, tinted from warm to green.
 * The picked card fills with its colour and his face pops. A row on computers, a list on phones.
 */
function RatingCards({ scale, value, onPick, wide }: { scale: Record<string, string>; value?: number; onPick: (n: number) => void; wide: boolean }) {
  const entries = Object.entries(scale).map(([v, label]) => ({ n: Number(v), label }));
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 12 : 10 }}>
      {entries.map(({ n, label }) => {
        const on = value === n;
        const dim = value !== undefined && !on;
        const c = rateColors(n);
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${n}, ${label}`}
            onPress={() => onPick(n)}
            style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
              {
                borderRadius: 24,
                borderWidth: 2,
                borderColor: on ? c.strong : hovered ? c.strong : colors.borderSoft,
                backgroundColor: on ? c.strong : colors.card,
                opacity: dim && !hovered ? 0.72 : 1,
                transform: [{ scale: pressed ? 0.96 : on ? 1.04 : hovered ? 1.02 : 1 }],
              },
              on ? shadowStyle('lift') : null,
              wide
                ? { flex: 1, minHeight: 176, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, paddingHorizontal: 6 }
                : { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12 },
            ]}
          >
            <View style={{ width: wide ? 92 : 54, height: wide ? 82 : 50, borderRadius: wide ? 22 : 16, backgroundColor: on ? '#FFFFFF' : c.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <WiseHead key={on ? 'on' : 'off'} size={wide ? 68 : 40} mood={FACES[n] ?? 'neutral'} pop={on} />
            </View>
            {wide ? (
              <>
                <Txt weight="bold" size={24} color={on ? '#FFFFFF' : c.strong}>{String(n)}</Txt>
                <Txt weight="semibold" size={15} color={on ? '#FFFFFF' : colors.textSoft} style={{ textAlign: 'center' }}>{label}</Txt>
              </>
            ) : (
              <>
                <Txt weight="semibold" size={17} color={on ? '#FFFFFF' : colors.text} style={{ flex: 1 }}>{label}</Txt>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: on ? '#FFFFFF' : c.tint, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name="check" size={18} color={c.strong} strokeWidth={3} /> : <Txt weight="bold" size={15} color={c.strong}>{String(n)}</Txt>}
                </View>
              </>
            )}
          </Pressable>
        );
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
  const values = questions.map((q) => ratings[q.id]).filter((v): v is number => v !== undefined);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <WiseMascot size={wide ? 104 : 84} mood="writing" float={false} shadow={false} />
        <View style={{ flex: 1, marginBottom: 10, backgroundColor: colors.brandSoft, borderRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 11, paddingHorizontal: 14 }}>
          <RichText text={tr(`Here’s what you’ll send. Your average is **${avg.toFixed(1)} / 5**. Tap any answer to change it.`, `Ito ang ipapasa mo. Ang average mo ay **${avg.toFixed(1)} / 5**. Pindutin ang sagot para palitan.`)} size={wide ? 15 : 14} boldColor={colors.accent} style={{ lineHeight: 20 }} />
        </View>
      </View>
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
                {q.category ? <Txt weight="semibold" size={12} color={colors.muted} style={{ letterSpacing: 0.6 }}>{q.category.toUpperCase()}</Txt> : null}
                <Txt size={15} numberOfLines={2} style={{ lineHeight: 20 }}>{q.text}</Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 12, height: 42, borderRadius: 999, backgroundColor: colors.chip }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <WiseHead size={22} mood={FACES[v] ?? 'neutral'} />
                </View>
                <Txt weight="semibold" size={14} color={colors.accent}>{v ? (wide ? `${v} · ${scale[String(v)]}` : String(v)) : '–'}</Txt>
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

const reactions = (): Record<string, { mood: Mood; line: string }> => ({
  none: { mood: 'think', line: tr('Take your time. Pick what **really** happened in class.', 'Dahan-dahan lang. Piliin ang **totoong** nangyari sa klase.') },
  1: { mood: 'sad', line: tr('Thanks for being **honest**. That helps the most.', 'Salamat sa pagiging **tapat**. Iyan ang pinakamakakatulong.') },
  2: { mood: 'worried', line: tr('Got it, **something to work on**.', 'Sige, **may dapat pang ayusin**.') },
  3: { mood: 'think', line: tr('Okay, **somewhere in the middle**.', 'Okay, **nasa gitna**.') },
  4: { mood: 'proud', line: tr('Nice! That’s **good to hear**.', 'Ayos! **Masarap pakinggan** iyan.') },
  5: { mood: 'cheer', line: tr('**Excellent!** Your teacher will be glad to know.', '**Napakahusay!** Matutuwa ang guro mo.') },
  comment: { mood: 'writing', line: tr('Any comments? It’s **optional** and still anonymous.', 'May komento ka ba? **Opsyonal** ito at anonymous pa rin.') },
});

/** Professor Wise reacting to the rating the student just picked. */
function Reaction({ value, wide }: { value: number | 'comment' | null; wide: boolean }) {
  const r = reactions()[value === null ? 'none' : String(value)];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }} accessibilityLiveRegion="polite">
      <WiseMascot size={wide ? 104 : 84} mood={r.mood} float={false} shadow={false} />
      <FadeIn key={r.line} distance={6} style={{ flex: 1, marginBottom: 10 }}>
        <View style={{ backgroundColor: colors.brandSoft, borderRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 11, paddingHorizontal: 14 }}>
          <RichText text={r.line} size={wide ? 15 : 14} boldColor={colors.accent} style={{ lineHeight: wide ? 21 : 19 }} />
        </View>
      </FadeIn>
    </View>
  );
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
