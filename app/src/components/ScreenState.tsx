import { ActivityIndicator, View } from 'react-native';
import { tr } from '@/lib/i18n';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { Button } from './Button';
import { Txt } from './Txt';
import { WiseMascot } from './WiseMascot';

/** Loading spinner or error message with a retry button. */
export function ScreenState({ loading, error, onRetry }: { loading?: boolean; error?: unknown; onRetry?: () => void }) {
  return (
    <View style={{ flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} />
      ) : (
        <>
          <WiseMascot size={150} mood="sad" />
          <Txt weight="semibold" size={20}>{tr('That didn’t load', 'Hindi nag-load')}</Txt>
          <Txt size={16} color={colors.textSoft} style={{ textAlign: 'center', maxWidth: 420 }}>
            {error instanceof ApiError ? error.firstMessage : tr('Something went wrong while loading this page.', 'May nangyaring mali habang nilo-load ang page na ito.')}
          </Txt>
          {onRetry && <Button title={tr('Try again', 'Subukan ulit')} variant="outline" onPress={onRetry} />}
        </>
      )}
    </View>
  );
}
