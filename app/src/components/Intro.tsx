import { useEffect, useRef, useState } from 'react';
import { tr } from '@/lib/i18n';
import { Animated, Easing, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/store';
import { getPref, setPref } from '@/lib/prefs';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useUI } from '@/lib/ui';
import { colors } from '@/theme';
import { RichText } from './RichText';
import { Txt } from './Txt';
import { AppIcon } from './Logo';
import { WiseMascot, type Mood } from './WiseMascot';

const native = Platform.OS !== 'web';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));


const steps = (): { mood: Mood; text: string }[] => [
  { mood: 'hello', text: tr('Hi! I’m **Professor Wise**, your guide in TeachWise.', 'Hi! Ako si **Professor Wise**, ang gabay mo sa TeachWise.') },
  { mood: 'wink', text: tr('Rate your teachers in a few taps. It’s **anonymous**, so your name is never shown to them.', 'I-rate ang mga guro mo sa ilang pindot lang. **Anonymous** ito, kaya hindi nila makikita ang pangalan mo.') },
  { mood: 'idea', text: tr('Teachers get clear feedback, and I turn it into **tips that help them improve**.', 'Makakakuha ang mga guro ng malinaw na feedback, at gagawin ko itong **mga tip para gumaling pa sila**.') },
];

/**
 * The first-launch welcome, like Padala's: the TeachWise icon, then Professor Wise explains
 * the app in three steps and offers "Create account" or "I already have an account".
 * Shows once per install (never again after it finishes or is skipped) and respects reduced motion.
 */
