import { View } from 'react-native';
import { WiseChat } from '@/components/WiseChat';
import { tr } from '@/lib/i18n';

export default function AdminWise() {
  return (
    <View style={{ flex: 1 }}>
      <WiseChat subtitle={tr('Admin helper', 'Katulong ng admin')} placeholder={tr('Ask about running evaluations…', 'Magtanong tungkol sa pagpapatakbo ng evaluation…')} />
    </View>
  );
}
