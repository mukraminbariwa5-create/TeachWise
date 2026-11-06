import { View } from 'react-native';
import { WiseChat } from '@/components/WiseChat';
import { tr } from '@/lib/i18n';

export default function StudentWise() {

  return (
    <View style={{ flex: 1, width: '100%', minWidth: 0 }}>
      <WiseChat
        subtitle={tr('Guidance assistant', 'Katulong sa paggabay')}
        placeholder={tr("What's on your mind?", 'Ano ang nasa isip mo?')}
      />
    </View>
  );
}
