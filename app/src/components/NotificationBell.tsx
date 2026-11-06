import { useEffect, useRef } from 'react';
import { tr } from '@/lib/i18n';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useMarkAllRead, useNotifications } from '@/api/hooks';
import { ago, shortDate } from '@/lib/format';
import { getPref, setPref } from '@/lib/prefs';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { toast, useUI } from '@/lib/ui';
import { colors, shadowStyle } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { WiseMascot } from './WiseMascot';

/** The bell (computer header and phone top bar). Opens the shared notifications sheet. */
export function NotificationBell({ color, dotBorder, size = 26 }: { color?: string; dotBorder?: string; size?: number }) {
  color = color ?? colors.text;
  dotBorder = dotBorder ?? colors.surface;
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? tr(`Notifications, ${unread} new`, `Mga notification, ${unread} bago`) : tr('Notifications', 'Mga notification')}
      onPress={() => useUI.getState().setNotificationsOpen(true)}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="bell" size={size} color={color} strokeWidth={1.7} />
      {unread > 0 && <View style={{ position: 'absolute', top: 7, right: 9, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.alert, borderWidth: 2, borderColor: dotBorder }} />}
    </Pressable>
  );
}

/** The notifications list. Rendered once by the Shell; anything can open it through useUI. */
export function NotificationsSheet() {
  const reduced = useReducedMotion();
  const open = useUI((s) => s.notificationsOpen);
  const close = () => useUI.getState().setNotificationsOpen(false);
  const { data } = useNotifications();
  const markAll = useMarkAllRead();
  const unread = data?.unread ?? 0;
  const items = data?.data ?? [];

  return (
    <Modal visible={open} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={close}>
      <Pressable accessibilityLabel={tr('Close notifications', 'Isara ang notifications')} onPress={close} style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Pressable onPress={() => {}} style={[{ width: '100%', maxWidth: 440, maxHeight: '80%', backgroundColor: colors.card, borderRadius: 20, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.borderSoft }, shadowStyle('lift')]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Txt weight="semibold" size={22} accessibilityRole="header" style={{ flex: 1 }}>{tr('Notifications', 'Mga notification')}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>

              <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Isara')} onPress={close} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
                <Icon name="close" size={16} color={colors.textSoft} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
          <FlatList
            data={items}
            keyExtractor={(n) => String(n.id)}
            contentContainerStyle={{ gap: 10 }}
            initialNumToRender={10}
            ListHeaderComponent={unread > 0 ? <Pressable accessibilityRole="button" disabled={markAll.isPending} onPress={() => markAll.mutate()} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 6 }}><Txt weight="semibold" size={14} color={colors.accent}>{markAll.isPending ? tr('Updating…', 'Ina-update…') : tr('Mark all as read', 'Markahang nabasa lahat')}</Txt></Pressable> : null}
            ListFooterComponent={markAll.error ? <Txt accessibilityLiveRegion="polite" size={14} color={colors.danger}>{tr('Could not mark notifications as read. Try again.', 'Hindi mamarkahang nabasa. Subukan ulit.')}</Txt> : null}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
                <WiseMascot size={120} mood="proud" />
                <Txt weight="semibold" size={17}>{tr('You’re all caught up', 'Wala ka nang hindi nababasa')}</Txt>
                <Txt size={14} color={colors.muted} style={{ textAlign: 'center' }}>{tr('Professor Wise will tell you when something new happens.', 'Sasabihan ka ni Professor Wise kapag may bago.')}</Txt>
              </View>
            }
            renderItem={({ item: n }) => (
              <View style={{ backgroundColor: n.read_at ? colors.surface : colors.chip, borderRadius: 18, padding: 14, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {!n.read_at && <Txt weight="semibold" size={11} color={colors.accent}>{tr('Unread', 'Hindi pa nabasa')}</Txt>}
                  <Txt weight="semibold" size={15} style={{ flex: 1 }}>{n.title}</Txt>
                </View>
                <Txt size={14} color={colors.textSoft} style={{ lineHeight: 20 }}>{n.message}</Txt>
                <Txt size={13} color={colors.muted}>{ago(n.created_at)}</Txt>
              </View>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * New unread notifications pop up as a toast from Professor Wise, once each.
 * On a first visit only the newest one pops up, so nobody gets a pile of toasts.
 */
export function useNotificationToasts() {
  const { data } = useNotifications();
  const busy = useRef(false);

  useEffect(() => {
    const unread = (data?.data ?? []).filter((n) => !n.read_at);
    if (!unread.length || busy.current) return;
    busy.current = true;
    getPref('seenNotifs')
      .then(async (raw) => {
        const seen = new Set((raw ?? '').split(',').filter(Boolean));
        const fresh = unread.filter((n) => !seen.has(String(n.id)));
        fresh.slice(0, raw === null ? 1 : 2).forEach((n) => toast({ title: n.title, body: n.message, mood: 'idea' }));
        const all = [...seen, ...unread.map((n) => String(n.id))].slice(-100);
        await setPref('seenNotifs', all.join(','));
      })
      .finally(() => {
        busy.current = false;
      });
  }, [data]);
}
