import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { ApiError, apiUpload, api } from '@/api/client';
import { useAdminSchool, useSaveSchool, type AdminSchool } from '@/api/admin';
import { useAuth } from '@/auth/store';
import { FormSheet, type FieldDef, type FormValues } from '@/components/admin/FormSheet';
import { Button } from '@/components/Button';
import { PasswordField } from '@/components/form/Field';
import { SchoolBadge } from '@/components/SchoolBadge';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { ListRow, Screen, Section, Segmented, Sheet } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { pickImageFile } from '@/lib/pickFile';
import { saveFile, today } from '@/lib/saveFile';
import { joinLink } from '@/lib/school';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, shadowStyle, space, text } from '@/theme';

type SheetName = 'profile' | 'contacts' | 'scale' | 'delete' | null;

/** The school's own settings: profile and logo, join link, how evaluations work, and its data. */
export default function SchoolSettingsScreen() {
  const q = useAdminSchool();
  const save = useSaveSchool();
  const setSchool = useAuth((s) => s.setSchool);
  const scrollHide = useScrollHide();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [uploading, setUploading] = useState(false);

  if (!q.data) return <ScreenState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data.school;
  const st = s.settings;

  const apply = async (body: Record<string, unknown>, done = tr('Saved', 'Na-save')) => {
    const r = await save.mutateAsync(body);
    setSchool(r.school);
    toast({ title: done, tone: 'success' });
  };
  const quick = (body: Record<string, unknown>) => apply(body).catch((e) => toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t save.', 'Hindi na-save.') }));

  const upload = async () => {
    const file = await pickImageFile();
    if (!file) return;
    setUploading(true);
    try {
      const r = await apiUpload<AdminSchool>('/admin/school/logo', 'logo', file, file.name);
      q.refetch();
      setSchool(r.school);
      toast({ title: tr('Logo updated', 'Na-update ang logo'), tone: 'success' });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t upload the logo.', 'Hindi na-upload ang logo.') });
    } finally {
      setUploading(false);
    }
  };

  const link = joinLink(s.code);
  const shareLink = async () => {
    const msg = tr(
      `${s.name} uses TeachWise for teacher evaluations. Create your student account here: ${link}\nOr search for “${s.short_name ?? s.name}” in the app, or use the school code ${s.code}.`,
      `Gumagamit ang ${s.name} ng TeachWise para sa teacher evaluation. Gumawa ng student account dito: ${link}\nO hanapin ang “${s.short_name ?? s.name}” sa app, o gamitin ang school code na ${s.code}.`
    );
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard?.writeText(msg);
        toast({ title: tr('Copied. Paste it in your group chat or announcement.', 'Nakopya. I-paste sa group chat o anunsyo.'), tone: 'success' });
      } else await Share.share({ message: msg });
    } catch {
      // closed
    }
  };

  const exportData = async () => {
    try {
      const data = await api<unknown>('/admin/school/export');
      await saveFile(`teachwise-${s.code.toLowerCase()}-export-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t export.', 'Hindi na-export.') });
    }
  };

  const profileFields: FieldDef[] = [
    { key: 'name', label: tr('School name', 'Pangalan ng paaralan'), kind: 'text', icon: 'book', required: true, max: 150 },
    { key: 'short_name', label: tr('Short name', 'Maikling pangalan'), kind: 'text', icon: 'edit', max: 40, hint: tr('Shown in the app bar, e.g. MSU-Sulu', 'Makikita sa app bar, hal. MSU-Sulu') },
    { key: 'location', label: tr('City / province', 'Lungsod / probinsya'), kind: 'text', icon: 'globe', required: true },
    { key: 'code', label: tr('School code', 'School code'), kind: 'text', icon: 'key', required: true, max: 20, hint: tr('Students can type this to find your school. Changing it breaks old join links.', 'Puwedeng i-type ito ng estudyante para mahanap ang paaralan. Masisira ang lumang join link kapag pinalitan.') },
  ];
  const contactFields: FieldDef[] = [
    { key: 'support_email', label: tr('Help email for students and teachers', 'Help email para sa estudyante at guro'), kind: 'email', required: true },
    { key: 'dpo_email', label: tr('Data Protection Officer email', 'Email ng Data Protection Officer'), kind: 'email', hint: tr('Shown in the Privacy Policy (Data Privacy Act).', 'Makikita sa Privacy Policy (Data Privacy Act).') },
    { key: 'email_domains', label: tr('School email domains', 'Email domain ng paaralan'), kind: 'text', icon: 'mail', placeholder: 'msusulu.edu.ph', hint: tr('Separate with commas. People can find your school by typing their school email.', 'Paghiwalayin ng kuwit. Mahahanap ang paaralan sa pag-type ng school email.') },
    { key: 'contact_name', label: tr('Main contact (for TeachWise)', 'Pangunahing contact (para sa TeachWise)'), kind: 'text', icon: 'user' },
    { key: 'contact_email', label: tr('Main contact email', 'Email ng pangunahing contact'), kind: 'email' },
  ];
  const scaleFields: FieldDef[] = [1, 2, 3, 4, 5].flatMap((n) => [
    { key: `en${n}`, label: `${n} · English`, kind: 'text' as const, icon: 'edit' as const, required: true, max: 30 },
    { key: `fil${n}`, label: `${n} · Filipino`, kind: 'text' as const, icon: 'edit' as const, required: true, max: 30 },
  ]);

  return (
    <Screen title={tr('School settings', 'Settings ng paaralan')} subtitle={tr('Your school’s profile, join link and evaluation rules', 'Profile, join link at mga patakaran ng evaluation ng paaralan')} maxWidth={820} {...scrollHide}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderRadius: 26, padding: space.lg }, shadowStyle('soft')]}>
        <SchoolBadge school={s} size={72} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Txt weight="bold" size={text.h3} numberOfLines={2}>{s.name}</Txt>
          <Txt size={text.body} color={colors.muted}>{[s.location, `${tr('Code', 'Code')} ${s.code}`].filter(Boolean).join(' · ')}</Txt>
          {Platform.OS === 'web' ? (
            <View style={{ flexDirection: 'row', gap: space.xs, marginTop: 4, flexWrap: 'wrap' }}>
              <Button title={s.logo_url ? tr('Change logo', 'Palitan ang logo') : tr('Upload logo', 'Mag-upload ng logo')} variant="outline" loading={uploading} onPress={upload} />
              {s.logo_url ? <Button title={tr('Remove', 'Alisin')} variant="outline" onPress={() => api<AdminSchool>('/admin/school/logo', { method: 'DELETE' }).then((r) => { setSchool(r.school); q.refetch(); })} /> : null}
            </View>
          ) : (
            <Txt size={text.small} color={colors.muted}>{tr('Upload a logo from a computer.', 'Mag-upload ng logo mula sa computer.')}</Txt>
          )}
        </View>
      </View>

      <Section title={tr('Students join with', 'Paano sumali ang estudyante')} footer={tr('Students also need their ID on your Approved IDs list, so a shared link is safe.', 'Kailangan din ng estudyante na nasa Approved IDs ang ID nila, kaya ligtas ibahagi ang link.')}>
        <ListRow icon="globe" title={tr('Join link', 'Join link')} subtitle={link} />
        <ListRow icon="key" title={tr('School code', 'School code')} value={s.code} />
        <ListRow icon="send" title={tr('Copy announcement for students', 'Kopyahin ang anunsyo para sa estudyante')} onPress={shareLink} last />
      </Section>

      <Section title={tr('Profile', 'Profile')}>
        <ListRow icon="book" title={tr('Name, place and code', 'Pangalan, lugar at code')} subtitle={[s.short_name, s.location].filter(Boolean).join(' · ') || undefined} onPress={() => setSheet('profile')} />
        <ListRow icon="mail" title={tr('Contacts', 'Mga contact')} subtitle={st.support_email ?? tr('Add a help email', 'Magdagdag ng help email')} onPress={() => setSheet('contacts')} last />
      </Section>

      <Section title={tr('Evaluations', 'Mga evaluation')} footer={tr('Teachers only see their ratings and comments once at least this many people answered, so nobody can be identified in a small class.', 'Makikita lang ng guro ang rating at komento kapag sapat na ang sumagot, para walang makilala sa maliit na klase.')}>
        <View style={{ padding: space.md, gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Txt weight="medium" size={text.body}>{tr('Your school year is divided into', 'Hinahati ang school year sa')}</Txt>
            <Segmented
              label={tr('Terms', 'Mga term')}
              value={st.term_label}
              onChange={(v) => quick({ settings: { term_label: v } })}
              options={[
                { key: 'semester', label: tr('Semesters', 'Semestre') },
                { key: 'trimester', label: tr('Trimesters', 'Trimester') },
                { key: 'quarter', label: tr('Quarters', 'Quarter') },
              ]}
            />
          </View>
          <View style={{ gap: space.xs }}>
            <Txt weight="medium" size={text.body}>{tr('Show teachers their results after', 'Ipakita ang resulta sa guro pagkatapos ng')}</Txt>
            <Segmented
              label={tr('Minimum responses', 'Pinakamababang bilang ng sagot')}
              value={String(st.min_responses) as '1' | '3' | '5' | '10'}
              onChange={(v) => quick({ settings: { min_responses: Number(v) } })}
              options={(['1', '3', '5', '10'] as const).map((n) => ({ key: n, label: tr(`${n} answer${n === '1' ? '' : 's'}`, `${n} sagot`) }))}
            />
          </View>
        </View>
        <ListRow icon="users" title={tr('Peer evaluation', 'Peer evaluation')} subtitle={tr('Teachers evaluate colleagues who teach the same subject', 'Ine-evaluate ng guro ang kasamahang may parehong subject')} toggle={{ value: st.peer_evaluation, onChange: (v) => quick({ settings: { peer_evaluation: v } }) }} />
        <ListRow icon="list" title={tr('Rating labels', 'Mga label ng rating')} subtitle={st.scale.join(' · ')} onPress={() => setSheet('scale')} last />
      </Section>

      <Section title={tr('Your data', 'Ang data ninyo')}>
        <ListRow icon="download" title={tr('Export all school data', 'I-export ang lahat ng data')} subtitle={tr('A JSON file of people, classes and evaluations (no evaluator names)', 'JSON file ng mga tao, klase at evaluation (walang pangalan ng nag-evaluate)')} onPress={exportData} />
        <ListRow icon="trash" title={s.deletion_requested_at ? tr('Deletion requested', 'Hiniling nang burahin') : tr('Close our TeachWise account', 'Isara ang TeachWise account namin')} subtitle={s.deletion_requested_at ? tr('TeachWise will contact you to confirm.', 'Makikipag-ugnayan ang TeachWise para kumpirmahin.') : undefined} danger onPress={s.deletion_requested_at ? undefined : () => setSheet('delete')} last />
      </Section>

      <FormSheet
        visible={sheet === 'profile'}
        onClose={() => setSheet(null)}
        title={tr('School profile', 'Profile ng paaralan')}
        fields={profileFields}
        initial={{ name: s.name, short_name: s.short_name, location: s.location, code: s.code }}
        onSubmit={(v) => apply({ name: v.name, short_name: v.short_name, location: v.location, code: String(v.code ?? '').toUpperCase() })}
      />
      <FormSheet
        visible={sheet === 'contacts'}
        onClose={() => setSheet(null)}
        title={tr('Contacts', 'Mga contact')}
        fields={contactFields}
        initial={{ support_email: st.support_email, dpo_email: st.dpo_email, email_domains: s.email_domains.join(', '), contact_name: s.contact_name, contact_email: s.contact_email }}
        onSubmit={(v: FormValues) =>
          apply({
            contact_name: v.contact_name,
            contact_email: v.contact_email,
            settings: {
              support_email: v.support_email,
              dpo_email: v.dpo_email,
              email_domains: String(v.email_domains ?? '').split(/[,\s]+/).map((d) => d.trim().replace(/^@/, '').toLowerCase()).filter(Boolean),
            },
          })
        }
      />
      <FormSheet
        visible={sheet === 'scale'}
        onClose={() => setSheet(null)}
        title={tr('Rating labels', 'Mga label ng rating')}
        note={tr('What each rating means on the evaluation form, from 1 (lowest) to 5 (highest).', 'Ang ibig sabihin ng bawat rating sa form, mula 1 (pinakamababa) hanggang 5 (pinakamataas).')}
        fields={scaleFields}
        initial={Object.fromEntries([1, 2, 3, 4, 5].flatMap((n) => [[`en${n}`, st.scale[n - 1] ?? ''], [`fil${n}`, st.scale_fil[n - 1] ?? '']]))}
        onSubmit={(v) => apply({ settings: { scale: [1, 2, 3, 4, 5].map((n) => v[`en${n}`]), scale_fil: [1, 2, 3, 4, 5].map((n) => v[`fil${n}`]) } })}
      />
      <DeleteSchoolSheet visible={sheet === 'delete'} onClose={() => setSheet(null)} onDone={() => q.refetch()} />
    </Screen>
  );
}

function DeleteSchoolSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string }>('/admin/school/deletion-request', { method: 'POST', body: { password } });
      toast({ title: r.message, tone: 'success' });
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.firstMessage : tr('Couldn’t send the request.', 'Hindi naipadala.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Close our TeachWise account', 'Isara ang TeachWise account')}>
      <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>
        {tr('TeachWise will confirm with you by email, then delete every account, class and evaluation of your school. Export your data first if you need a copy.', 'Kukumpirmahin ng TeachWise sa email, saka buburahin ang lahat ng account, klase at evaluation ng paaralan. I-export muna ang data kung kailangan ng kopya.')}
      </Txt>
      <PasswordField label={tr('Your password', 'Password mo')} value={password} onChangeText={setPassword} state={error ? 'invalid' : 'idle'} message={error ?? undefined} />
      <Button title={tr('Send request', 'Ipadala ang request')} size="lg" loading={busy} disabled={!password} onPress={send} style={{ backgroundColor: colors.danger }} />
    </Sheet>
  );
}
