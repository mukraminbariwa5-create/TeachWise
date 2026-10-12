import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useAppInfo } from '@/api/hooks';
import { useAuth } from '@/auth/store';
import { APP_VERSION, compareVersions } from '@/lib/appInfo';
import { changelog } from '@/lib/changelog';
import { tr } from '@/lib/i18n';
import { getPref, setPref } from '@/lib/prefs';
import { colors, space, text } from '@/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { Sheet } from './ui';
import { WiseMascot } from './WiseMascot';

/**
 * Phones older than the minimum version the server supports must update first
 * (the web app is always the latest, so it never sees this).
 */
export function UpdateGate() {
  const info = useAppInfo();
  if (Platform.OS === 'web' || !info.data || compareVersions(APP_VERSION, info.data.min_version) >= 0) return null;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 3000, backgroundColor: colors.frame, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
      <WiseMascot size={170} mood="please" />
      <Txt weight="bold" size={text.h2} color="#FFFFFF" style={{ textAlign: 'center' }}>{tr('Time for an update', 'Kailangang mag-update')}</Txt>
      <Txt size={text.bodyLg} color={colors.onFrameMuted} style={{ textAlign: 'center', maxWidth: 360, lineHeight: 23 }}>
        {tr(`This version (${APP_VERSION}) is no longer supported. Update TeachWise to keep evaluating.`, `Hindi na suportado ang bersyong ito (${APP_VERSION}). I-update ang TeachWise para makapagpatuloy.`)}
      </Txt>
      <Button title={tr('Update now', 'Mag-update na')} variant="light" size="lg" onPress={() => Linking.openURL(info.data!.store_url).catch(() => {})} />
    </View>
  );
}

/** After an update, a short "What's new" sheet (once per version, only for people who used an older one). */
export function WhatsNew() {
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user) return;
    getPref('lastVersion').then(async (last) => {
      await setPref('lastVersion', APP_VERSION);
      if (!last || last === APP_VERSION) return;
      const notes = changelog()[APP_VERSION];
      if (notes?.length) setItems(notes);
    });
  }, [user]);

  return (
    <Sheet visible={!!items} onClose={() => setItems(null)} title={tr(`What’s new in ${APP_VERSION}`, `Ano ang bago sa ${APP_VERSION}`)}>
      <View style={{ alignItems: 'center' }}>
        <WiseMascot size={120} mood="idea" />
      </View>
      {(items ?? []).map((it) => (
        <View key={it} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Icon name="check" size={13} color={colors.successFg} strokeWidth={3} />
          </View>
          <Txt size={text.bodyLg} color={colors.textSoft} style={{ flex: 1, lineHeight: 23 }}>{it}</Txt>
        </View>
      ))}
      <Button title={tr('Got it', 'Sige')} size="lg" onPress={() => setItems(null)} />
    </Sheet>
  );
}
