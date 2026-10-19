import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useWise } from '@/api/hooks';
import type { StudentDashboard } from '@/api/types';
import { getPref, setPref } from '@/lib/prefs';
import { colors, shadowStyle } from '@/theme';
import { Icon } from './Icon';
import { FadeIn } from './Motion';
import { Txt } from './Txt';
import { ProgressRing } from './ProgressRing';

/**
 * "Getting started · 2 of 4 done", like Padala's first-run checklist.
 * Steps tick themselves off from real data. Hidden once everything is done or dismissed.
 */
export function GettingStarted({ data, compact }: { data: StudentDashboard; compact?: boolean }) {
  const router = useRouter();
  const wise = useWise();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    getPref('checklistDone').then((v) => setDismissed(v === '1'));
  }, []);

  const nextPending = data.teachers.find((t) => t.status === 'pending' && data.period?.is_open);
  const steps: { title: string; text: string; done: boolean; action?: { label: string; href: Href } }[] = [
    { title: tr('Create your account', 'Gumawa ng account'), text: tr('You’re in. Welcome to TeachWise!', 'Nakapasok ka na. Maligayang pagdating sa TeachWise!'), done: true },
    {
      title: tr('Meet Professor Wise', 'Kilalanin si Professor Wise'),
      text: tr('Ask him anything about evaluations.', 'Tanungin siya ng kahit ano tungkol sa evaluation.'),
      done: (wise.data?.messages.length ?? 0) > 0,
      action: { label: tr('Say hi', 'Mag-hi'), href: '/student/wise' },
    },
    {
      title: tr('Evaluate your first teacher', 'I-evaluate ang unang guro mo'),
      text: tr('It takes about 3 minutes and it’s anonymous.', 'Mga 3 minuto lang at anonymous ito.'),
      done: data.progress.completed > 0,
      action: nextPending ? { label: tr('Start', 'Simulan'), href: `/student/evaluate/${nextPending.offering_id}` as Href } : undefined,
    },
    {
      title: tr('Finish all your evaluations', 'Tapusin ang lahat ng evaluation mo'),
      text: data.progress.total
        ? tr(`${data.progress.completed} of ${data.progress.total} teachers done.`, `${data.progress.completed} sa ${data.progress.total} guro ang tapos na.`)
        : tr('Your teachers will appear here.', 'Lalabas dito ang mga guro mo.'),
      done: data.progress.total > 0 && data.progress.completed === data.progress.total,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed !== false || doneCount === steps.length) return null;

  const close = () => {
    setPref('checklistDone', '1');
    setDismissed(true);
  };

  return (
    <FadeIn>
      <View style={[{ backgroundColor: colors.card, borderRadius: compact ? 26 : 32, padding: compact ? 18 : 26, gap: 4 }, shadowStyle('soft')]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 12 : 16, marginBottom: 10 }}>
          <ProgressRing value={doneCount / steps.length} size={compact ? 52 : 60} stroke={compact ? 6 : 7} color={colors.successFg}>
            <Txt weight="bold" size={compact ? 14 : 16} color={colors.text}>{`${doneCount}/${steps.length}`}</Txt>
          </ProgressRing>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt weight="semibold" size={12} color={colors.muted} style={{ letterSpacing: 1.2 }}>
              {compact ? tr(`GETTING STARTED · ${doneCount}/${steps.length}`, `PANIMULA · ${doneCount}/${steps.length}`) : tr(`GETTING STARTED · ${doneCount} OF ${steps.length} DONE`, `PANIMULA · ${doneCount} SA ${steps.length} TAPOS NA`)}
            </Txt>
            <Txt weight="semibold" size={compact ? 17 : 20}>{doneCount >= 3 ? tr('Almost there!', 'Malapit na!') : tr('Let’s take it step by step', 'Isa-isahin natin')}</Txt>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Hide getting started', 'Itago ang panimula')} onPress={close} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
            <Icon name="close" size={16} color={colors.muted} strokeWidth={2.2} />
          </Pressable>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden', marginBottom: 10 }}>
          <View style={{ width: `${(doneCount / steps.length) * 100}%` as `${number}%`, height: '100%', backgroundColor: colors.successFg, borderRadius: 3 }} />
        </View>
        {steps.map((s, i) => (
          <View key={s.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderSoft }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: s.done ? colors.successFg : 'transparent',
                borderWidth: s.done ? 0 : 2,
                borderColor: colors.navy,
              }}
            >
              {s.done ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.8} /> : <Txt weight="semibold" size={14} color={colors.accent}>{String(i + 1)}</Txt>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="semibold" size={compact ? 15 : 16} color={s.done ? colors.muted : colors.text} style={s.done ? { textDecorationLine: 'line-through' } : undefined}>{s.title}</Txt>
              <Txt size={13} color={colors.muted}>{s.text}</Txt>
            </View>
            {!s.done && s.action && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(s.action!.href)}
                style={({ hovered }: { hovered?: boolean }) => ({ height: 38, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: colors.navy, backgroundColor: hovered ? colors.navy : 'transparent', justifyContent: 'center' })}
              >
                {({ hovered }: { hovered?: boolean }) => <Txt weight="semibold" size={14} color={hovered ? '#FFFFFF' : colors.accent}>{s.action!.label}</Txt>}
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </FadeIn>
  );
}
