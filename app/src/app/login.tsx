import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { homeFor, useAuth } from '@/auth/store';
import { cue, useCue } from '@/components/auth/cue';
import { SchoolBar, SchoolPicker } from '@/components/auth/SchoolPicker';
import { SignInForm } from '@/components/auth/SignInForm';
import { Button } from '@/components/Button';
import { SignUpWizard } from '@/components/auth/SignUpWizard';
import { Icon } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Logo } from '@/components/Logo';
import { FadeIn } from '@/components/Motion';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RichText } from '@/components/RichText';
import { Txt } from '@/components/Txt';
import { WiseHead, WiseMascot, type HeadMood, type Mood } from '@/components/WiseMascot';
import { tr } from '@/lib/i18n';
import { usePickedSchool } from '@/lib/school';
import { useLayoutSize } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, shadowStyle } from '@/theme';

type Mode = 'signup' | 'signin';

function useWiseLine(mode: Mode): { mood: Mood; line: string } {
  const c = useCue((s) => s.cue);
  return (
    c ??
    (mode === 'signup'
      ? { mood: 'hello', line: tr('Hi! Let’s set up your account. Just 3 quick steps.', 'Hi! Gawin natin ang account mo. 3 mabilis na hakbang lang.') }
      : { mood: 'happy', line: tr('Good to see you again! Sign in to continue.', 'Masaya akong makita ka ulit! Mag-sign in para magpatuloy.') })
  );
}

/** Professor Wise with a speech bubble that reacts to what you're doing in the form. */
function WiseSays({ mode, size, bubbleSide }: { mode: Mode; size: number; bubbleSide: 'top' | 'right' }) {
  const { mood, line } = useWiseLine(mode);
  const bubble = (
    <FadeIn key={line} distance={6} style={bubbleSide === 'right' ? { flex: 1 } : { maxWidth: 380 }}>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 22, borderBottomLeftRadius: bubbleSide === 'right' ? 6 : 22, paddingVertical: 14, paddingHorizontal: 18 }}>
        <RichText text={line} size={bubbleSide === 'right' ? 15 : 18} color="#12122B" boldColor="#0B0B6E" style={{ lineHeight: bubbleSide === 'right' ? 21 : 25, textAlign: bubbleSide === 'top' ? 'center' : 'left' }} />
      </View>
      {bubbleSide === 'top' && <View style={{ alignSelf: 'center', width: 18, height: 18, backgroundColor: '#FFFFFF', transform: [{ rotate: '45deg' }], marginTop: -10 }} />}
    </FadeIn>
  );
  if (bubbleSide === 'right') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
        <WiseMascot size={size} mood={mood} shadow={false} />
        {bubble}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 14 }} accessibilityLiveRegion="polite">
      {bubble}
      <WiseMascot size={size} mood={mood} />
    </View>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const size = useLayoutSize();
  const wide = size !== 'phone';
  const user = useAuth((s) => s.user);
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const { school, loaded, load, pick } = usePickedSchool();
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (params.mode === 'signup' || params.mode === 'signin') setMode(params.mode);
  }, [params.mode]);

  useEffect(() => cue(null), [mode]);
  useTitle(mode === 'signup' ? tr('Create account', 'Gumawa ng account') : tr('Sign in', 'Mag-sign in'));

  if (user) return <Redirect href={homeFor(user.role)} />;

  const card = (
    <FadeIn delay={100} style={{ width: '100%', maxWidth: 480 }}>
      <View style={[{ backgroundColor: colors.card, borderRadius: 36, padding: wide ? 40 : 22, gap: 20 }, shadowStyle('soft')]}>
        <View style={{ gap: 6 }}>
          <Txt weight="bold" size={wide ? 32 : 28} accessibilityRole="header">{mode === 'signup' ? tr('Create your account', 'Gumawa ng account') : tr('Welcome back', 'Maligayang pagbabalik')}</Txt>
          <Txt size={16} color={colors.muted} style={{ lineHeight: 23 }}>
            {mode === 'signup'
              ? tr('You need the student ID your school gave you.', 'Kailangan mo ang student ID na ibinigay ng paaralan mo.')
              : tr('Sign in with your username or ID number.', 'Mag-sign in gamit ang username o ID number mo.')}
          </Txt>
        </View>
        <Tabs mode={mode} onChange={setMode} />
        <SchoolBar school={school} onChange={() => setPicking(true)} optional={mode === 'signin'} />
        {mode === 'signup' ? (
          school ? (
            <SignUpWizard key={school.id} school={school} onSignIn={() => setMode('signin')} />
          ) : (
            <View style={{ gap: 12, alignItems: 'flex-start' }}>
              <Txt size={15} color={colors.textSoft} style={{ lineHeight: 22 }}>
                {tr('First, choose your school. Only students on your school’s list can create an account.', 'Una, piliin ang paaralan mo. Mga estudyanteng nasa listahan lang ng paaralan ang makakagawa ng account.')}
              </Txt>
              <Button title={tr('Choose your school', 'Piliin ang paaralan')} size="lg" onPress={() => setPicking(true)} style={{ alignSelf: 'stretch' }} />
            </View>
          )
        ) : (
          <SignInForm schoolId={school?.id} onNeedSchool={() => setPicking(true)} />
        )}
        {mode === 'signup' && (
          <Pressable accessibilityRole="link" onPress={() => router.push('/invite')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 }}>
            <Icon name="key" size={16} color={colors.accent} />
            <Txt weight="semibold" size={14} color={colors.accent}>{tr('Teacher or admin? Join with an invite code', 'Guro o admin? Sumali gamit ang invite code')}</Txt>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="checkCircle" size={16} color={colors.muted} />
          <Txt size={13} color={colors.muted} style={{ flex: 1, lineHeight: 19 }}>
            {tr('Your evaluations are anonymous. Teachers only see combined results, never your name.', 'Anonymous ang mga evaluation mo. Pinagsama-samang resulta lang ang nakikita ng guro, hindi ang pangalan mo.')}
          </Txt>
        </View>
      </View>
      <Footer />
      <SchoolPicker visible={picking} onClose={() => setPicking(false)} onPick={pick} />
    </FadeIn>
  );

  const header = (logoSize: number) => <Logo size={logoSize} onDark />;

  if (!wide) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.frame }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <OfflineBanner />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 18, gap: 12 }}>
            {header(40)}
            <WiseSays mode={mode} size={124} bubbleSide="right" />
          </View>
          <View style={{ flexGrow: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 14, paddingTop: 20, alignItems: 'center' }}>
            {card}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: size === 'tablet' ? 14 : 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.frame, borderRadius: 44, padding: 14, minHeight: 720 }}>
          <View style={{ flex: 1, paddingHorizontal: 48, paddingVertical: 40, gap: 28 }}>
            {header(54)}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 }}>
              <View pointerEvents="none" style={{ position: 'absolute', width: 460, height: 460, borderRadius: 230, backgroundColor: 'rgba(116,118,253,0.16)', top: '6%' }} />
              <FadeIn delay={150}>
                <WiseSays mode={mode} size={220} bubbleSide="top" />
              </FadeIn>
              <FadeIn delay={260} style={{ alignItems: 'center', gap: 18, maxWidth: 480 }}>
                <Txt weight="bold" size={32} color="#FFFFFF" style={{ textAlign: 'center', lineHeight: 40 }}>
                  {tr('Rate your teachers. They never see your name.', 'I-rate ang mga guro mo. Hindi nila makikita ang pangalan mo.')}
                </Txt>
                <ScalePreview />
              </FadeIn>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 36, alignItems: 'center', justifyContent: 'center', padding: 36 }}>
            {card}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The real 1–5 scale students will use, shown small: the clearest way to say what TeachWise is. */
