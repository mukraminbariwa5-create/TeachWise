import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/client';
import { useChangePassword, useRevokeSession, useSessions, useUpdateProfile } from '@/api/hooks';
import { useAuth } from '@/auth/store';
import { Avatar } from '@/components/Avatar';
import { BadgeCard, getBadges, type EarnedBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Field, PasswordField } from '@/components/form/Field';
import { Txt } from '@/components/Txt';
import { confirm, ListRow, Section, Screen, Sheet } from '@/components/ui';
import { WiseMascot } from '@/components/WiseMascot';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { useIsWide } from '@/lib/useLayout';
import { colors, space, text } from '@/theme';

const ago = (iso: string | null) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return tr('Active now', 'Aktibo ngayon');
  if (mins < 60) return tr(`${mins} minutes ago`, `${mins} minuto ang nakalipas`);
  const hours = Math.round(mins / 60);
  if (hours < 24) return tr(`${hours} hours ago`, `${hours} oras ang nakalipas`);
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Your account: who you are, contact details for recovery, password and signed-in devices. */
export default function ProfileScreen() {
  const wide = useIsWide();
  const { user, setUser } = useAuth();
  const scrollHide = useScrollHide();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const [sheet, setSheet] = useState<'contact' | 'password' | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);

  useEffect(() => {
    getBadges().then(setBadges);
  }, []);

  if (!user) return null;
  const meta = [user.id_number, user.section?.label ?? user.department].filter(Boolean).join(' · ');
  const others = (sessions.data?.data ?? []).filter((s) => !s.current).length;

  return (
    <Screen title={tr('Profile', 'Profile')} subtitle={wide ? tr('Your account details and security', 'Mga detalye at seguridad ng account mo') : undefined} {...scrollHide}>
      <View style={{ backgroundColor: colors.frame, borderRadius: 30, padding: wide ? 26 : 20, paddingRight: wide ? 170 : 112, flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 24, minHeight: wide ? 140 : 120 }}>
        <View style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 999 }}>
          <Avatar name={user.name} initials={user.initials} size={wide ? 76 : 62} />
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Txt weight="bold" size={wide ? 24 : 20} color="#FFFFFF" numberOfLines={1}>{user.name}</Txt>
          <Txt size={wide ? 15 : 14} color={colors.onFrameMuted}>{meta}</Txt>
          <Txt size={wide ? 15 : 14} color={colors.onFrameMuted}>{`@${user.username}`}</Txt>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', right: wide ? 18 : 6, bottom: 0 }}>
          <WiseMascot size={wide ? 168 : 124} mood="hello" shadow={false} />
        </View>
      </View>

      <Section title={tr('Details', 'Mga detalye')} footer={tr('Your name, ID and section come from your school’s records. Ask the admin if something is wrong.', 'Galing sa records ng paaralan ang pangalan, ID at section mo. Sabihan ang admin kung may mali.')}>
        <ListRow icon="user" title={tr('Name', 'Pangalan')} value={user.name} />
        <ListRow icon="clipboard" title={tr('ID number', 'ID number')} value={user.id_number} />
        {user.section ? <ListRow icon="book" title={tr('Section', 'Section')} value={user.section.label} /> : user.department ? <ListRow icon="layers" title={tr('Department', 'Departamento')} value={user.department} /> : null}
        <ListRow icon="mail" title={tr('Email', 'Email')} subtitle={tr('For account recovery', 'Para sa pag-recover ng account')} value={user.email ?? tr('Add', 'Idagdag')} onPress={() => setSheet('contact')} />
        <ListRow icon="phone" title={tr('Phone', 'Telepono')} value={user.phone_number ?? tr('Add', 'Idagdag')} onPress={() => setSheet('contact')} last />
      </Section>

      {badges.length > 0 && (
        <Section title={tr('Badges', 'Mga badge')}>
          <View style={{ padding: space.sm, gap: space.sm }}>
            {badges.map((b) => (
              <BadgeCard key={b.periodId} badge={b} compact />
            ))}
          </View>
        </Section>
      )}

      <Section title={tr('Security', 'Seguridad')}>
        <ListRow icon="key" title={tr('Change password', 'Palitan ang password')} subtitle={tr('Other devices will be signed out', 'Masa-sign out ang ibang device')} onPress={() => setSheet('password')} last />
      </Section>

      <Section title={tr('Signed-in devices', 'Mga device na naka-sign in')} footer={tr('Don’t recognise a device? Sign it out and change your password.', 'May hindi kilalang device? I-sign out ito at palitan ang password mo.')}>
        {sessions.isLoading && <ListRow title={tr('Loading…', 'Naglo-load…')} last />}
        {(sessions.data?.data ?? []).map((s, i, all) => (
          <ListRow
            key={s.id}
            icon={/Android|iPhone/.test(s.device) ? 'phone' : 'monitor'}
            title={s.device}
            subtitle={s.current ? tr('This device', 'Itong device') : ago(s.last_used_at)}
            last={i === all.length - 1 && others === 0}
            right={
              s.current ? undefined : (
                <Button
                  title={tr('Sign out', 'I-sign out')}
                  variant="outline"
                  onPress={() => revoke.mutate(s.id, { onSuccess: () => toast({ title: tr('Signed out of that device', 'Na-sign out na ang device'), tone: 'success' }) })}
                />
              )
            }
          />
        ))}
        {others > 0 && (
          <ListRow
            icon="logout"
            title={tr('Sign out of all other devices', 'I-sign out ang lahat ng ibang device')}
            danger
            last
            onPress={async () => {
              if (await confirm({ title: tr('Sign out other devices?', 'I-sign out ang ibang device?'), message: tr(`${others} other device(s) will need to sign in again.`, `Kailangang mag-sign in ulit ng ${others} ibang device.`), confirmLabel: tr('Sign out', 'I-sign out') })) {
                revoke.mutate('others', { onSuccess: (r) => toast({ title: r.message, tone: 'success' }) });
              }
            }}
          />
        )}
      </Section>

      <ContactSheet visible={sheet === 'contact'} onClose={() => setSheet(null)} email={user.email ?? ''} phone={user.phone_number ?? ''} onSaved={(u) => setUser({ ...user, ...u })} />
      <PasswordSheet visible={sheet === 'password'} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function ContactSheet({ visible, onClose, email, phone, onSaved }: { visible: boolean; onClose: () => void; email: string; phone: string; onSaved: (u: { email: string | null; phone_number?: string | null }) => void }) {
  const update = useUpdateProfile();
  const [form, setForm] = useState({ email, phone });
  const err = update.error instanceof ApiError ? update.error.errors : {};
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Contact details', 'Contact details')}>
      <Field label={tr('Email', 'Email')} icon="mail" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="name@school.edu" state={err.email ? 'invalid' : 'idle'} message={err.email?.[0]} hint={tr('Used only to help you get back into your account.', 'Gagamitin lang para matulungan kang makabalik sa account mo.')} />
      <Field label={tr('Phone (optional)', 'Telepono (opsyonal)')} icon="phone" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" autoComplete="tel" placeholder="0917 123 4567" state={err.phone_number ? 'invalid' : 'idle'} message={err.phone_number?.[0]} />
      <Button
        title={tr('Save', 'I-save')}
        size="lg"
        loading={update.isPending}
        onPress={() =>
          update.mutate(
            { email: form.email.trim() || null, phone_number: form.phone.trim() || null },
            {
              onSuccess: (r) => {
                onSaved({ email: r.user.email, phone_number: r.user.phone_number });
                toast({ title: tr('Saved', 'Na-save'), tone: 'success' });
                onClose();
              },
            }
          )
        }
      />
    </Sheet>
  );
}

function PasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const change = useChangePassword();
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
  const err = change.error instanceof ApiError ? change.error.errors : {};
  const mismatch = pw.password_confirmation.length > 0 && pw.password !== pw.password_confirmation;
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Change password', 'Palitan ang password')}>
      <PasswordField label={tr('Current password', 'Kasalukuyang password')} value={pw.current_password} onChangeText={(v) => setPw((p) => ({ ...p, current_password: v }))} autoComplete="password" state={err.current_password ? 'invalid' : 'idle'} message={err.current_password?.[0]} />
      <PasswordField label={tr('New password', 'Bagong password')} value={pw.password} onChangeText={(v) => setPw((p) => ({ ...p, password: v }))} autoComplete="password-new" hint={tr('At least 8 characters', 'Hindi bababa sa 8 character')} state={err.password ? 'invalid' : pw.password.length >= 8 ? 'valid' : 'idle'} message={err.password?.[0]} />
      <PasswordField label={tr('Confirm new password', 'Kumpirmahin ang bagong password')} value={pw.password_confirmation} onChangeText={(v) => setPw((p) => ({ ...p, password_confirmation: v }))} autoComplete="password-new" state={mismatch ? 'invalid' : pw.password_confirmation && !mismatch ? 'valid' : 'idle'} message={mismatch ? tr('Doesn’t match yet', 'Hindi pa tugma') : undefined} />
      <Txt size={text.small} color={colors.muted} style={{ lineHeight: 18 }}>{tr('You’ll stay signed in here. Other devices will need the new password.', 'Mananatili kang naka-sign in dito. Kakailanganin ng ibang device ang bagong password.')}</Txt>
      <Button
        title={tr('Update password', 'I-update ang password')}
        size="lg"
        loading={change.isPending}
        disabled={!pw.current_password || pw.password.length < 8 || mismatch}
        onPress={() =>
          change.mutate(pw, {
            onSuccess: () => {
              setPw({ current_password: '', password: '', password_confirmation: '' });
              toast({ title: tr('Password updated', 'Napalitan ang password'), body: tr('Other devices were signed out.', 'Na-sign out ang ibang device.'), tone: 'success' });
              onClose();
            },
          })
        }
        style={{ marginTop: space.xxs }}
      />
    </Sheet>
  );
}
