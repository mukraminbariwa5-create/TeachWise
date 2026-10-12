import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import { useAuth } from '@/auth/store';
import type { PublicSchool } from '@/lib/school';
import { tr } from '@/lib/i18n';
import { setPref } from '@/lib/prefs';
import { tap } from '@/lib/ui';
import { colors } from '@/theme';
import { Button } from '../Button';
import { Checkbox, Field, PasswordField, useDebounced, type FieldState } from '../form/Field';
import { Icon } from '../Icon';
import { FadeIn } from '../Motion';
import { Txt } from '../Txt';
import { WiseHead } from '../WiseMascot';
import { cue, CUES, useCue } from './cue';
import { PrivacyNotice } from './PrivacyNotice';
import { SectionSheet, sectionLabel, suggestedYear, type Section } from './SectionSheet';

interface IdCheck {
  state: FieldState;
  message?: string;
  reason?: 'taken' | 'not_listed';
  name?: string | null;
  section?: { id: number; label: string } | null;
}
interface NameCheck {
  state: FieldState;
  message?: string;
  suggestions: string[];
}

/** Schools format IDs differently (2023-0101, 20-12345, S2023001…): keep letters, digits and dashes, in capitals. */
export function maskId(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z-]/g, '').slice(0, 30);
}

const looksComplete = (id: string) => id.replace(/-/g, '').length >= 4;
const NAME_RE = /^[\p{L}][\p{L}.'\- ]*$/u;
const USERNAME_RE = /^[A-Za-z0-9_-]{3,50}$/;

function passwordRules(pw: string) {
  return [
    { ok: pw.length >= 8, label: tr('At least 8 characters', 'Hindi bababa sa 8 character'), required: true },
    { ok: /[A-Z]/.test(pw), label: tr('A capital letter', 'Isang malaking titik'), required: false },
    { ok: /\d/.test(pw), label: tr('A number', 'Isang numero'), required: false },
    { ok: /[^A-Za-z0-9]/.test(pw), label: tr('A symbol, like ! or #', 'Isang simbolo, gaya ng ! o #'), required: false },
  ];
}

/**
 * Create account in 3 short steps, like Padala's guided flows:
 * 1. Student ID (checked live; may fill in your name and section)  2. About you  3. Password + privacy.
 * Every field checks itself as you type and explains what's wrong in plain words.
 */
export function SignUpWizard({ school, onSignIn }: { school: PublicSchool; onSignIn: () => void }) {
  const router = useRouter();
  const register = useAuth((s) => s.register);
  const sections = useQuery({ queryKey: ['sections', school.id], queryFn: () => api<{ data: Section[] }>(`/sections?school_id=${school.id}`, { token: null }) });

  const [step, setStep] = useState(0);
  const [id, setId] = useState('');
  const [idCheck, setIdCheck] = useState<IdCheck>({ state: 'idle' });
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [userCheck, setUserCheck] = useState<NameCheck>({ state: 'idle', suggestions: [] });
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [shake, setShake] = useState<Record<string, number>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const userRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const bump = (...keys: string[]) => setShake((s) => Object.fromEntries([...Object.entries(s), ...keys.map((k) => [k, (s[k] ?? 0) + 1])]));
  const show = (k: string, s: number) => touched[k] || tried[s];

  // ---- step 1: student ID, checked while typing
  const debId = useDebounced(id, 400);
  useEffect(() => {
    if (!looksComplete(debId)) {
      setIdCheck({ state: 'idle' });
      return;
    }
    let alive = true;
    setIdCheck({ state: 'checking' });
    api<{ ok: boolean; message: string; reason?: IdCheck['reason']; name?: string | null; section?: IdCheck['section'] }>('/auth/check-id', { method: 'POST', body: { id_number: debId, school_id: school.id }, token: null })
      .then((r) => {
        if (!alive) return;
        setIdCheck({ state: r.ok ? 'valid' : 'invalid', message: r.message, reason: r.reason, name: r.name, section: r.section });
        if (r.ok) {
          tap();
          cue(CUES.idFound(r.name));
          if (r.name) setName(r.name);
          if (r.section) setSectionId(r.section.id);
        } else {
          cue({ mood: 'worried', line: r.message });
        }
      })
      .catch((e) => alive && setIdCheck({ state: 'invalid', message: e instanceof ApiError ? e.firstMessage : tr('Couldn’t check the ID. Are you online?', 'Hindi ma-check ang ID. Naka-online ka ba?') }));
    return () => {
      alive = false;
    };
  }, [debId, school.id]);

  const idField: { state: FieldState; message?: string } =
    idCheck.state !== 'idle'
      ? { state: idCheck.state, message: idCheck.message }
      : (touched.id || tried[0]) && id
        ? { state: 'invalid', message: tr('Enter your full student ID.', 'Ilagay ang buong student ID mo.') }
        : tried[0]
          ? { state: 'invalid', message: tr('Enter your student ID.', 'Ilagay ang student ID mo.') }
          : { state: 'idle' };

  // ---- step 2: name, username (checked live), section
  const listedName = idCheck.state === 'valid' && !!idCheck.name;
  const listedSection = idCheck.state === 'valid' && !!idCheck.section;
  const nameWords = name.trim().split(/\s+/).filter(Boolean);
  const nameField: { state: FieldState; message?: string } = listedName
    ? { state: 'valid' }
    : !name.trim()
      ? show('name', 1)
        ? { state: 'invalid', message: tr('Enter your full name.', 'Ilagay ang buong pangalan mo.') }
        : { state: 'idle' }
      : !NAME_RE.test(name.trim())
        ? { state: 'invalid', message: tr('Use letters only (dots, dashes and apostrophes are fine).', 'Letra lang ang gamitin (puwede ang tuldok, gitling at kudlit).') }
        : nameWords.length < 2
          ? show('name', 1)
            ? { state: 'invalid', message: tr('Add your last name too.', 'Idagdag din ang apelyido mo.') }
            : { state: 'idle' }
          : { state: 'valid' };

  const debUser = useDebounced(username, 450);
  useEffect(() => {
    if (!debUser) {
      setUserCheck({ state: 'idle', suggestions: [] });
      return;
    }
    if (!USERNAME_RE.test(debUser)) {
      setUserCheck({ state: 'invalid', message: tr('Use 3+ letters, numbers, dashes or underscores (no spaces).', 'Gumamit ng 3+ letra, numero, gitling o underscore (walang espasyo).'), suggestions: [] });
      return;
    }
    let alive = true;
    setUserCheck((c) => ({ ...c, state: 'checking' }));
    api<{ ok: boolean; message: string; suggestions: string[] }>('/auth/check-username', { method: 'POST', body: { username: debUser, id_number: id, name }, token: null })
      .then((r) => {
        if (!alive) return;
        setUserCheck({ state: r.ok ? 'valid' : 'invalid', message: r.message, suggestions: r.suggestions ?? [] });
        if (!r.ok && r.suggestions?.length) cue(CUES.usernameTaken());
      })
      .catch(() => alive && setUserCheck({ state: 'idle', suggestions: [] }));
    return () => {
      alive = false;
    };
    // id and name only improve the suggestions; re-check when the username changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debUser]);

  const userField: { state: FieldState; message?: string } = serverErrors.username
    ? { state: 'invalid', message: serverErrors.username }
    : userCheck.state !== 'idle'
      ? { state: userCheck.state, message: userCheck.message }
      : tried[1] && !username
        ? { state: 'invalid', message: tr('Choose a username.', 'Pumili ng username.') }
        : { state: 'idle' };

  const allSections = sections.data?.data ?? [];
  const section = allSections.find((s) => s.id === sectionId);
  const year = suggestedYear(id);

  // ---- step 3: password, confirm, privacy
  const rules = passwordRules(password);
  const strength = rules.filter((r) => r.ok).length;
  const pwField: { state: FieldState; message?: string } = serverErrors.password
    ? { state: 'invalid', message: serverErrors.password }
    : !password
      ? tried[2]
        ? { state: 'invalid', message: tr('Create a password.', 'Gumawa ng password.') }
        : { state: 'idle' }
      : password.length < 8
        ? show('password', 2)
          ? { state: 'invalid', message: tr(`${8 - password.length} more character${8 - password.length === 1 ? '' : 's'} to go.`, `${8 - password.length} character pa.`) }
          : { state: 'idle' }
        : { state: 'valid', message: [tr('Weak', 'Mahina'), tr('Weak', 'Mahina'), tr('Okay', 'Puwede na'), tr('Good', 'Maganda'), tr('Strong password', 'Matibay na password')][strength] };
  const confirmField: { state: FieldState; message?: string } = !confirm
    ? tried[2]
      ? { state: 'invalid', message: tr('Type your password again.', 'I-type ulit ang password mo.') }
      : { state: 'idle' }
    : confirm === password
      ? { state: 'valid', message: tr('Passwords match', 'Magkatugma ang password') }
      : password.startsWith(confirm)
        ? { state: 'idle', message: undefined }
        : { state: 'invalid', message: tr('Doesn’t match yet', 'Hindi pa tugma') };

  // ---- navigation
  const stepOk = [
    idCheck.state === 'valid',
    nameField.state === 'valid' && userField.state === 'valid' && !!sectionId,
    password.length >= 8 && confirm === password && privacy,
  ];

  const next = () => {
    setTried((t) => ({ ...t, [step]: true }));
    if (!stepOk[step]) {
      tap(40);
      cue(CUES.error());
      if (step === 0) bump('id');
      if (step === 1) {
        if (nameField.state !== 'valid') {
          bump('name');
          nameRef.current?.focus();
        } else if (userField.state !== 'valid') {
          bump('username');
          userRef.current?.focus();
        }
      }
      if (step === 2) {
        if (password.length < 8) {
          bump('password');
          pwRef.current?.focus();
        } else if (confirm !== password) {
          bump('confirm');
          confirmRef.current?.focus();
        }
        if (!privacy) bump('privacy');
      }
      return;
    }
    tap();
    if (step < 2) {
      setStep(step + 1);
      cue(step === 0 ? (listedName ? CUES.username() : CUES.name()) : CUES.password());
    } else {
      submit();
    }
  };

  const submit = async () => {
    setBusy(true);
    setServerErrors({});
    cue(CUES.busy());
    try {
      await register({ school_id: school.id, name: name.trim(), id_number: id.trim(), username: username.trim(), section_id: sectionId!, password, password_confirmation: confirm, accepted_privacy: true });
      tap(30);
      cue(CUES.done());
      await setPref('justJoined', '1');
      router.replace('/student');
    } catch (err) {
      tap(40);
      if (err instanceof ApiError && Object.keys(err.errors).length) {
        const errs = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]]));
        setServerErrors(errs);
        if (errs.id_number) setStep(0);
        else if (errs.name || errs.username || errs.section_id) setStep(1);
      } else {
        setServerErrors({ form: err instanceof ApiError ? err.firstMessage : tr('Could not create your account. Please try again.', 'Hindi nagawa ang account. Pakisubukan ulit.') });
      }
      cue(CUES.error());
    } finally {
      setBusy(false);
    }
  };

  const STEP_LABELS = [tr('Student ID', 'Student ID'), tr('About you', 'Tungkol sa iyo'), tr('Password', 'Password')];

  return (
    <View style={{ gap: 18 }}>
      {/* progress */}
      <View accessibilityRole="progressbar" accessibilityLabel={tr(`Step ${step + 1} of 3: ${STEP_LABELS[step]}`, `Hakbang ${step + 1} sa 3: ${STEP_LABELS[step]}`)} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {STEP_LABELS.map((l, i) => (
            <View key={l} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < step ? colors.successFg : i === step ? colors.navy : colors.track }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {step > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setStep(step - 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingRight: 8 }}>
              <Icon name="arrowLeft" size={16} color={colors.accent} strokeWidth={2.2} />
              <Txt weight="semibold" size={14} color={colors.accent}>{tr('Back', 'Bumalik')}</Txt>
            </Pressable>
          ) : null}
          <Txt weight="semibold" size={13} color={colors.muted} style={{ flex: 1, textAlign: 'right', letterSpacing: 0.6 }}>
            {tr(`STEP ${step + 1} OF 3 · ${STEP_LABELS[step].toUpperCase()}`, `HAKBANG ${step + 1} SA 3 · ${STEP_LABELS[step].toUpperCase()}`)}
          </Txt>
        </View>
      </View>

      <FadeIn key={step} distance={10} style={{ gap: 16 }}>
        {step === 0 && (
          <>
            <Field
              label={tr('Student ID', 'Student ID')}
              icon="clipboard"
              value={id}
              onChangeText={(v) => {
                setId(maskId(v));
                setServerErrors((e) => ({ ...e, id_number: '' }));
              }}
              onBlur={() => touch('id')}
              onFocus={() => cue(CUES.id())}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              placeholder={tr('e.g. 2023-0101', 'hal. 2023-0101')}
              returnKeyType="next"
              onSubmitEditing={next}
              state={serverErrors.id_number ? 'invalid' : idField.state}
              message={serverErrors.id_number || idField.message}
              hint={tr(`Exactly as printed on your ${school.short_name ?? school.name} ID.`, `Eksakto gaya ng nasa ID mo sa ${school.short_name ?? school.name}.`)}
              shake={shake.id}
            />
            {idCheck.state === 'valid' && (idCheck.name || idCheck.section) && (
              <FadeIn>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.successBg, borderRadius: 18, padding: 12 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <WiseHead size={34} mood="laugh" pop />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="semibold" size={16} color={colors.successFg}>{idCheck.name ?? tr('ID accepted', 'Tanggap ang ID')}</Txt>
                    {idCheck.section && <Txt size={14} color={colors.successFg}>{idCheck.section.label}</Txt>}
                  </View>
                </View>
              </FadeIn>
            )}
            {idCheck.reason === 'taken' && <Button title={tr('Sign in instead', 'Mag-sign in na lang')} variant="outline" onPress={onSignIn} />}
          </>
        )}

        {step === 1 && (
          <>
            <Field
              ref={nameRef}
              label={tr('Full name', 'Buong pangalan')}
              icon="user"
              value={name}
              onChangeText={setName}
              onBlur={() => touch('name')}
              onFocus={() => cue(CUES.name())}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="e.g. Aisha Tan"
              max={80}
              locked={listedName}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => userRef.current?.focus()}
              state={nameField.state}
              message={nameField.message}
              shake={shake.name}
            />
            <Field
              ref={userRef}
              label={tr('Username', 'Username')}
              icon="user"
              value={username}
              onChangeText={(v) => {
                setUsername(v.replace(/\s/g, ''));
                setServerErrors((e) => ({ ...e, username: '' }));
              }}
              onBlur={() => touch('username')}
              onFocus={() => cue(CUES.username())}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
              placeholder="e.g. aishatan"
              max={50}
              returnKeyType="next"
              state={userField.state}
              message={userField.message}
              hint={tr('You can sign in with this or your student ID.', 'Puwede kang mag-sign in gamit ito o ang student ID mo.')}
              shake={shake.username}
            >
              {userCheck.state === 'invalid' && userCheck.suggestions.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {userCheck.suggestions.map((s) => (
                    <Pressable
                      key={s}
                      accessibilityRole="button"
                      accessibilityLabel={tr(`Use ${s}`, `Gamitin ang ${s}`)}
                      onPress={() => {
                        tap();
                        setUsername(s);
                        setUserCheck({ state: 'valid', message: tr('Nice, that username is free.', 'Ayos, libre pa ang username na iyan.'), suggestions: [] });
                      }}
                      style={({ hovered }: { hovered?: boolean }) => ({ height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: hovered ? colors.navy : colors.brandSoft, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 })}
                    >
                      {({ hovered }: { hovered?: boolean }) => (
                        <>
                          <Icon name="sparkle" size={13} color={hovered ? '#FFFFFF' : colors.accent} strokeWidth={2} />
                          <Txt weight="semibold" size={14} color={hovered ? '#FFFFFF' : colors.accent}>{s}</Txt>
                        </>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </Field>

            <SectionField
              section={section}
              locked={listedSection}
              invalid={tried[1] && !sectionId}
              onOpen={() => {
                cue(CUES.section());
                setPicker(true);
              }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <PasswordField
              ref={pwRef}
              label={tr('Password', 'Password')}
              value={password}
              onChangeText={setPassword}
              onBlur={() => {
                touch('password');
                if (useCue.getState().cue?.mood === 'shy') cue(null);
              }}
              onFocus={() => cue(CUES.password())}
              autoComplete="password-new"
              placeholder={tr('At least 8 characters', 'Hindi bababa sa 8 character')}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmRef.current?.focus()}
              state={pwField.state}
              message={pwField.message}
              shake={shake.password}
            >
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: strength >= i && password ? (strength <= 1 ? colors.danger : strength === 2 ? colors.urgent : colors.successFg) : colors.track }} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
                  {rules.map((r) => (
                    <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '45%' }}>
                      <Icon name={r.ok ? 'checkCircle' : 'plus'} size={14} color={r.ok ? colors.successFg : colors.muted} strokeWidth={2.2} />
                      <Txt size={13} color={r.ok ? colors.successFg : colors.muted}>{r.label}</Txt>
                    </View>
                  ))}
                </View>
              </View>
            </PasswordField>
            <PasswordField
              ref={confirmRef}
              label={tr('Confirm password', 'Kumpirmahin ang password')}
              value={confirm}
              onChangeText={setConfirm}
              onFocus={() => cue(CUES.password())}
              onBlur={() => {
                if (useCue.getState().cue?.mood === 'shy') cue(null);
              }}
              autoComplete="password-new"
              placeholder={tr('Type it again', 'I-type ulit')}
              returnKeyType="go"
              onSubmitEditing={next}
              state={confirmField.state}
              message={confirmField.message}
              shake={shake.confirm}
            />
            <Checkbox
              value={privacy}
              onChange={(v) => {
                setPrivacy(v);
                if (v) cue(CUES.privacy());
              }}
              invalid={tried[2] && !privacy}
              label={tr('I agree to the Data Privacy Notice', 'Sumasang-ayon ako sa Data Privacy Notice')}
            >
              <Txt size={14} style={{ lineHeight: 20 }}>
                {tr('I agree to the ', 'Sumasang-ayon ako sa ')}
                <Txt weight="semibold" size={14} color={colors.accent} onPress={() => setNotice(true)} accessibilityRole="link" style={{ textDecorationLine: 'underline' }}>
                  {tr('Data Privacy Notice', 'Data Privacy Notice')}
                </Txt>
                {tr('. My answers stay anonymous.', '. Mananatiling anonymous ang mga sagot ko.')}
              </Txt>
              {tried[2] && !privacy && <Txt size={13} color={colors.danger} style={{ marginTop: 4 }}>{tr('Please agree to continue.', 'Pakisang-ayunan para makapagpatuloy.')}</Txt>}
            </Checkbox>
          </>
        )}
      </FadeIn>

      {serverErrors.form ? (
        <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.dangerBg, borderRadius: 14, padding: 12 }}>
          <Txt size={15} color={colors.danger}>{serverErrors.form}</Txt>
        </View>
      ) : null}

      <Button
        title={step < 2 ? tr('Continue  →', 'Magpatuloy  →') : tr('Create account  →', 'Gumawa ng account  →')}
        size="lg"
        onPress={next}
        loading={busy || (step === 0 && idCheck.state === 'checking')}
      />

      <SectionSheet
        visible={picker}
        sections={allSections}
        loading={sections.isLoading}
        value={sectionId}
        year={year}
        onPick={(s) => {
          tap();
          setSectionId(s.id);
          setPicker(false);
          cue({ mood: 'proud', line: tr(`**${sectionLabel(s)}**, got it!`, `**${sectionLabel(s)}**, sige!`) });
        }}
        onClose={() => setPicker(false)}
      />
      <PrivacyNotice visible={notice} onClose={() => setNotice(false)} onAgree={() => setPrivacy(true)} />
    </View>
  );
}

