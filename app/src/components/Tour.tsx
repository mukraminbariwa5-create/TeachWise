import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { create } from 'zustand';
import { setPref } from '@/lib/prefs';
import { tap, useUI } from '@/lib/ui';
import { colors, shadowStyle } from '@/theme';
import { FadeIn } from './Motion';
import { RichText } from './RichText';
import { Txt } from './Txt';
import { WiseMascot, type Mood } from './WiseMascot';

export interface TourStep {
  /** The TourTarget id to spotlight. No target = a centred message. */
  target?: string;
  title: string;
  text: string;
  mood: Mood;
}

interface TourState {
  steps: TourStep[] | null;
  index: number;
  /** Set by "Take the tour" in the menu; the dashboard starts it when it opens. */
  requested: boolean;
  start: (steps: TourStep[]) => void;
  go: (i: number) => void;
  end: () => void;
  request: () => void;
  clearRequest: () => void;
}

export const useTour = create<TourState>((set) => ({
  steps: null,
  index: 0,
  requested: false,
  start: (steps) => set({ steps, index: 0, requested: false }),
  go: (index) => set({ index }),
  end: () => {
    setPref('tourDone', '1');
    set({ steps: null, index: 0 });
  },
  request: () => set({ requested: true }),
  clearRequest: () => set({ requested: false }),
}));

/** Ask for the tour again (profile menu). The student is sent to the dashboard, where it starts. */
export const requestTour = () => useTour.getState().request();

// Registered targets: id -> the View to measure.
const targets = new Map<string, View>();

/** Wrap a part of the screen the tour can point at. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: object }) {
  const ref = useCallback((v: View | null) => {
    if (v) targets.set(id, v);
    else targets.delete(id);
  }, [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

interface Rect { x: number; y: number; w: number; h: number }

function measure(id: string | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = id ? targets.get(id) : undefined;
    if (!node) return resolve(null);
    // On the web the page scrolls the target into view first.
    const dom = node as unknown as { scrollIntoView?: (o: object) => void };
    if (Platform.OS === 'web' && dom.scrollIntoView) dom.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(
      () => node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null)),
      Platform.OS === 'web' ? 420 : 60
    );
  });
}

const PAD = 10;

/**
 * The spotlight: everything dims except the part being explained, and Professor Wise
 * says what it is. Next / Back / Skip; ends with a cheer. Rendered once by the Shell.
 */
export function TourOverlay() {
  const { steps, index, go, end } = useTour();
  const { width, height } = useWindowDimensions();
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const runId = useRef(0);
  const step = steps?.[index];

  useEffect(() => {
    if (!step) return;
    const id = ++runId.current;
    setReady(false);
    measure(step.target).then((r) => {
      if (id !== runId.current) return;
      // Off-screen targets (native, no auto-scroll) fall back to a centred message.
      setRect(r && r.y + r.h > 0 && r.y < height ? r : null);
      setReady(true);
    });
  }, [step, width, height]);

  useEffect(() => {
    useUI.getState().addHider(steps ? 1 : -1);
    // only on start/end of a tour
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!steps]);

  if (!steps || !step) return null;

  const last = index === steps.length - 1;
  const next = () => {
    tap();
    if (last) end();
    else go(index + 1);
  };
  const back = () => index > 0 && go(index - 1);

  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;
  const cardW = Math.min(380, width - 32);
  const below = hole ? height - (hole.y + hole.h) > 300 || hole.y < 300 : false;
  const cardLeft = hole ? Math.max(16, Math.min(width - cardW - 16, hole.x + hole.w / 2 - cardW / 2)) : (width - cardW) / 2;
  const cardTop = hole ? (below ? Math.min(hole.y + hole.h + 14, height - 290) : undefined) : undefined;
  const cardBottom = hole && !below ? Math.max(16, height - hole.y + 14) : undefined;
  const dim = 'rgba(5,5,40,0.72)';

  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', left: 0, top: 0, width, height, zIndex: 900 }}>
      {/* the dim layer, in four pieces around the hole so the hole stays clear */}
      {hole ? (
        <>
          <View style={{ position: 'absolute', left: 0, top: 0, width, height: Math.max(0, hole.y), backgroundColor: dim }} />
          <View style={{ position: 'absolute', left: 0, top: hole.y + hole.h, width, bottom: 0, backgroundColor: dim }} />
          <View style={{ position: 'absolute', left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h, backgroundColor: dim }} />
          <View style={{ position: 'absolute', left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h, backgroundColor: dim }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 22, borderWidth: 3, borderColor: '#FFFFFF' }} />
        </>
      ) : (
        <View style={{ position: 'absolute', left: 0, top: 0, width, height, backgroundColor: dim }} />
      )}

      {ready && (
        <FadeIn
          key={index}
          distance={10}
          style={{ position: 'absolute', left: cardLeft, width: cardW, top: hole ? cardTop : height / 2 - 170, bottom: cardBottom }}
        >
          <View style={[{ backgroundColor: colors.card, borderRadius: 26, padding: 18, paddingTop: 14, gap: 12 }, shadowStyle('lift')]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <View style={{ marginTop: -46 }}>
                <WiseMascot size={96} mood={step.mood} float={false} shadow={false} />
              </View>
              <View style={{ flex: 1, gap: 2, paddingBottom: 4 }}>
                <Txt weight="semibold" size={12} color={colors.muted} style={{ letterSpacing: 1 }}>{tr(`STEP ${index + 1} OF ${steps.length}`, `HAKBANG ${index + 1} SA ${steps.length}`)}</Txt>
                <Txt weight="bold" size={19} accessibilityRole="header">{step.title}</Txt>
              </View>
            </View>
            <RichText text={step.text} size={15} boldColor={colors.accent} style={{ lineHeight: 22 }} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {steps.map((_, i) => (
                <View key={i} style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? colors.navy : colors.track }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={end} style={{ height: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
                <Txt weight="semibold" size={15} color={colors.muted}>{last ? '' : tr('Skip tour', 'Laktawan')}</Txt>
              </Pressable>
              <View style={{ flex: 1 }} />
              {index > 0 && (
                <Pressable accessibilityRole="button" onPress={back} style={({ hovered }: { hovered?: boolean }) => ({ height: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', backgroundColor: hovered ? colors.surface : 'transparent' })}>
                  <Txt weight="semibold" size={15}>{tr('Back', 'Bumalik')}</Txt>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={next}
                style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({ height: 44, paddingHorizontal: 22, borderRadius: 999, backgroundColor: hovered ? colors.navyDeep : colors.navy, justifyContent: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] })}
              >
                <Txt weight="semibold" size={15} color="#FFFFFF">{last ? tr('Let’s go!', 'Tara na!') : tr('Next', 'Susunod')}</Txt>
              </Pressable>
            </View>
          </View>
        </FadeIn>
      )}
    </View>
  );
}
