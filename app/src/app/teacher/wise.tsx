import { View } from 'react-native';
import { WiseChat } from '@/components/WiseChat';
import { tr } from '@/lib/i18n';

export default function TeacherWise() {
  return (
    <View style={{ flex: 1 }}>
      <WiseChat subtitle={tr('Teaching coach', 'Coach sa pagtuturo')} placeholder={tr('Ask about your results…', 'Magtanong tungkol sa resulta mo…')} />
    </View>
  );
}
