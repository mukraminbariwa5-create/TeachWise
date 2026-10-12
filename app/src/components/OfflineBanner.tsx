import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { tr } from '@/lib/i18n';
import { useOnline } from '@/lib/online';
import { colors } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { WiseHead } from './WiseMascot';

const native = Platform.OS !== 'web';

/**
 * A friendly bar when the server can't be reached. Pages keep what they already loaded;
 * evaluation answers stay saved as a draft. Shows "Back online" for a moment when it returns.
 */
export function OfflineBanner() {
  const online = useOnline((s) => s.online);
  const qc = useQueryClient();
  const [back, setBack] = useState(false);
  const wasOffline = useRef(false);
  const h = useRef(new Animated.Value(online ? 0 : 1)).current;

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      setBack(true);
      qc.invalidateQueries();
      const t = setTimeout(() => setBack(false), 2500);
      return () => clearTimeout(t);
    }
  }, [online, qc]);

  const visible = !online || back;
  useEffect(() => {
    Animated.timing(h, { toValue: visible ? 1 : 0, duration: 260, useNativeDriver: native }).start();
  }, [visible, h]);

  if (!visible) return null;

  return (
    <Animated.View accessibilityLiveRegion="polite" style={{ opacity: h, transform: [{ translateY: h.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: back ? colors.successFg : colors.urgentCard }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <WiseHead size={22} mood={back ? 'laugh' : 'tired'} />
        </View>
        <Txt weight="semibold" size={14} color="#FFFFFF" style={{ flex: 1 }}>
          {back
            ? tr('Back online! Refreshing…', 'Online na ulit! Nire-refresh…')
            : tr('You’re offline. Your answers are saved and will be ready when you reconnect.', 'Offline ka. Naka-save ang mga sagot mo at handa kapag naka-connect ka ulit.')}
        </Txt>
        {!back && (
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Try again', 'Subukan ulit')} onPress={() => qc.invalidateQueries()} style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="refresh" size={14} color="#FFFFFF" strokeWidth={2.2} />
            <Txt weight="semibold" size={13} color="#FFFFFF">{tr('Retry', 'Ulitin')}</Txt>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
