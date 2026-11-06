import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { tr } from '@/lib/i18n';
import { colors } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Full-height phone navigation, anchored to the same edge as the desktop rail. */
export function NavigationDrawer({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const panelWidth = Math.min(320, width - 40);
  useEffect(() => {
    progress.setValue(reduced ? 1 : 0);
    if (!visible || reduced) return;
    const animation = Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [visible, reduced, progress]);

  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Dismiss navigation', 'Isara ang navigation')} onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(5,5,40,0.45)' }} />
      <Animated.View testID="mobile-navigation-drawer" accessibilityViewIsModal style={{ width: panelWidth, height: '100%', backgroundColor: colors.card, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12, borderTopRightRadius: 24, borderBottomRightRadius: 24, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 16 }}>
          <Txt accessibilityRole="header" weight="bold" size={21} style={{ flex: 1 }}>{tr('Navigation', 'Navigation')}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surface }}><Icon name="close" size={18} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 16 }}>{children}</ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
