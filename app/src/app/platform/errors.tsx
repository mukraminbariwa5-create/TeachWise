import { useState } from 'react';
import { View } from 'react-native';
import { usePlatformErrors, type PlatformError } from '@/api/platform';
import { DataList } from '@/components/admin/DataList';
import { Txt } from '@/components/Txt';
import { Screen, Sheet } from '@/components/ui';
import { ago, dateTime } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { colors, fonts, space, text } from '@/theme';

/** Crashes reported by the app from every school, newest first. */
export default function PlatformErrors() {
  const q = usePlatformErrors();
  const [open, setOpen] = useState<PlatformError | null>(null);
  const scrollHide = useScrollHide();
  return (
    <Screen title={tr('App health', 'Kalusugan ng app')} subtitle={tr('Errors the app reported, from every school', 'Mga error na iniulat ng app, mula sa lahat ng paaralan')} maxWidth={1100} {...scrollHide}>
      <DataList
        rows={q.data?.data ?? []}
        keyOf={(e) => e.id}
        loading={q.isLoading}
        onPress={setOpen}
        empty={{ title: tr('No errors reported', 'Walang naiulat na error'), mood: 'proud' }}
        columns={[
          { label: tr('Error', 'Error'), flex: 3, render: (e) => e.message },
          { label: tr('School', 'Paaralan'), flex: 1.5, render: (e) => e.school?.name ?? tr('Signed out', 'Naka-sign out'), phone: true },
          { label: tr('Device', 'Device'), render: (e) => [e.platform, e.app_version && `v${e.app_version}`].filter(Boolean).join(' · ') || '—' },
          { label: tr('When', 'Kailan'), render: (e) => ago(e.created_at), phone: true },
        ]}
      />
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={tr('Error details', 'Detalye ng error')} maxWidth={720}>
        {open && (
          <>
            <Txt weight="semibold" size={text.bodyLg} selectable>{open.message}</Txt>
            <Txt size={text.small} color={colors.muted}>{[dateTime(open.created_at), open.school?.name, open.platform, open.app_version && `v${open.app_version}`, open.screen].filter(Boolean).join(' · ')}</Txt>
            {open.stack ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: space.md }}>
                <Txt size={12} color={colors.textSoft} selectable style={{ fontFamily: fonts.regular, lineHeight: 18 }}>{open.stack}</Txt>
              </View>
            ) : null}
          </>
        )}
      </Sheet>
    </Screen>
  );
}