function SectionField({ section, locked, invalid, onOpen }: { section?: Section; locked: boolean; invalid?: boolean; onOpen: () => void }) {
  const label = section ? sectionLabel(section) : null;
  if (locked) {
    return <Field label={tr('Section', 'Section')} icon="book" value={label ?? ''} locked state="valid" />;
  }
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="medium" size={14} color={colors.textSoft}>{tr('Section', 'Section')}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? tr(`Section ${label}. Change section`, `Section ${label}. Palitan`) : tr('Choose your section', 'Piliin ang section mo')}
        onPress={onOpen}
        style={({ hovered }: { hovered?: boolean }) => ({
          height: 54,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: invalid ? colors.danger : label ? colors.successFg : hovered ? colors.navy : colors.border,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
        })}
      >
        <Icon name="book" size={20} color={label ? colors.accent : colors.muted} />
        <Txt size={16} color={label ? colors.text : colors.placeholder} style={{ flex: 1 }}>{label ?? tr('Choose your section', 'Piliin ang section mo')}</Txt>
        {label ? <Icon name="checkCircle" size={20} color={colors.successFg} strokeWidth={2} /> : <Icon name="chevronDown" size={18} color={colors.muted} strokeWidth={2} />}
      </Pressable>
      {invalid && <Txt size={13} color={colors.danger}>{tr('Choose your section.', 'Piliin ang section mo.')}</Txt>}
    </View>
  );
}
