import { View } from 'react-native';
import { tr } from '@/lib/i18n';
import { useRouter } from 'expo-router';
import { homeFor, useAuth } from '@/auth/store';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Txt } from '@/components/Txt';
import { WiseMascot } from '@/components/WiseMascot';
import { colors } from '@/theme';

/** Any address that doesn't exist. */
export default function NotFound() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  return (
    <View style={{ flex: 1, backgroundColor: colors.frame, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 }}>
      <View style={{ position: 'absolute', top: 32, left: 32 }}>
        <Logo size={44} onDark />
      </View>
      <WiseMascot size={190} mood="think" />
      <Txt weight="bold" size={30} color="#FFFFFF" style={{ textAlign: 'center' }}>{tr('Hmm, this page doesn’t exist', 'Hmm, walang ganitong page')}</Txt>
      <Txt size={16} color={colors.onFrameMuted} style={{ textAlign: 'center', maxWidth: 380 }}>{tr('Professor Wise looked everywhere. Let’s get you back on track.', 'Hinanap ni Professor Wise kahit saan. Ibalik ka natin.')}</Txt>
      <Button title={tr('Go home', 'Bumalik sa home')} size="lg" variant="light" onPress={() => router.replace(user ? homeFor(user.role) : '/login')} />
    </View>
  );
}
