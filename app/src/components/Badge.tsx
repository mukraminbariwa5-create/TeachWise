import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';
import { Modal, Platform, Pressable, Share, View } from 'react-native';
import type { StudentDashboard } from '@/api/types';
import { getPref, setPref } from '@/lib/prefs';
import { tap, useUI } from '@/lib/ui';
import { colors, shadowStyle } from '@/theme';
import { Button } from './Button';
import { Confetti } from './Confetti';
import { Txt } from './Txt';
import { WiseHead, WiseMascot } from './WiseMascot';

export interface EarnedBadge {
  periodId: number;
  period: string;
  earnedAt: string;
}

export async function getBadges(): Promise<EarnedBadge[]> {
  try {
    return JSON.parse((await getPref('badges')) ?? '[]') as EarnedBadge[];
  } catch {
    return [];
  }
}

/** The "Feedback Hero" medal card. */
export function BadgeCard({ badge, name, compact }: { badge: EarnedBadge; name?: string; compact?: boolean }) {
  const medal = compact ? 64 : 120;
  return (
    <View style={{ backgroundColor: '#0B0B6E', borderRadius: compact ? 22 : 30, padding: compact ? 14 : 24, flexDirection: compact ? 'row' : 'column', alignItems: 'center', gap: compact ? 14 : 12, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(116,118,253,0.25)', top: compact ? -150 : -110 }} />
      {/* medal with ribbon */}
      <View style={{ alignItems: 'center' }}>
        {!compact && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: -18 }}>
            <View style={{ width: 26, height: 48, backgroundColor: '#7476FD', transform: [{ rotate: '18deg' }], borderRadius: 4 }} />
            <View style={{ width: 26, height: 48, backgroundColor: '#5BE49B', transform: [{ rotate: '-18deg' }], borderRadius: 4 }} />
          </View>
        )}
        <View style={{ width: medal, height: medal, borderRadius: medal / 2, backgroundColor: '#FFC53D', alignItems: 'center', justifyContent: 'center', borderWidth: compact ? 4 : 6, borderColor: '#FFE58F' }}>
          <View style={{ width: medal * 0.78, height: medal * 0.78, borderRadius: medal, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <WiseHead size={medal * 0.52} mood="laugh" />
          </View>
        </View>
      </View>
      <View style={{ alignItems: compact ? 'flex-start' : 'center', gap: 2, flex: compact ? 1 : undefined }}>
        <Txt weight="bold" size={compact ? 12 : 13} color="#FFC53D" >Feedback Hero</Txt>
        <Txt weight="bold" size={compact ? 17 : 24} color="#FFFFFF" style={{ textAlign: compact ? 'left' : 'center' }}>{tr(`${badge.period} · all done`, `${badge.period} · tapos lahat`)}</Txt>
        <Txt size={compact ? 13 : 15} color="#C9CCF0" style={{ textAlign: compact ? 'left' : 'center' }}>
          {`${name ? `${name} · ` : ''}${new Date(badge.earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
        </Txt>
      </View>
    </View>
  );
}

/**
 * When a student finishes every evaluation in a period, Professor Wise hands them a badge (once per period).
 * Mount on the dashboard.
 */
export function BadgeCelebration({ data }: { data: StudentDashboard }) {
  const [badge, setBadge] = useState<EarnedBadge | null>(null);
  const introOpen = useUI((s) => s.introOpen);
  const period = data.period;
  const allDone = data.progress.total > 0 && data.progress.completed === data.progress.total;

  useEffect(() => {
    if (!period || !allDone || introOpen) return;
    let cancelled = false;
    getBadges().then(async (list) => {
      if (cancelled || list.some((b) => b.periodId === period.id)) return;
      const b = { periodId: period.id, period: period.name, earnedAt: new Date().toISOString() };
      await setPref('badges', JSON.stringify([...list, b]));
      if (!cancelled) {
        tap(30);
        setBadge(b);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [period, allDone, introOpen]);

  if (!badge) return null;
  const first = data.student.name.split(' ')[0];

  const share = async () => {
    const message = tr(`I finished all my ${badge.period} teacher evaluations on TeachWise and earned the Feedback Hero badge!`, `Natapos ko ang lahat ng ${badge.period} teacher evaluation ko sa TeachWise at nakuha ko ang Feedback Hero badge!`);
    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: unknown }) : undefined;
      if (Platform.OS === 'web' && nav && typeof nav.share !== 'function') {
        await nav.clipboard?.writeText(message);
        useUI.getState().pushToast({ title: tr('Copied', 'Nakopya na'), body: tr('Paste it anywhere to share your badge.', 'I-paste kahit saan para i-share ang badge mo.'), tone: 'success' });
      } else {
        await Share.share({ message });
      }
    } catch {
      // the person closed the share sheet
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setBadge(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={[{ width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: 32, padding: 22, gap: 16, alignItems: 'center' }, shadowStyle('lift')]}>
          <View style={{ marginTop: -96 }}>
            <WiseMascot size={150} mood="party" />
            <Confetti spread={240} />
          </View>
          <Txt weight="bold" size={24} style={{ textAlign: 'center' }} accessibilityRole="header">{tr(`You did it, ${first}!`, `Nagawa mo, ${first}!`)}</Txt>
          <Txt size={15} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 22 }}>
            {tr('Every teacher is evaluated. Here’s a badge from me, for helping your teachers get better.', 'Na-evaluate mo na ang lahat ng guro. Heto ang badge mula sa akin, para sa pagtulong sa mga guro mo na gumaling pa.')}
          </Txt>
          <View style={{ alignSelf: 'stretch' }}>
            <BadgeCard badge={badge} name={data.student.name} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Button title={tr('Share', 'I-share')} variant="outline" onPress={share} style={{ flex: 1 }} />
            <Button title={tr('Close', 'Isara')} onPress={() => setBadge(null)} style={{ flex: 1.3 }} />
          </View>
          <Pressable accessibilityRole="button" onPress={() => setBadge(null)} style={{ minHeight: 32 }}>
            <Txt size={13} color={colors.muted}>{tr('You can find it again in your profile.', 'Makikita mo ulit ito sa profile mo.')}</Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
