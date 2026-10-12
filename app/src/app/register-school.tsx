import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/Button';
import { Field } from '@/components/form/Field';
import { Icon, type IconName } from '@/components/Icon';
import { PublicPage } from '@/components/PublicPage';
import { Txt } from '@/components/Txt';
import { WiseMascot } from '@/components/WiseMascot';
import { tr } from '@/lib/i18n';
import { tap } from '@/lib/ui';
import { colors, space, text } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Register your school": a school applies, the TeachWise team approves and sends the first admin invite. */
export default function RegisterSchool() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', short_name: '', location: '', contact_name: '', contact_position: '', contact_email: '', contact_phone: '', student_count: '', message: '' });
  const [tried, setTried] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (v: string) => {
    setF((s) => ({ ...s, [k]: k === 'student_count' ? v.replace(/\D/g, '') : v }));
    setServer((s) => ({ ...s, [k]: '' }));
  };
  const problems: Partial<Record<keyof typeof f, string>> = {
    name: f.name.trim().length < 4 ? tr('Enter the school’s full name.', 'Ilagay ang buong pangalan ng paaralan.') : '',
    location: !f.location.trim() ? tr('Where is the school?', 'Saan ang paaralan?') : '',
    contact_name: f.contact_name.trim().split(/\s+/).length < 2 ? tr('Enter your full name.', 'Ilagay ang buong pangalan mo.') : '',
    contact_position: !f.contact_position.trim() ? tr('e.g. Registrar, QA Director, Dean', 'hal. Registrar, QA Director, Dean') : '',
    contact_email: !EMAIL.test(f.contact_email.trim()) ? tr('Enter a valid email; we reply here.', 'Maglagay ng tamang email; dito kami sasagot.') : '',
  };
  const err = (k: keyof typeof f) => server[k] || (tried ? problems[k] || '' : '');
  const state = (k: keyof typeof f) => (err(k) ? 'invalid' : tried && f[k] ? 'valid' : 'idle') as 'invalid' | 'valid' | 'idle';

  const submit = async () => {
    setTried(true);
    if (Object.values(problems).some(Boolean)) return tap(40);
    setBusy(true);
    try {
      const r = await api<{ message: string }>('/schools/apply', {
        method: 'POST',
        token: null,
        body: { ...f, short_name: f.short_name.trim() || undefined, contact_phone: f.contact_phone.trim() || undefined, student_count: f.student_count ? Number(f.student_count) : undefined, message: f.message.trim() || undefined },
      });
      setDone(r.message);
      tap(30);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length) setServer(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])));
      else setServer({ form: e instanceof ApiError ? e.firstMessage : tr('Couldn’t send. Are you online?', 'Hindi naipadala. Naka-online ka ba?') });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <PublicPage title={tr('Application sent', 'Naipadala ang aplikasyon')} mood="party">
        <View style={{ alignItems: 'center', gap: space.md }}>
          <WiseMascot size={140} mood="proud" />
          <Txt size={text.bodyLg} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 24 }}>{done}</Txt>
          <Txt size={text.body} color={colors.muted} style={{ textAlign: 'center', lineHeight: 22 }}>
            {tr('Once approved, you’ll get an invite code to create your admin account and set up your school in a few steps.', 'Kapag naaprubahan, makakatanggap ka ng invite code para gumawa ng admin account at i-set up ang paaralan sa ilang hakbang.')}
          </Txt>
          <Button title={tr('I have my invite code', 'May invite code na ako')} variant="outline" onPress={() => router.replace('/invite')} />
        </View>
      </PublicPage>
    );
  }

  const perks: [IconName, string][] = [
    ['shield', tr('Anonymous by design, Data Privacy Act ready', 'Anonymous, handa sa Data Privacy Act')],
    ['users', tr('Students join with your approved ID list', 'Sumasali ang estudyante gamit ang aprubadong ID list ninyo')],
    ['barChart', tr('Reports per teacher, department and section', 'Mga report bawat guro, departamento at section')],
  ];

  return (
    <PublicPage title={tr('Bring TeachWise to your school', 'Dalhin ang TeachWise sa paaralan mo')} subtitle={tr('For registrars, QA offices and deans. Free to start, set up in an afternoon.', 'Para sa registrar, QA office at dean. Libreng simulan, ma-set up sa isang hapon.')} mood="cheer" maxWidth={640}>
      <View style={{ gap: space.xs }}>
        {perks.map(([icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name={icon} size={18} color={colors.successFg} strokeWidth={2} />
            <Txt size={text.body} color={colors.textSoft} style={{ flex: 1 }}>{label}</Txt>
          </View>
        ))}
      </View>

      <Txt weight="semibold" size={text.small} color={colors.muted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>{tr('The school', 'Ang paaralan')}</Txt>
      <Field label={tr('School name', 'Pangalan ng paaralan')} icon="book" value={f.name} onChangeText={set('name')} placeholder="Mindanao State University – Sulu" state={state('name')} message={err('name') || undefined} max={150} />
      <Field label={tr('Short name (optional)', 'Maikling pangalan (opsyonal)')} icon="edit" value={f.short_name} onChangeText={set('short_name')} placeholder="MSU-Sulu" max={40} hint={tr('Shown in the app and used for your join code.', 'Makikita sa app at gagamitin sa join code.')} />
      <Field label={tr('City / province', 'Lungsod / probinsya')} icon="globe" value={f.location} onChangeText={set('location')} placeholder="Jolo, Sulu" state={state('location')} message={err('location') || undefined} />
      <Field label={tr('About how many students? (optional)', 'Mga ilang estudyante? (opsyonal)')} icon="users" value={f.student_count} onChangeText={set('student_count')} keyboardType="number-pad" placeholder="1500" />

      <Txt weight="semibold" size={text.small} color={colors.muted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>{tr('You', 'Ikaw')}</Txt>
      <Field label={tr('Your full name', 'Buong pangalan mo')} icon="user" value={f.contact_name} onChangeText={set('contact_name')} autoComplete="name" state={state('contact_name')} message={err('contact_name') || undefined} />
      <Field label={tr('Your position', 'Posisyon mo')} icon="clipboard" value={f.contact_position} onChangeText={set('contact_position')} placeholder={tr('Registrar', 'Registrar')} state={state('contact_position')} message={err('contact_position') || undefined} />
      <Field label={tr('Work email', 'Work email')} icon="mail" value={f.contact_email} onChangeText={set('contact_email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" state={state('contact_email')} message={err('contact_email') || undefined} />
      <Field label={tr('Phone (optional)', 'Telepono (opsyonal)')} icon="phone" value={f.contact_phone} onChangeText={set('contact_phone')} keyboardType="phone-pad" autoComplete="tel" />
      <Field label={tr('Anything we should know? (optional)', 'May dapat ba kaming malaman? (opsyonal)')} icon="chat" value={f.message} onChangeText={set('message')} multiline max={2000} placeholder={tr('e.g. we want to start with the midterm evaluation in March', 'hal. gusto naming magsimula sa midterm evaluation sa Marso')} />

      {server.form ? <Txt size={text.body} color={colors.danger}>{server.form}</Txt> : null}
      <Button title={tr('Send application', 'Ipadala ang aplikasyon')} size="lg" loading={busy} onPress={submit} />
      <Txt size={text.small} color={colors.muted} style={{ textAlign: 'center', lineHeight: 19 }}>
        {tr('By applying you confirm you may act for the school. We use these details only to contact you.', 'Sa pag-apply, kinukumpirma mong puwede kang kumatawan sa paaralan. Gagamitin lang namin ang detalyeng ito para makipag-ugnayan.')}
      </Txt>
    </PublicPage>
  );
}
