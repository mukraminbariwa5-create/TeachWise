import { useState } from 'react';
import { Modal, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/store';
import { tr } from '@/lib/i18n';
import { colors, shadowStyle } from '@/theme';
import { Button } from './Button';
import { PasswordField } from './form/Field';
import { Txt } from './Txt';
import { WiseMascot } from './WiseMascot';

/**
 * When the session runs out while the app is open, this small sheet asks for the password
 * again over the current page, so nothing is lost. "Use another account" signs out instead.
 */
export function SessionSheet() {
  const { user, expired, login, logout } = useAuth();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  if (!user || !expired) return null;
  const first = user.name.replace(/^(prof|dr|mr|ms|mrs|engr)\.?\s+/i, '').split(' ')[0];

  const submit = async () => {
    if (!password) {
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(user.username, password);
      setPassword('');
      qc.invalidateQueries();
    } catch (e) {
      setShake((n) => n + 1);
      setError(e instanceof ApiError ? e.firstMessage : tr('Could not sign in. Please try again.', 'Hindi makapag-sign in. Pakisubukan ulit.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={[{ width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: 28, padding: 22, gap: 14 }, shadowStyle('lift')]}>
          <View style={{ alignItems: 'center', marginTop: -70 }}>
            <WiseMascot size={120} mood="please" />
          </View>
          <Txt weight="bold" size={21} style={{ textAlign: 'center' }} accessibilityRole="header">{tr(`Still there, ${first}?`, `Nandiyan ka pa ba, ${first}?`)}</Txt>
          <Txt size={15} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 22 }}>
            {tr('For your security you were signed out. Enter your password to pick up right where you left off.', 'Para sa seguridad mo, na-sign out ka. Ilagay ang password mo para ituloy kung saan ka tumigil.')}
          </Txt>
          <PasswordField label={tr('Password', 'Password')} value={password} onChangeText={setPassword} autoFocus onSubmitEditing={submit} returnKeyType="go" state={error ? 'invalid' : 'idle'} message={error ?? undefined} shake={shake} />
          <Button title={tr('Continue', 'Magpatuloy')} size="lg" onPress={submit} loading={busy} />
          <Button title={tr('Use another account', 'Ibang account')} variant="outline" onPress={logout} />
        </View>
      </View>
    </Modal>
  );
}
