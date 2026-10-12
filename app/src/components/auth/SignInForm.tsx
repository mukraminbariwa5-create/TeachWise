import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { homeFor, useAuth } from '@/auth/store';
import { tr } from '@/lib/i18n';
import { getPref, setPref } from '@/lib/prefs';
import { tap } from '@/lib/ui';
import { colors } from '@/theme';
import { Button } from '../Button';
import { Field, PasswordField, Toggle } from '../form/Field';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { cue, CUES, useCue } from './cue';
import { ForgotPassword } from './ForgotPassword';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Sign in: username or ID, password, "Stay signed in", "Forgot password?".
 * Wrong passwords shake the fields and say how many tries are left; after 5 a countdown runs.
 */
export function SignInForm({ schoolId, onNeedSchool }: { schoolId?: number | null; onNeedSchool?: () => void }) {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [form, setForm] = useState({ login: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);
  const [forgot, setForgot] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // Remember the last username on this device, so returning students only type their password.
  useEffect(() => {
    getPref('lastLogin').then((v) => v && setForm((f) => (f.login ? f : { ...f, login: v })));
  }, []);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  const submit = async () => {
    if (lockedFor > 0) return;
    if (!form.login.trim() || !form.password) {
      cue(CUES.error());
      setShake((n) => n + 1);
      return setError(tr('Enter your username or ID number and your password.', 'Ilagay ang username o ID number at password mo.'));
    }
    setBusy(true);
    setError(null);
    cue(CUES.busy());
    try {
      const u = await login(form.login.trim(), form.password, remember, schoolId);
      await setPref('lastLogin', form.login.trim());
      tap(20);
      cue(CUES.done());
      router.replace(homeFor(u.role));
    } catch (e) {
      tap(40);
      setShake((n) => n + 1);
      if (e instanceof ApiError && e.data.needs_school) {
        // The same ID number is used at more than one school: ask which one, keep the password.
        setError(e.message);
        cue(CUES.error());
        onNeedSchool?.();
        return;
      }
      setForm((f) => ({ ...f, password: '' }));
      if (e instanceof ApiError && e.data.locked) {
        setLockedFor(Number(e.data.retry_after) || 600);
        setError(e.message);
        cue(CUES.locked());
      } else if (e instanceof ApiError && typeof e.data.attempts_left === 'number') {
        const left = e.data.attempts_left as number;
        setError(
          left <= 2
            ? tr(`Wrong login or password. ${left} ${left === 1 ? 'try' : 'tries'} left before a short lockout.`, `Mali ang login o password. ${left} subok na lang bago ma-lock saglit.`)
            : tr('Wrong login or password. Please try again.', 'Mali ang login o password. Pakisubukan ulit.')
        );
        cue(CUES.wrong(left));
        passwordRef.current?.focus();
      } else {
        setError(e instanceof ApiError ? e.firstMessage : tr('Could not sign in. Please try again.', 'Hindi makapag-sign in. Pakisubukan ulit.'));
        cue(CUES.wrong());
      }
    } finally {
      setBusy(false);
    }
  };

  const locked = lockedFor > 0;

  return (
    <View style={{ gap: 16 }}>
      <Field
        label={tr('Username or ID number', 'Username o ID number')}
        icon="user"
        value={form.login}
        onChangeText={(v) => setForm((f) => ({ ...f, login: v }))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        autoFocus
        placeholder="e.g. 2023-0001"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => passwordRef.current?.focus()}
        onFocus={() => cue({ mood: 'wink', line: tr('Your **username** or your **student ID** both work.', 'Puwede ang **username** o **student ID** mo.') })}
        state={error ? 'invalid' : 'idle'}
        shake={shake}
      />
      <PasswordField
        ref={passwordRef}
        label={tr('Password', 'Password')}
        value={form.password}
        onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
        autoComplete="password"
        placeholder={tr('Your password', 'Ang password mo')}
        returnKeyType="go"
        onSubmitEditing={submit}
        onFocus={() => cue(CUES.password())}
        onBlur={() => {
          if (useCue.getState().cue?.mood === 'shy') cue(null);
        }}
        state={error ? 'invalid' : 'idle'}
        shake={shake}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Toggle label={tr('Stay signed in', 'Manatiling naka-sign in')} value={remember} onChange={setRemember} hint={remember ? undefined : tr('You’ll be signed out when you close the app.', 'Masa-sign out ka kapag isinara ang app.')} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setForgot(true)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
          <Txt weight="semibold" size={14} color={colors.accent}>{tr('Forgot password?', 'Nakalimutan?')}</Txt>
        </Pressable>
      </View>

      {error && (
        <View accessibilityLiveRegion="assertive" style={{ backgroundColor: colors.dangerBg, borderRadius: 14, padding: 12, gap: 6 }}>
          <Txt size={15} color={colors.danger} style={{ lineHeight: 21 }}>{error}</Txt>
          {locked && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="clock" size={16} color={colors.danger} strokeWidth={2} />
              <Txt weight="semibold" size={15} color={colors.danger}>{tr(`Try again in ${mmss(lockedFor)}`, `Subukan ulit sa ${mmss(lockedFor)}`)}</Txt>
            </View>
          )}
        </View>
      )}

      <Button
        title={locked ? tr(`Locked · ${mmss(lockedFor)}`, `Naka-lock · ${mmss(lockedFor)}`) : tr('Sign in  →', 'Mag-sign in  →')}
        size="lg"
        onPress={submit}
        loading={busy}
        disabled={locked}
      />
      {locked && <Button title={tr('Ask the admin for a new password', 'Humingi ng bagong password sa admin')} variant="outline" onPress={() => setForgot(true)} />}

      <ForgotPassword visible={forgot} initialLogin={form.login} onClose={() => setForgot(false)} />
    </View>
  );
}
