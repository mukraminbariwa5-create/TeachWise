import { useEffect, useRef, useState } from 'react';
import { tr } from '@/lib/i18n';
import { Animated, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { useSettings } from '@/lib/settings';
import { useUI } from '@/lib/ui';
import { colors, shadowStyle } from '@/theme';
import { FadeIn } from './Motion';
import { Icon } from './Icon';
import { RichText } from './RichText';
import { WiseChat } from './WiseChat';
import { WiseMascot, type Mood } from './WiseMascot';

export interface WiseTip {
  text: string;
  mood?: Mood;
}

const native = Platform.OS !== 'web';

/** "/student/evaluate/12" → "student:evaluate": one tip per kind of page. */
const tipId = (path: string) => path.split('/').filter((p) => p && !/^\d+$/.test(p)).slice(0, 2).join(':') || 'home';

/**
 * Each page's tip, shown once per account (remembered on the server, so not again on another device).
 * It appears shortly after the page opens and steps aside on its own after 8 seconds.
 * Settings → "Tips from Professor Wise" turns them off.
 */
export function useTipBubble(tip: WiseTip | null | undefined, tipKey: string) {
  const [bubble, setBubble] = useState<WiseTip | null>(null);
  const enabled = useSettings((s) => s.settings.tips);
  const seenTips = useSettings((s) => s.settings.seen_tips);
  const key = tipId(tipKey);
  useEffect(() => {
    if (!tip || !enabled || seenTips.includes(key)) {
      setBubble(null);
      return;
    }
    let hide: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      useSettings.getState().markTipSeen(key);
      setBubble(tip);
      hide = setTimeout(() => setBubble(null), 8000);
    }, 700);
    return () => {
      clearTimeout(t);
      if (hide) clearTimeout(hide);
    };
    // the tip text can change as data loads; only the page decides when it shows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tip?.text, enabled]);
  return [bubble, setBubble] as const;
}

/** A speech bubble with a close button. `tail` says where Professor Wise is. */
export function TipBubble({ tip, onClose, tail = 'right', maxWidth = 300 }: { tip: WiseTip; onClose: () => void; tail?: 'right' | 'center'; maxWidth?: number }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        { maxWidth, backgroundColor: colors.card, borderRadius: 20, borderBottomRightRadius: tail === 'right' ? 6 : 20, paddingVertical: 12, paddingLeft: 16, paddingRight: 10, flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: colors.borderSoft },
        shadowStyle('lift'),
      ]}
    >
      <RichText text={tip.text} size={15} boldColor={colors.accent} style={{ flex: 1, lineHeight: 21 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Dismiss tip', 'Isara ang tip')} onPress={onClose} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={14} color={colors.muted} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

/**
 * Computers: Professor Wise in the bottom-right corner, like Dala in Padala.
 * Click him to open the chat panel. He slides away while the page scrolls,
 * and hides on screens that already show a big Professor Wise.
 */
export function WiseLauncher({ subtitle, placeholder, tip, tipKey }: { subtitle: string; placeholder?: string; tip?: WiseTip | null; tipKey: string }) {
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useTipBubble(tip, tipKey);
  const { width, height } = useWindowDimensions();
  const hidden = useUI((s) => s.launcherHiders > 0);
  const scrolling = useUI((s) => s.scrolling);
  const away = useRef(new Animated.Value(0)).current;
  const out = (hidden || scrolling) && !open;

  useEffect(() => {
    Animated.timing(away, { toValue: out ? 1 : 0, duration: out ? 220 : 360, useNativeDriver: native }).start();
  }, [out, away]);

  return (
    <Animated.View
      pointerEvents={out ? 'none' : 'box-none'}
      style={{
        position: 'absolute',
        right: 26,
        bottom: 28,
        alignItems: 'flex-end',
        gap: 10,
        zIndex: 50,
        opacity: away.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateX: away.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }) }],
      }}
    >
      {open && (
        <FadeIn distance={16}>
          <View
            style={[
              { width: Math.min(380, width - 32), height: Math.min(540, height - 160), borderRadius: 28, overflow: 'hidden', backgroundColor: colors.card },
              { ...shadowStyle('lift'), shadowOpacity: 0.25, shadowRadius: 40, elevation: 12 },
            ]}
          >
            <WiseChat subtitle={subtitle} placeholder={placeholder} onClose={() => setOpen(false)} />
          </View>
        </FadeIn>
      )}

      {!open && bubble && (
        <FadeIn key={tipKey}>
          <TipBubble tip={bubble} onClose={() => setBubble(null)} />
        </FadeIn>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? tr('Close Professor Wise', 'Isara si Professor Wise') : tr('Ask Professor Wise', 'Magtanong kay Professor Wise')}
        onPress={() => {
          setBubble(null);
          setOpen((o) => !o);
        }}
        style={({ hovered }: { hovered?: boolean }) => ({ transform: [{ scale: hovered ? 1.06 : 1 }] })}
      >
        {open ? (
          <View style={[{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.frame, alignItems: 'center', justifyContent: 'center' }, shadowStyle('lift')]}>
            <Icon name="close" size={26} color="#FFFFFF" strokeWidth={2} />
          </View>
        ) : (
          <WiseMascot size={112} mood={bubble?.mood ?? 'happy'} />
        )}
      </Pressable>
    </Animated.View>
  );
}
