import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { saveFile, today } from '@/lib/saveFile';
import { useRouter, type Href } from 'expo-router';
import { api, ApiError } from '@/api/client';
import { useAppInfo } from '@/api/hooks';
import { routeFor, useAuth } from '@/auth/store';
import { PrivacyNotice } from '@/components/auth/PrivacyNotice';
import { Button } from '@/components/Button';
import { PasswordField } from '@/components/form/Field';
import { confirmLogout } from '@/components/PageHeader';
import { Txt } from '@/components/Txt';
import { ListRow, Section, Screen, Segmented, Sheet } from '@/components/ui';
import { WiseMascot } from '@/components/WiseMascot';
import { APP_VERSION } from '@/lib/appInfo';
import { tr, useLang, type Lang } from '@/lib/i18n';
import { enablePush, openSystemSettings, pushStatus, type PushStatus } from '@/lib/push';
import { useSettings } from '@/lib/settings';
import { useTheme, type Appearance } from '@/lib/theme';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, space, text } from '@/theme';

/** App settings, grouped like a phone's settings: appearance, language, notifications, privacy, help, about. */
export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { appearance, setAppearance } = useTheme();
  const { lang, setLang } = useLang();
  const { settings, update } = useSettings();
  const scrollHide = useScrollHide();
  const [push, setPush] = useState<PushStatus>('unsupported');
  const [sheet, setSheet] = useState<'privacy' | 'delete' | 'about' | null>(null);

  useEffect(() => {
    pushStatus().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  if (!user) return null;

  const save = (patch: Parameters<typeof update>[0]) => update(patch).catch(() => toast({ title: tr('Couldn’t save. Check your connection.', 'Hindi na-save. I-check ang connection mo.') }));

  const download = async () => {
    try {
      const data = await api<unknown>('/me/export');
      await saveFile(`teachwise-my-data-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
      toast({ title: tr('Your data is ready', 'Handa na ang data mo'), tone: 'success' });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t download your data.', 'Hindi ma-download ang data mo.') });
    }
  };

  return (
    <Screen title={tr('Settings', 'Settings')} {...scrollHide}>
      <Section title={tr('Appearance', 'Itsura')} footer={tr('“System” follows your phone or computer.', 'Sinusundan ng “System” ang phone o computer mo.')}>
        <View style={{ padding: space.md }}>
          <Segmented<Appearance>
            label={tr('Appearance', 'Itsura')}
            value={appearance}
            onChange={setAppearance}
            options={[
              { key: 'system', label: tr('System', 'System'), icon: 'monitor' },
              { key: 'light', label: tr('Light', 'Light'), icon: 'sun' },
              { key: 'dark', label: tr('Dark', 'Dark'), icon: 'moon' },
            ]}
          />
        </View>
      </Section>

      <Section title={tr('Language', 'Wika')} footer={tr('Professor Wise and the evaluation questions follow this too.', 'Sumusunod din dito si Professor Wise at ang mga tanong sa evaluation.')}>
        <View style={{ padding: space.md }}>
          <Segmented<Lang>
            label={tr('Language', 'Wika')}
            value={lang}
            onChange={setLang}
            options={[
              { key: 'en', label: 'English' },
              { key: 'fil', label: 'Filipino' },
            ]}
          />
        </View>
      </Section>

      <Section title={tr('Notifications', 'Mga notification')} footer={Platform.OS === 'web' ? tr('On computers, notifications appear under the bell.', 'Sa computer, lumalabas ang notifications sa ilalim ng kampana.') : undefined}>
        {push !== 'unsupported' && (
          <ListRow
            icon="bell"
            title={tr('Push notifications', 'Push notifications')}
            subtitle={push === 'blocked' ? tr('Blocked. Tap to open phone settings.', 'Naka-block. Pindutin para buksan ang settings ng phone.') : push === 'on' ? tr('On for this phone', 'Naka-on sa phone na ito') : tr('Get alerts even when the app is closed', 'Makatanggap ng abiso kahit sarado ang app')}
            toggle={push === 'blocked' ? undefined : { value: push === 'on', onChange: async (v) => (v ? setPush(await enablePush()) : openSystemSettings()) }}
            onPress={push === 'blocked' ? openSystemSettings : undefined}
          />
        )}
        {user.role !== 'admin' && (
          <ListRow icon="calendar" title={tr('Evaluation opens', 'Pagbukas ng evaluation')} subtitle={tr('When a new evaluation period starts', 'Kapag nagsimula ang bagong evaluation')} toggle={{ value: settings.notify.periods, onChange: (v) => save({ notify: { ...settings.notify, periods: v } }) }} />
        )}
        {user.role === 'student' && (
          <ListRow icon="clock" title={tr('Deadline reminders', 'Paalala sa deadline')} subtitle={tr('A day before it closes, if you still have teachers left', 'Isang araw bago magsara, kung may natitira ka pa')} toggle={{ value: settings.notify.reminders, onChange: (v) => save({ notify: { ...settings.notify, reminders: v } }) }} />
        )}
        <ListRow icon="shield" title={tr('Account & security', 'Account at seguridad')} subtitle={tr('Password resets and sign-ins. Always on.', 'Pag-reset ng password at sign-in. Laging naka-on.')} last />
      </Section>

      {user.role !== 'platform' && (
        <Section title="Professor Wise">
          <ListRow icon="glasses" title={tr('Page tips', 'Mga tip sa page')} subtitle={tr('Short tips the first time you open each page', 'Maiikling tip sa unang pagbukas ng bawat page')} toggle={{ value: settings.tips, onChange: (v) => save({ tips: v }) }} last />
        </Section>
      )}

      <Section title={tr('Privacy & data', 'Privacy at data')}>
        <ListRow icon="shield" title={tr('Data Privacy Notice', 'Data Privacy Notice')} onPress={() => setSheet('privacy')} />
        <ListRow icon="info" title={tr('Privacy Policy', 'Privacy Policy')} onPress={() => router.push('/legal/privacy')} />
        <ListRow icon="download" title={tr('Download my data', 'I-download ang data ko')} subtitle={tr('A copy of everything stored about you', 'Kopya ng lahat ng nakatabi tungkol sa iyo')} onPress={download} last={user.role === 'platform'} />
        {user.role !== 'platform' && (
          <ListRow icon="trash" title={user.role === 'student' ? tr('Delete account', 'Burahin ang account') : tr('Request account deletion', 'Humiling na burahin ang account')} danger onPress={() => setSheet('delete')} last />
        )}
      </Section>

      <Section title={tr('Support', 'Suporta')}>
        <ListRow icon="help" title={tr('Help & feedback', 'Tulong at feedback')} onPress={() => router.push(routeFor(user.role, 'help') as Href)} />
        <ListRow icon="info" title={tr('About TeachWise', 'Tungkol sa TeachWise')} value={`v${APP_VERSION}`} onPress={() => setSheet('about')} last />
      </Section>

      <Button title={tr('Log out', 'Mag-log out')} variant="outline" size="lg" onPress={() => confirmLogout(logout)} />

      <PrivacyNotice visible={sheet === 'privacy'} onClose={() => setSheet(null)} onAgree={() => {}} />
      <DeleteAccountSheet visible={sheet === 'delete'} onClose={() => setSheet(null)} student={user.role === 'student'} />
      <AboutSheet visible={sheet === 'about'} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function DeleteAccountSheet({ visible, onClose, student }: { visible: boolean; onClose: () => void; student: boolean }) {
  const logout = useAuth((s) => s.logout);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string; requested?: boolean }>('/me/delete', { method: 'POST', body: { password } });
      toast({ title: r.message, tone: 'success' });
      onClose();
      if (!r.requested) await logout();
    } catch (e) {
      setShake((n) => n + 1);
      setError(e instanceof ApiError ? e.firstMessage : tr('Something went wrong. Please try again.', 'May nangyaring mali. Pakisubukan ulit.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={student ? tr('Delete account', 'Burahin ang account') : tr('Request account deletion', 'Humiling na burahin ang account')}>
      <View style={{ alignItems: 'center' }}>
        <WiseMascot size={120} mood="sad" />
      </View>
      <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>
        {student
          ? tr(
              'This permanently deletes your account, settings, notifications and chat with Professor Wise. Evaluations you already sent stay in your teachers’ results, but they are no longer linked to you. This can’t be undone.',
              'Permanenteng buburahin nito ang account, settings, notifications at chat mo kay Professor Wise. Mananatili sa resulta ng mga guro ang mga naipasa mong evaluation, pero hindi na ito konektado sa iyo. Hindi na ito maibabalik.'
            )
          : tr(
              'Your records belong to your school, so an admin will delete your account and confirm with you.',
              'Pag-aari ng paaralan ang mga record mo, kaya ang admin ang magbubura ng account mo at magkukumpirma sa iyo.'
            )}
      </Txt>
      <PasswordField label={tr('Enter your password to confirm', 'Ilagay ang password para kumpirmahin')} value={password} onChangeText={setPassword} autoComplete="password" state={error ? 'invalid' : 'idle'} message={error ?? undefined} shake={shake} onSubmitEditing={submit} />
      <Button title={student ? tr('Delete my account', 'Burahin ang account ko') : tr('Send request', 'Ipadala ang request')} size="lg" loading={busy} disabled={!password} onPress={submit} style={{ backgroundColor: colors.danger }} />
    </Sheet>
  );
}

function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const info = useAppInfo();
  const libs = ['React Native', 'Expo', 'Expo Router', 'TanStack Query', 'Zustand', 'React Native SVG', 'Outfit font (SIL Open Font License)', 'Laravel', 'Laravel Sanctum'];
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('About TeachWise', 'Tungkol sa TeachWise')}>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <WiseMascot size={110} mood="happy" float={false} />
        <Txt weight="bold" size={text.h3}>TeachWise</Txt>
        <Txt size={text.body} color={colors.muted}>{tr(`Version ${APP_VERSION}`, `Bersyon ${APP_VERSION}`)}</Txt>
        {info.data?.school_name ? <Txt size={text.body} color={colors.muted}>{info.data.school_name}</Txt> : null}
      </View>
      <Section>
        <ListRow icon="list" title={tr('Terms of Use', 'Mga Tuntunin ng Paggamit')} onPress={() => { onClose(); router.push('/legal/terms'); }} />
        <ListRow icon="shield" title={tr('Privacy Policy', 'Privacy Policy')} onPress={() => { onClose(); router.push('/legal/privacy'); }} />
        {info.data?.support_email ? <ListRow icon="mail" title={tr('Support email', 'Email ng suporta')} value={info.data.support_email} last /> : null}
      </Section>
      <Txt weight="semibold" size={text.small} color={colors.muted} >{tr('Open-source software', 'Open-source na software')}</Txt>
      <Txt size={text.small} color={colors.muted} style={{ lineHeight: 20 }}>{libs.join(' · ')}</Txt>
    </Sheet>
  );
}
