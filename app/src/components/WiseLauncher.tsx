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
import { WiseHead, type Mood } from './WiseMascot';

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
 * Computers: a round Professor Wise button in the bottom-right corner of the page panel, like Dala in Padala.
 * Click him to open the chat. On wide screens the chat docks beside the page (see Shell) so it never
 * covers anything; on narrower ones it floats above the button. He slides away while the page scrolls,
 * and hides on screens that already show a big Professor Wise.
 */
export function WiseLauncher({ subtitle, placeholder, tip, tipKey, docked, inset = { right: 60, bottom: 60 } }: { subtitle: string; placeholder?: string; tip?: WiseTip | null; tipKey: string; docked?: boolean; inset?: { right: number; bottom: number } }) {
  const open = useUI((s) => s.wiseOpen);
  const setOpen = useUI((s) => s.setWiseOpen);
  const [bubble, setBubble] = useTipBubble(tip, tipKey);
  const { width, height } = useWindowDimensions();
  const hidden = useUI((s) => s.launcherHiders > 0);
  const scrolling = useUI((s) => s.scrolling);
  const away = useRef(new Animated.Value(0)).current;
  const out = (hidden || scrolling) && !open;

  useEffect(() => {
    Animated.timing(away, { toValue: out ? 1 : 0, duration: out ? 220 : 360, useNativeDriver: native }).start();
  }, [out, away]);

  // Close the chat when leaving the page that owns this launcher.
  useEffect(() => () => setOpen(false), [setOpen]);

  // Docked chat has its own close button; the corner button steps aside.
  if (open && docked) return null;

  return (
    <Animated.View
      pointerEvents={out ? 'none' : 'box-none'}
      style={{
        position: 'absolute',
        right: inset.right,
        bottom: inset.bottom,
        alignItems: 'flex-end',
        gap: 12,
        zIndex: 50,
        opacity: away.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateX: away.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }) }],
      }}
    >
      {open && (
        <FadeIn distance={16}>
          <View
            style={[
              { width: Math.min(380, width - 32), height: Math.min(540, height - inset.bottom - 120), borderRadius: 28, overflow: 'hidden', backgroundColor: colors.card },
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
          setOpen(!open);
        }}
        style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({ transform: [{ scale: pressed ? 0.94 : hovered ? 1.06 : 1 }] })}
      >
        {({ hovered }: { hovered?: boolean }) => (
          <View
            style={[
              { width: 66, height: 66, borderRadius: 33, backgroundColor: open ? colors.frame : '#FFFFFF', borderWidth: 3, borderColor: open ? colors.frame : colors.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
              shadowStyle('lift'),
            ]}
          >
            {open ? <Icon name="close" size={24} color="#FFFFFF" strokeWidth={2.2} /> : <WiseHead size={46} mood={bubble ? 'laugh' : hovered ? 'grin' : 'wink'} pop />}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Computers with room to spare: the chat as a column beside the page instead of on top of it. */
export function DockedWiseChat({ subtitle, placeholder }: { subtitle: string; placeholder?: string }) {
  const setOpen = useUI((s) => s.setWiseOpen);
  return (
    <FadeIn distance={16} style={{ width: 380, marginLeft: 14, borderRadius: 36, overflow: 'hidden', backgroundColor: colors.card }}>
      <WiseChat subtitle={subtitle} placeholder={placeholder} onClose={() => setOpen(false)} />
    </FadeIn>
  );
}
