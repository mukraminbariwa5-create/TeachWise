import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayoutSize } from '@/lib/useLayout';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useUI, type Toast } from '@/lib/ui';
import { colors, shadowStyle } from '@/theme';
import { Txt } from './Txt';
import { WiseMascot } from './WiseMascot';

const native = Platform.OS !== 'web';

/** Where toasts appear: top centre on phones, top right on computers. Mounted once in the root layout. */
export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const insets = useSafeAreaInsets();
  const phone = useLayoutSize() === 'phone';
  if (!toasts.length) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + (phone ? 10 : 24), left: phone ? 12 : undefined, right: phone ? 12 : 28, zIndex: 2000, gap: 10, alignItems: phone ? 'stretch' : 'flex-end' }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} phone={phone} />
      ))}
    </View>
  );
}

function ToastCard({ toast, phone }: { toast: Toast; phone: boolean }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const drop = () =>
    Animated.timing(v, { toValue: 0, duration: reduced ? 0 : 200, useNativeDriver: native }).start(() => useUI.getState().dropToast(toast.id));

  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduced ? 0 : 320, easing: Easing.out(Easing.back(1.3)), useNativeDriver: native }).start();
    const t = setTimeout(drop, 4800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const success = toast.tone === 'success';
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${toast.title}. ${toast.body ?? ''}`}
        onPress={drop}
        style={[
          { width: phone ? undefined : 380, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 22, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, borderWidth: 1, borderColor: success ? colors.successFg : colors.borderSoft },
          shadowStyle('lift'),
        ]}
      >
        <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: success ? colors.successBg : colors.brandSoft, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
          <WiseMascot size={56} mood={toast.mood ?? (success ? 'proud' : 'idea')} float={false} shadow={false} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt weight="semibold" size={15} numberOfLines={1}>{toast.title}</Txt>
          {toast.body ? <Txt size={13} color={colors.textSoft} numberOfLines={2} style={{ lineHeight: 18 }}>{toast.body}</Txt> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