function ScalePreview() {
  const faces: HeadMood[] = ['tired', 'squint', 'neutral', 'grin', 'laugh'];
  const labels = [tr('Poor', 'Mahina'), tr('Fair', 'Katamtaman'), tr('Good', 'Mabuti'), tr('Very good', 'Napakabuti'), tr('Excellent', 'Napakahusay')];
  return (
    <View style={{ alignItems: 'center', gap: 12 }} accessible accessibilityLabel={tr('Each question is rated from 1, poor, to 5, excellent. About three minutes per teacher.', 'Bawat tanong ay nire-rate mula 1, mahina, hanggang 5, napakahusay. Mga tatlong minuto bawat guro.')}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {faces.map((m, i) => (
          <View key={m} style={{ width: 78, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', gap: 2 }}>
            <WiseHead size={46} mood={m} />
            <Txt weight="bold" size={14} color="#FFFFFF">{String(i + 1)}</Txt>
            <Txt size={12} color={colors.onFrameMuted} numberOfLines={1}>{labels[i]}</Txt>
          </View>
        ))}
      </View>
      <Txt size={15} color={colors.onFrameMuted}>{tr('A few short questions, about three minutes per teacher.', 'Ilang maiikling tanong, mga tatlong minuto bawat guro.')}</Txt>
    </View>
  );
}

/** Language and legal links under the sign-in card, where people expect them. */
function Footer() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 14 }}>
      <LanguagePicker />
      <Txt color={colors.muted}>·</Txt>
      <Pressable accessibilityRole="link" onPress={() => router.push('/legal/terms')} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}>
        <Txt weight="medium" size={14} color={colors.muted}>{tr('Terms', 'Tuntunin')}</Txt>
      </Pressable>
      <Txt color={colors.muted}>·</Txt>
      <Pressable accessibilityRole="link" onPress={() => router.push('/legal/privacy')} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}>
        <Txt weight="medium" size={14} color={colors.muted}>{tr('Privacy', 'Privacy')}</Txt>
      </Pressable>
      <Txt color={colors.muted}>·</Txt>
      <Pressable accessibilityRole="link" onPress={() => router.push('/register-school')} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}>
        <Txt weight="medium" size={14} color={colors.muted}>{tr('For schools', 'Para sa paaralan')}</Txt>
      </Pressable>
    </View>
  );
}

function Tabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: { key: Mode; label: string }[] = [
    // Sign in first: most visits are people coming back.
    { key: 'signin', label: tr('Sign in', 'Mag-sign in') },
    { key: 'signup', label: tr('Create account', 'Gumawa ng account') },
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 18, padding: 5, borderWidth: 1, borderColor: colors.borderSoft }}>
      {tabs.map((t) => {
        const on = t.key === mode;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={[{ flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, on ? { backgroundColor: colors.card, ...shadowStyle('soft') } : null]}
          >
            <Txt weight={on ? 'semibold' : 'medium'} size={15} color={on ? colors.text : colors.muted}>{t.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
