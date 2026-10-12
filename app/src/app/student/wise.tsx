import { View } from 'react-native';
import { WiseChat } from '@/components/WiseChat';
import { tr } from '@/lib/i18n';

export default function StudentWise() {

  return (
    <View style={{ flex: 1 }}>
      <WiseChat
        subtitle={tr('Evaluation helper', 'Katulong sa evaluation')}
        placeholder={tr('Ask about evaluations…', 'Magtanong tungkol sa evaluation…')}
      />
    </View>
  );
}
