import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/store';
import { useWiseHistory } from '@/api/hooks';
import { tr } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { dateTime } from '@/lib/format';
import { colors } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';

interface Props {
  visible: boolean;
  busy: boolean;
  conversationId?: number;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  error?: string;
  embedded?: boolean;
}

/** Drawer shared by full-screen, floating and docked Wise conversations. */
export function WiseConversationMenu({ visible, busy, conversationId, onClose, onNew, onSelect, onDelete, error, embedded = false }: Props) {
  const history = useWiseHistory(visible || embedded);
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const conversations = [...new Map((history.data?.pages.flatMap((page) => page.data) ?? []).map((conversation) => [conversation.id, conversation])).values()];
  const settingsHref = user?.role === 'teacher' ? '/teacher/settings' : user?.role === 'admin' ? '/admin/settings' : '/student/settings';

  const panel = (
        <View testID={embedded ? 'wise-history-sidebar' : 'wise-history-drawer'} accessibilityViewIsModal={!embedded} style={{ width: embedded ? 256 : Math.min(296, width * 0.86), flexShrink: 0, backgroundColor: embedded ? colors.surface : colors.card, borderRightWidth: embedded ? 1 : 0, borderColor: colors.borderSoft, paddingTop: embedded ? 16 : insets.top + 14, paddingBottom: embedded ? 12 : insets.bottom + 12, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6, minHeight: 36 }}>
            <Txt weight="semibold" size={16} style={{ flex: 1 }}>{tr('Conversations', 'Mga usapan')}</Txt>
            {!embedded && <Pressable accessibilityRole="button" accessibilityLabel={tr('Close conversation menu', 'Isara ang menu ng usapan')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} /></Pressable>}
          </View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onNew} style={({ hovered }) => ({ minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: hovered ? colors.brandSoft : colors.card, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, opacity: busy ? 0.5 : 1 })}>
            <Icon name="edit" size={18} color={colors.text} /><Txt weight="medium" size={13}>{tr('New conversation', 'Bagong usapan')}</Txt>
          </Pressable>
          {busy && <Txt size={13} color={colors.muted} style={{ marginTop: 10 }}>{tr('Wise is finishing a request…', 'Tinatapos pa ni Wise ang request…')}</Txt>}
          {!!error && <Txt size={14} color={colors.danger} style={{ marginTop: 10 }}>{error}</Txt>}
          <Txt weight="semibold" size={12} color={colors.muted} style={{ marginTop: 18, marginBottom: 8 }}>{tr('History', 'Kasaysayan')}</Txt>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }} keyboardShouldPersistTaps="handled">
            {history.isLoading && <ActivityIndicator color={colors.accent} />}
            {!history.isLoading && !history.error && conversations.length === 0 && <Txt size={14} color={colors.muted}>{tr('Your conversations will appear here.', 'Lalabas dito ang mga usapan mo.')}</Txt>}
            {conversations.map((conversation) => (
              <Pressable key={conversation.id} testID={`wise-conversation-${conversation.id}`} accessibilityRole="button" accessibilityLabel={`${tr('Continue conversation', 'Ipagpatuloy ang usapan')}: ${conversation.title}`} accessibilityState={{ selected: conversation.id === conversationId, disabled: busy }} disabled={busy} onPress={() => onSelect(conversation.id)} style={{ minHeight: 52, padding: 10, borderRadius: 10, backgroundColor: conversation.id === conversationId ? colors.brandSoft : 'transparent', gap: 4, opacity: busy ? 0.6 : 1 }}>
                <Txt numberOfLines={1} weight="medium" size={13}>{conversation.title}</Txt>
                <Txt numberOfLines={1} size={10} color={colors.muted}>{dateTime(conversation.updated_at)} · {conversation.messages_count} {tr('messages', 'mensahe')}</Txt>
              </Pressable>
            ))}
            {!!history.error && <Pressable accessibilityRole="button" onPress={() => history.refetch()} style={{ paddingVertical: 14 }}><Txt size={14} color={colors.danger}>{tr('Could not load history. Try again.', 'Hindi ma-load ang kasaysayan. Subukan ulit.')}</Txt></Pressable>}
            {history.hasNextPage && <Pressable accessibilityRole="button" disabled={history.isFetchingNextPage} onPress={() => history.fetchNextPage()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Txt size={14} color={colors.accent}>{history.isFetchingNextPage ? tr('Loading…', 'Naglo-load…') : tr('More conversations', 'Iba pang usapan')}</Txt></Pressable>}
          </ScrollView>
          <View style={{ borderTopWidth: 1, borderColor: colors.borderSoft, paddingTop: 12, gap: 4 }}>
            <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push(settingsHref); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 }}><Icon name="settings" size={18} /><Txt size={13}>{tr('Settings', 'Settings')}</Txt></Pressable>
            {conversationId !== undefined && <Pressable accessibilityRole="button" disabled={busy} onPress={() => onDelete(conversationId)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, opacity: busy ? 0.5 : 1 }}><Icon name="trash" size={18} color={colors.danger} /><Txt size={12} color={colors.danger}>{tr('Delete this conversation', 'Burahin ang usapang ito')}</Txt></Pressable>}
          </View>
        </View>
  );
  if (embedded) return panel;

  return (
    <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(5,5,40,0.4)' }}>
        {panel}
        <Pressable accessibilityLabel={tr('Close conversation menu', 'Isara ang menu ng usapan')} onPress={onClose} style={{ flex: 1 }} />
      </View>
    </Modal>
  );
}
