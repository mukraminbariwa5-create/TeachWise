import { View } from 'react-native';
import { tr } from '@/lib/i18n';
import { colors } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Pending (orange) or Evaluated (green with a tick). Never colour alone: always a word too. */
export function StatusChip({ status, compact }: { status: 'pending' | 'completed'; compact?: boolean }) {
  const done = status === 'completed';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: compact ? 10 : 12,
        paddingVertical: compact ? 4 : 6,
        borderRadius: 999,
        backgroundColor: done ? colors.successBg : colors.pendingBg,
      }}
    >
      {done && <Icon name="check" size={compact ? 12 : 14} color={colors.successFg} strokeWidth={2.6} />}
      <Txt weight="semibold" size={compact ? 12 : 13} color={done ? colors.successFg : colors.pendingFg}>
        {done ? tr('Evaluated', 'Tapos na') : tr('Pending', 'Hindi pa')}
      </Txt>
    </View>
  );
}
