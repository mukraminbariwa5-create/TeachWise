import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/api/client';
import type { PublicSchool } from '@/api/types';
import { homeFor, useAuth } from '@/auth/store';
import { PrivacyNotice } from '@/components/auth/PrivacyNotice';
import { Button } from '@/components/Button';
import { Checkbox, Field, PasswordField, useDebounced, type FieldState } from '@/components/form/Field';
import { PublicPage } from '@/components/PublicPage';
import { SchoolBadge } from '@/components/SchoolBadge';
import { Txt } from '@/components/Txt';
import { Pill } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { tap, toast } from '@/lib/ui';
import { colors, space, text } from '@/theme';

interface InviteInfo {
  school: PublicSchool;
  role: 'teacher' | 'admin';
  department: string | null;
  name: string | null;
  email: string | null;
  id_number: string | null;
}

const roleLabel = (i: InviteInfo) =>
  i.role === 'teacher' ? tr('Teacher', 'Guro') : i.department ? tr(`Department admin · ${i.department}`, `Admin ng departamento · ${i.department}`) : tr('School admin', 'Admin ng paaralan');

/** Teachers and admins join their school with the one-time code their admin (or TeachWise) gave them. */
export default function InviteScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const acceptInvite = useAuth((s) => s.acceptInvite);
  const [code, setCode] = useState(String(params.code ?? '').toUpperCase());
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', id_number: '', username: '', email: '', password: '', confirm: '' });
  const [privacy, setPrivacy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userCheck, setUserCheck] = useState<{ state: FieldState; message?: string }>({ state: 'idle' });

  const check = async (value = code) => {
    const c = value.trim();
    if (c.length < 6) return;
    setChecking(true);
    setCodeError(null);
    try {
      const r = await api<InviteInfo>('/auth/invite', { method: 'POST', body: { code: c }, token: null });
      setInvite(r);
      setForm((f) => ({ ...f, name: f.name || r.name || '', email: f.email || r.email || '', id_number: f.id_number || r.id_number || '' }));
      tap();
    } catch (e) {
      setCodeError(e instanceof ApiError ? e.firstMessage : tr('Couldn’t check the code. Are you online?', 'Hindi ma-check ang code. Naka-online ka ba?'));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (params.code) check(String(params.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  const debUser = useDebounced(form.username.trim(), 450);
  useEffect(() => {
    if (!debUser) return setUserCheck({ state: 'idle' });
    if (!/^[A-Za-z0-9_-]{3,50}$/.test(debUser)) return setUserCheck({ state: 'invalid', message: tr('Use 3+ letters, numbers, dashes or underscores.', 'Gumamit ng 3+ letra, numero, gitling o underscore.') });
    let alive = true;
    setUserCheck({ state: 'checking' });
    api<{ ok: boolean; message: string }>('/auth/check-username', { method: 'POST', body: { username: debUser }, token: null })
      .then((r) => alive && setUserCheck({ state: r.ok ? 'valid' : 'invalid', message: r.message }))
      .catch(() => alive && setUserCheck({ state: 'idle' }));
    return () => {
      alive = false;
    };
  }, [debUser]);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const problems = {
    name: form.name.trim().split(/\s+/).length < 2 ? tr('Enter your full name.', 'Ilagay ang buong pangalan mo.') : '',
    id_number: form.id_number.trim().length < 2 ? tr('Enter your employee or ID number.', 'Ilagay ang employee o ID number mo.') : '',
    username: userCheck.state === 'invalid' ? userCheck.message ?? '' : !form.username ? tr('Choose a username.', 'Pumili ng username.') : '',
    password: form.password.length < 8 ? tr('At least 8 characters.', 'Hindi bababa sa 8 character.') : '',
    confirm: form.confirm !== form.password ? tr('Doesn’t match yet.', 'Hindi pa tugma.') : '',
  };
  const show = (k: keyof typeof problems) => errors[k] || (tried ? problems[k] : '');

  const submit = async () => {
    setTried(true);
    if (Object.values(problems).some(Boolean) || !privacy || !invite) return tap(40);
    setBusy(true);
    try {
      const u = await acceptInvite({ code: code.trim(), name: form.name.trim(), id_number: form.id_number.trim(), username: form.username.trim(), email: form.email.trim() || undefined, password: form.password, password_confirmation: form.confirm, accepted_privacy: true });
      toast({ title: tr(`Welcome to ${invite.school.short_name ?? invite.school.name}!`, `Maligayang pagdating sa ${invite.school.short_name ?? invite.school.name}!`), tone: 'success', mood: 'party' });
      router.replace(homeFor(u.role));
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length) setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])));
      else toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t create your account.', 'Hindi nagawa ang account.') });
    } finally {
      setBusy(false);
    }
  };

  if (!invite) {
    return (
      <PublicPage title={tr('Join with an invite code', 'Sumali gamit ang invite code')} subtitle={tr('For teachers and school staff. Your school admin gives you this code.', 'Para sa mga guro at staff. Ibinibigay ng admin ng paaralan ang code na ito.')} mood="point">
        <Field
          label={tr('Invite code', 'Invite code')}
          icon="key"
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14));
            setCodeError(null);
          }}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="TW-XXXX-XXXX"
          state={codeError ? 'invalid' : 'idle'}
          message={codeError ?? undefined}
          onSubmitEditing={() => check()}
        />
        <Button title={tr('Continue', 'Magpatuloy')} size="lg" loading={checking} disabled={code.trim().length < 6} onPress={() => check()} />
        <Txt size={text.small} color={colors.muted} style={{ lineHeight: 19 }}>
          {tr('Students don’t need a code: go back and choose “Create account”.', 'Hindi kailangan ng code ang mga estudyante: bumalik at piliin ang “Gumawa ng account”.')}
        </Txt>
      </PublicPage>
    );
  }

  return (
    <PublicPage title={tr('Create your account', 'Gumawa ng account')} mood="happy">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: 20, padding: space.sm }}>
        <SchoolBadge school={invite.school} size={48} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt weight="semibold" size={text.bodyLg} numberOfLines={2}>{invite.school.name}</Txt>
          <Pill label={roleLabel(invite)} tone={invite.role === 'admin' ? 'orange' : 'green'} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setInvite(null)} hitSlop={8}>
          <Txt weight="semibold" size={text.small} color={colors.accent}>{tr('Change code', 'Ibang code')}</Txt>
        </Pressable>
      </View>
      <Field label={tr('Full name', 'Buong pangalan')} icon="user" value={form.name} onChangeText={set('name')} autoComplete="name" placeholder="Juan Dela Cruz" state={show('name') ? 'invalid' : 'idle'} message={show('name') || undefined} />
      <Field label={tr('Employee / ID number', 'Employee / ID number')} icon="clipboard" value={form.id_number} onChangeText={set('id_number')} autoCapitalize="characters" autoCorrect={false} state={show('id_number') ? 'invalid' : 'idle'} message={show('id_number') || undefined} hint={tr('As used by your school.', 'Gaya ng gamit ng paaralan mo.')} />
      <Field
        label={tr('Username', 'Username')}
        icon="user"
        value={form.username}
        onChangeText={set('username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        state={errors.username ? 'invalid' : userCheck.state !== 'idle' ? userCheck.state : show('username') ? 'invalid' : 'idle'}
        message={errors.username || userCheck.message || show('username') || undefined}
      />
      <Field label={tr('Email (optional)', 'Email (opsyonal)')} icon="mail" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" state={errors.email ? 'invalid' : 'idle'} message={errors.email || tr('Helps you recover your account.', 'Para ma-recover ang account mo.')} />
      <PasswordField label={tr('Password', 'Password')} value={form.password} onChangeText={set('password')} autoComplete="password-new" state={show('password') ? 'invalid' : form.password.length >= 8 ? 'valid' : 'idle'} message={show('password') || undefined} />
      <PasswordField label={tr('Confirm password', 'Kumpirmahin ang password')} value={form.confirm} onChangeText={set('confirm')} autoComplete="password-new" state={form.confirm && !problems.confirm ? 'valid' : show('confirm') ? 'invalid' : 'idle'} message={show('confirm') || undefined} />
      <Checkbox value={privacy} onChange={setPrivacy} invalid={tried && !privacy} label={tr('I agree to the Data Privacy Notice', 'Sumasang-ayon ako sa Data Privacy Notice')}>
        <Txt size={14} color={colors.textSoft} style={{ lineHeight: 20 }}>
          {tr('I agree to the ', 'Sumasang-ayon ako sa ')}
          <Txt size={14} weight="semibold" color={colors.accent} onPress={() => setNotice(true)}>{tr('Data Privacy Notice', 'Data Privacy Notice')}</Txt>
        </Txt>
      </Checkbox>
      <Button title={tr('Create account', 'Gumawa ng account')} size="lg" loading={busy} onPress={submit} />
      <PrivacyNotice visible={notice} onClose={() => setNotice(false)} onAgree={() => setPrivacy(true)} />
    </PublicPage>
  );
}
