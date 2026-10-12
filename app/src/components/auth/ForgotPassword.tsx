import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { api, ApiError } from '@/api/client';
import { tr } from '@/lib/i18n';
import { usePickedSchool } from '@/lib/school';
import { useLayoutSize } from '@/lib/useLayout';
import { colors, shadowStyle } from '@/theme';
import { Button } from '../Button';
import { Field } from '../form/Field';
import { Icon } from '../Icon';
import { RichText } from '../RichText';
import { Txt } from '../Txt';
import { WiseMascot } from '../WiseMascot';

/**
 * "Forgot password?" The request goes to the admin, who gives back a temporary password.
 * (A school system: students talk to the admin instead of getting reset emails.)
 */
export function ForgotPassword({ visible, initialLogin, onClose }: { visible: boolean; initialLogin: string; onClose: () => void }) {
  const phone = useLayoutSize() === 'phone';
  const [login, setLogin] = useState(initialLogin);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (visible) {
      setLogin(initialLogin);
      setSent(null);
      setError(null);
    }
  }, [visible, initialLogin]);

  const send = async () => {
    if (!login.trim()) {
      setError(tr('Enter your username or student ID.', 'Ilagay ang username o student ID mo.'));
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string }>('/auth/password-requests', { method: 'POST', body: { login: login.trim(), note: note.trim() || undefined, school_id: usePickedSchool.getState().school?.id }, token: null });
      setSent(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstMessage : tr('Could not send the request. Please try again.', 'Hindi naipadala ang request. Pakisubukan ulit.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType={phone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.45)', justifyContent: phone ? 'flex-end' : 'center', alignItems: 'center', padding: phone ? 0 : 20 }}>
        <Pressable onPress={() => {}} style={[{ width: '100%', maxWidth: phone ? undefined : 460, backgroundColor: colors.card, borderRadius: 28, borderBottomLeftRadius: phone ? 0 : 28, borderBottomRightRadius: phone ? 0 : 28, padding: 22, gap: 16 }, shadowStyle('lift')]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <WiseMascot size={84} mood={sent ? 'proud' : 'please'} float={false} shadow={false} />
            <View style={{ flex: 1, paddingBottom: 6 }}>
              <Txt weight="bold" size={21} accessibilityRole="header">{sent ? tr('Request sent', 'Naipadala na') : tr('Forgot your password?', 'Nakalimutan ang password?')}</Txt>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={16} color={colors.textSoft} strokeWidth={2.2} />
            </Pressable>
          </View>

          {sent ? (
            <>
              <RichText text={sent} size={15} color={colors.textSoft} style={{ lineHeight: 22 }} />
              <View style={{ backgroundColor: colors.brandSoft, borderRadius: 16, padding: 14, gap: 6 }}>
                <Txt weight="semibold" size={14} color={colors.accent}>{tr('What happens next', 'Ano ang susunod')}</Txt>
                <Txt size={14} color={colors.textSoft} style={{ lineHeight: 20 }}>
                  {tr(
                    '1. The admin sees your request.\n2. They give you a temporary password (in person or by message).\n3. Sign in with it, then change it in Profile.',
                    '1. Makikita ng admin ang request mo.\n2. Bibigyan ka nila ng pansamantalang password (personal o sa mensahe).\n3. Mag-sign in gamit iyon, tapos palitan sa Profile.'
                  )}
                </Txt>
              </View>
              <Button title={tr('Back to sign in', 'Bumalik sa sign in')} size="lg" onPress={onClose} />
            </>
          ) : (
            <>
              <Txt size={15} color={colors.textSoft} style={{ lineHeight: 22 }}>
                {tr('No worries. Tell us who you are and the admin will give you a temporary password.', 'Walang problema. Sabihin kung sino ka at bibigyan ka ng admin ng pansamantalang password.')}
              </Txt>
              <Field label={tr('Username or student ID', 'Username o student ID')} icon="user" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} placeholder={tr('Username or ID number', 'Username o ID number')} shake={shake} state={error ? 'invalid' : 'idle'} message={error ?? undefined} returnKeyType="next" />
              <Field label={tr('Note for the admin (optional)', 'Mensahe sa admin (opsyonal)')} icon="chat" value={note} onChangeText={setNote} max={255} placeholder={tr('e.g. I’m in BSIT 4-A', 'hal. Taga-BSIT 4-A ako')} onSubmitEditing={send} returnKeyType="send" />
              <Button title={tr('Send request', 'Ipadala ang request')} size="lg" onPress={send} loading={busy} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