export function Intro() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const wide = width >= 768;

  const [visible, setVisible] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<'logo' | 'wise' | 'talk'>('logo');
  const [mood, setMood] = useState<Mood>('hello');
  const [line, setLine] = useState('');
  const [step, setStep] = useState(-1);
  const [buttons, setButtons] = useState<'none' | 'next' | 'choose'>('none');

  const fade = useRef(new Animated.Value(1)).current;
  const logoIn = useRef(new Animated.Value(0)).current;
  const brandUp = useRef(new Animated.Value(0)).current;
  const wiseIn = useRef(new Animated.Value(0)).current;
  const bubbleIn = useRef(new Animated.Value(0)).current;
  const pick = useRef<((v: string) => void) | null>(null);
  const skipWait = useRef<(() => void) | null>(null);
  const run = useRef(0);

  // First launch on this device only, and only for someone who isn't signed in.
  useEffect(() => {
    if (useAuth.getState().user) {
      setVisible(false);
      return;
    }
    getPref('onboarded').then((v) => setVisible(v !== '1'));
  }, []);

  useEffect(() => {
    useUI.getState().setIntroOpen(visible !== false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    run.current += 1;
    const myRun = run.current;
    let cancelled = false;
    const alive = () => !cancelled && myRun === run.current;

    const anim = (v: Animated.Value, to: number, ms: number, easing = Easing.out(Easing.cubic)) =>
      new Promise<void>((r) => Animated.timing(v, { toValue: to, duration: reduced ? 0 : ms, easing, useNativeDriver: native }).start(() => r()));
    const pause = (ms: number) =>
      new Promise<void>((r) => {
        const t = setTimeout(done, reduced ? Math.min(ms, 400) : ms);
        function done() {
          clearTimeout(t);
          skipWait.current = null;
          r();
        }
        skipWait.current = done;
      });
    const say = async (m: Mood, text: string) => {
      bubbleIn.setValue(0);
      setMood(m);
      setLine(text);
      await anim(bubbleIn, 1, 320);
    };
    const choose = () => new Promise<string>((r) => (pick.current = r));
    const leave = async (to?: Href) => {
      if (!alive()) return;
      setPref('onboarded', '1');
      await anim(fade, 0, 600, Easing.in(Easing.cubic));
      if (to) router.replace(to);
      setVisible(false);
      setPhase('logo');
      setStep(-1);
      setButtons('none');
      [logoIn, brandUp, wiseIn, bubbleIn].forEach((v) => v.setValue(0));
    };

    (async () => {
      [logoIn, brandUp, wiseIn, bubbleIn].forEach((v) => v.setValue(0));
      setPhase('logo');
      await anim(logoIn, 1, 900, Easing.out(Easing.back(1.4)));
      await wait(reduced ? 0 : 700);
      if (!alive()) return;
      setPhase('wise');
      await Promise.all([anim(brandUp, 1, 700), anim(wiseIn, 1, 900, Easing.out(Easing.back(1.2)))]);
      if (!alive()) return;
      setPhase('talk');

      const STEPS = steps();
      for (let i = 0; i < STEPS.length; i++) {
        if (!alive()) return;
        setStep(i);
        await say(STEPS[i].mood, STEPS[i].text);
        setButtons('next');
        await choose();
        setButtons('none');
      }
      setStep(-1);
      await say('lecture', tr('Ready? Let’s get you set up.', 'Handa ka na? Simulan na natin.'));
      setButtons('choose');
      const choice = await choose();
      setButtons('none');
      await say(choice === 'signup' ? 'party' : 'happy', choice === 'signup' ? tr('Yay! Let’s make your account.', 'Yehey! Gawin na natin ang account mo.') : tr('Welcome back! Sign in below.', 'Maligayang pagbabalik! Mag-sign in sa ibaba.'));
      await pause(1100);
      return leave(choice === 'signup' ? '/login?mode=signup' : '/login?mode=signin');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const logoScale = logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const brandShift = brandUp.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.round(height * 0.31)] });
  const brandScale = brandUp.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  const wiseX = wiseIn.interpolate({ inputRange: [0, 1], outputRange: [220, 0] });
  const wiseY = wiseIn.interpolate({ inputRange: [0, 1], outputRange: [260, 0] });
  const signedOut = !user;

  return (
    <Animated.View
      accessibilityViewIsModal
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1000, backgroundColor: colors.frame, opacity: fade, overflow: 'hidden' }}
    >
      <Pressable accessibilityLabel={tr('Continue', 'Magpatuloy')} onPress={() => (buttons === 'next' ? pick.current?.('next') : skipWait.current?.())} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* soft glows */}
        <View pointerEvents="none" style={{ position: 'absolute', width: 620, height: 620, borderRadius: 310, backgroundColor: 'rgba(108,112,255,0.16)', top: '18%' }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -120, right: -80 }} />

        {/* the TeachWise app icon */}
        <Animated.View style={{ alignItems: 'center', gap: 22, opacity: logoIn, transform: [{ translateY: brandShift }, { scale: Animated.multiply(logoScale, brandScale) }] }}>
          <AppIcon size={wide ? 200 : 168} />
          {phase === 'logo' && <Txt size={17} color={colors.onFrameMuted} style={{ textAlign: 'center', paddingHorizontal: 24 }}>{tr('Better teaching starts with honest feedback.', 'Nagsisimula ang mas mahusay na pagtuturo sa tapat na feedback.')}</Txt>}
        </Animated.View>

        {/* Professor Wise + speech bubble */}
        {phase !== 'logo' && (
          <Animated.View style={{ position: 'absolute', top: Math.round(height * 0.3), alignItems: 'center', width: '100%', paddingHorizontal: 24, gap: 18, transform: [{ translateX: wiseX }, { translateY: wiseY }] }}>
            <WiseMascot size={wide ? 190 : 150} mood={mood} />
            {phase === 'talk' && line !== '' && (
              <Animated.View style={{ opacity: bubbleIn, transform: [{ translateY: bubbleIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }], maxWidth: 440, width: '100%' }}>
                <View style={{ alignSelf: 'center', width: 18, height: 18, backgroundColor: '#FFFFFF', transform: [{ rotate: '45deg' }], marginBottom: -10 }} />
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 22 }}>
                  <RichText text={line} size={wide ? 19 : 17} color="#12122B" boldColor="#0B0B6E" style={{ textAlign: 'center', lineHeight: wide ? 27 : 24 }} />
                </View>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* step dots + buttons */}
        <View style={{ position: 'absolute', bottom: wide ? 56 : 40, left: 24, right: 24, alignItems: 'center', gap: 18 }}>
          {signedOut && step >= 0 && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {steps().map((_, i) => (
                <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? '#FFFFFF' : 'rgba(255,255,255,0.35)' }} />
              ))}
            </View>
          )}
          {buttons === 'next' && <IntroButton label={tr('Next', 'Susunod')} primary onPress={() => pick.current?.('next')} />}
          {buttons === 'choose' && (
            <View style={{ width: '100%', maxWidth: 380, gap: 12 }}>
              <IntroButton label={tr('Create account', 'Gumawa ng account')} primary onPress={() => pick.current?.('signup')} />
              <IntroButton label={tr('I already have an account', 'May account na ako')} onPress={() => pick.current?.('signin')} />
            </View>
          )}
        </View>

        {/* Skip */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Skip intro', 'Laktawan ang intro')}
          onPress={() => {
            run.current += 1;
            setPref('onboarded', '1');
            Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: native }).start(() => {
              setVisible(false);
              if (!useAuth.getState().user) router.replace('/login');
            });
          }}
          style={{ position: 'absolute', top: 24, right: 24, height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' }}
        >
          <Txt weight="semibold" size={14} color="#FFFFFF">{tr('Skip', 'Laktawan')}</Txt>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function IntroButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        height: 54,
        minWidth: 200,
        paddingHorizontal: 28,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? (hovered ? '#E9EAFB' : '#FFFFFF') : hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
        borderWidth: primary ? 0 : 1.5,
        borderColor: 'rgba(255,255,255,0.6)',
      })}
    >
      <Txt weight="semibold" size={17} color={primary ? '#0B0B6E' : '#FFFFFF'}>{label}</Txt>
    </Pressable>
  );
}
