import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { useIsMutating, useMutationState } from '@tanstack/react-query';
import { tr } from '@/lib/i18n';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ApiError } from '@/api/client';
import { useDeleteWiseConversation, useEarlierWiseMessages, useNewWiseConversation, useSendWise, useWise, type WiseSendInput } from '@/api/hooks';
import { useAuth } from '@/auth/store';
import { useWiseConversations } from '@/lib/wiseConversations';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useUiScale } from '@/lib/uiScale';
import { confirm } from './ui';
import { colors, fonts } from '@/theme';
import { FadeIn } from './Motion';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';
import { WiseHead, WiseMascot } from './WiseMascot';
import { WiseConversationMenu } from './WiseConversationMenu';
import { RichText } from './RichText';

interface Props {
  subtitle: string;
  placeholder?: string;
  onClose?: () => void;
  onBack?: () => void;
}

/** Professor Wise conversation: the floating panel on computers and the full screen on phones. */
export function WiseChat({ subtitle, placeholder, onClose, onBack }: Props) {
  placeholder = placeholder ?? tr('Ask Professor Wise…', 'Magtanong kay Professor Wise…');
  const wise = useWise();
  const send = useSendWise();
  const createConversation = useNewWiseConversation();
  const deleteConversation = useDeleteWiseConversation();
  const earlier = useEarlierWiseMessages();
  const userId = useAuth((s) => s.user?.id);
  const selected = useWiseConversations((s) => userId ? s.active[userId] : undefined);
  const conversationId = selected ?? wise.data?.conversation?.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const inlineHistory = !onClose && windowWidth >= 1000 && workspaceWidth >= 760;
  const { text, setText, failedMessage, setFailedMessage } = useTopicDraft(`${userId}:${conversationId ?? 'latest'}`);
  const [slowReply, setSlowReply] = useState(false);
  const [inputHeight, setInputHeight] = useState(48);
  const submitting = useRef(false);
  const busy = useIsMutating({ mutationKey: ['wise'] }) > 0;
  const activeSends = useMutationState({
    filters: { mutationKey: ['wise', 'send'], status: 'pending' },
    select: (mutation) => mutation.state.variables as WiseSendInput,
  });
  const pendingMessage = activeSends.filter((input) => input.conversationId === conversationId).slice(-1)[0];
  const waiting = !!pendingMessage;
  const reduced = useReducedMotion();
  const { desktop } = useUiScale();
  const scroll = useRef<ScrollView>(null);
  const suppressScroll = useRef(false);

  const messages = wise.data?.messages ?? [];

  useEffect(() => {
    if (suppressScroll.current) { suppressScroll.current = false; return; }
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: !reduced }), 60);
    return () => clearTimeout(t);
  }, [messages.length, waiting, reduced, conversationId]);

  const resetSend = send.reset;
  const resetEarlier = earlier.reset;
  useEffect(() => {
    if (!submitting.current) {
      resetSend();
      resetEarlier();
    }
  }, [conversationId, resetSend, resetEarlier]);

  useEffect(() => {
    setSlowReply(false);
    if (!waiting) return;
    const timer = setTimeout(() => setSlowReply(true), 8000);
    return () => clearTimeout(timer);
  }, [waiting]);

  const submit = (value: string, retryId?: string) => {
    const message = value.trim();
    if (!message || busy || submitting.current) return;
    submitting.current = true;
    const requestId = retryId ?? (failedMessage?.message === message ? failedMessage.requestId : `wise-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const input = { message, requestId, conversationId };
    setText((current) => current.trim() === message ? '' : current);
    setFailedMessage(null);
    send.mutate(input, {
      onError: () => { setFailedMessage(input); setText((current) => current || message); },
      onSettled: () => { submitting.current = false; },
    });
  };

  const error = send.error ?? wise.error ?? earlier.error;
  const menuError = createConversation.error ?? deleteConversation.error;
  const menu = <WiseConversationMenu
    visible={inlineHistory || menuOpen} embedded={inlineHistory} busy={busy} conversationId={conversationId}
    error={menuError ? menuError instanceof ApiError ? menuError.firstMessage : tr('That did not work. Please try again.', 'Hindi natuloy. Subukan ulit.') : undefined}
    onClose={() => setMenuOpen(false)}
    onNew={() => createConversation.mutate(undefined, { onSuccess: () => setMenuOpen(false) })}
    onSelect={(id) => { if (userId) useWiseConversations.getState().select(userId, id); setMenuOpen(false); }}
    onDelete={async (id) => {
      setMenuOpen(false);
      if (await confirm({ title: tr('Delete this conversation?', 'Burahin ang usapang ito?'), message: tr('Only this conversation will be removed. Your other chats and evaluations stay unchanged.', 'Usapang ito lang ang buburahin. Mananatili ang ibang usapan at mga evaluation mo.'), confirmLabel: tr('Delete conversation', 'Burahin ang usapan'), danger: true })) {
        deleteConversation.mutate(id, { onSuccess: () => { setText(''); setFailedMessage(null); setMenuOpen(false); }, onError: () => setMenuOpen(true) });
      }
    }}
  />;

  useEffect(() => { if (inlineHistory) setMenuOpen(false); }, [inlineHistory]);

  return (
    <View testID="wise-workspace" onLayout={(event) => setWorkspaceWidth(event.nativeEvent.layout.width)} style={{ flex: 1, minWidth: 0, flexDirection: 'row' }}>
    {inlineHistory && menu}
    <KeyboardAvoidingView testID="wise-chat-content" style={{ flex: 1, minWidth: 0, backgroundColor: colors.card }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.borderSoft, paddingVertical: 10, paddingHorizontal: inlineHistory ? 20 : 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {onBack && <HeaderButton icon="arrowLeft" label={tr('Back', 'Bumalik')} onPress={onBack} />}
        {!inlineHistory && <HeaderButton icon="menu" label={tr('Conversation menu', 'Menu ng usapan')} onPress={() => setMenuOpen(true)} />}
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <WiseHead size={waiting ? 34 : 27} mood={waiting ? 'ask' : 'grin'} pop />
        </View>
        <View style={{ flex: 1, minWidth: 100 }}>
          <Txt weight="semibold" size={16}>Professor Wise</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#5BE49B' }} />
            <Txt numberOfLines={1} size={12} color={colors.muted}>{waiting ? tr('Thinking…', 'Nag-iisip…') : wise.data?.conversation?.title ?? subtitle}</Txt>
          </View>
        </View>
        {onClose && <HeaderButton icon="close" label={tr('Close chat', 'Isara ang chat')} onPress={onClose} />}
      </View>

      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ width: '100%', maxWidth: inlineHistory ? 1120 : undefined, alignSelf: 'center', padding: inlineHistory ? 24 : 14, gap: 12 }}>
        {wise.isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
        {wise.data?.has_more_messages && conversationId !== undefined && messages[0] && <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
          suppressScroll.current = true;
          earlier.mutate({ conversationId, beforeId: messages[0].id }, { onError: () => { suppressScroll.current = false; } });
        }} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Txt size={14} color={colors.accent}>{earlier.isPending ? tr('Loading…', 'Naglo-load…') : tr('Load earlier messages', 'I-load ang mga naunang mensahe')}</Txt></Pressable>}
        {wise.data && messages.length === 0 && !waiting && (
          <FadeIn style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 4 }}>
            <WiseMascot size={84} mood="hello" />
          </FadeIn>
        )}
        {wise.data && messages.length === 0 && <Bubble role="assistant" text={wise.data.greeting} />}
      {wise.data && messages.length === 0 && !waiting && (
        <View style={{ paddingVertical: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {wise.data.suggestions.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => submit(s)}
              style={({ hovered }: { hovered?: boolean }) => ({
                minHeight: 44,
                paddingVertical: 10,
                paddingHorizontal: 14,
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: hovered ? colors.navy : colors.border,
                borderRadius: 999,
                backgroundColor: colors.card,
              })}
            >
              <Txt size={14}>{s}</Txt>
            </Pressable>
          ))}
        </View>
      )}

        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.content} />
        ))}
        {waiting && (
          <>
            <Bubble role="user" text={pendingMessage?.message ?? ''} />
            <Bubble role="assistant" text={tr('Thinking…', 'Nag-iisip…')} muted face="ask" />
          </>
        )}
        {slowReply && waiting && <Txt accessibilityLiveRegion="polite" size={13} color={colors.muted}>{tr('Wise is still working on your reply. The local AI may take a little longer.', 'Binubuo pa ni Wise ang sagot mo. Maaaring mas matagal nang kaunti ang local AI.')}</Txt>}
        {error ? (
          <Txt size={14} color={colors.danger}>{error instanceof ApiError ? error.firstMessage : tr('Professor Wise is unavailable right now.', 'Hindi available si Professor Wise ngayon.')}</Txt>
        ) : null}
        {failedMessage && !busy && <Pressable accessibilityRole="button" onPress={() => submit(failedMessage.message, failedMessage.requestId)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Txt weight="semibold" size={14} color={colors.accent}>{tr('Retry message', 'Ipadala ulit')}</Txt></Pressable>}
      </ScrollView>


      <View style={{ width: '100%', maxWidth: inlineHistory ? 1120 : undefined, alignSelf: 'center', paddingHorizontal: 14, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          submitBehavior="newline"
          onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
          onKeyPress={(e) => {
            const key = e.nativeEvent as typeof e.nativeEvent & { shiftKey?: boolean; isComposing?: boolean };
            if (Platform.OS === 'web' && key.key === 'Enter' && !key.shiftKey && !key.isComposing) {
              e.preventDefault();
              submit(text);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={tr('Message Professor Wise', 'Mensahe kay Professor Wise')}
          returnKeyType="default"
          maxLength={5000}
          style={{ flex: 1, height: Math.max(desktop ? 52 : 48, Math.min(140, inputHeight)), borderRadius: 24, backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 13, textAlignVertical: 'top', lineHeight: 21, fontFamily: fonts.regular, fontSize: 15, color: colors.text }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Send', 'Ipadala')}
          onPress={() => submit(text)}
          disabled={!text.trim() || busy}
          accessibilityState={{ disabled: !text.trim() || busy, busy }}
          aria-disabled={!text.trim() || busy}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: !text.trim() || busy ? colors.track : colors.navy, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="send" size={20} color={!text.trim() || waiting ? colors.muted : '#FFFFFF'} strokeWidth={1.9} />
        </Pressable>
      </View>
      {!inlineHistory && menuOpen && menu}
    </KeyboardAvoidingView>
    </View>
  );
}

const emptyDraft = { text: '', failedMessage: null as WiseSendInput | null };

/** Drafts stay in this chat widget's memory and are isolated by account and topic. */
function useTopicDraft(slot: string) {
  const [drafts, setDrafts] = useState<Record<string, typeof emptyDraft>>({});
  const setText = useCallback((value: SetStateAction<string>) => {
    setDrafts((current) => {
      const draft = current[slot] ?? emptyDraft;
      return { ...current, [slot]: { ...draft, text: typeof value === 'function' ? value(draft.text) : value } };
    });
  }, [slot]);
  const setFailedMessage = useCallback((failedMessage: WiseSendInput | null) => {
    setDrafts((current) => ({ ...current, [slot]: { ...(current[slot] ?? emptyDraft), failedMessage } }));
  }, [slot]);
  return { ...(drafts[slot] ?? emptyDraft), setText, setFailedMessage };
}

function Bubble({ role, text, muted, face = 'grin' }: { role: 'user' | 'assistant'; text: string; muted?: boolean; face?: 'grin' | 'ask' }) {
  const mine = role === 'user';
  return (
    <FadeIn distance={8} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: mine ? '82%' : '94%', flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {!mine && (
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <WiseHead size={face === 'ask' ? 23 : 19} mood={face} />
        </View>
      )}
      <View
        style={{
          backgroundColor: mine ? colors.navy : colors.surface,
          borderRadius: 20,
          borderBottomRightRadius: mine ? 6 : 20,
          borderBottomLeftRadius: mine ? 20 : 6,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexShrink: 1,
          maxWidth: 1040,
        }}
      >
        {mine ? <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#FFFFFF' }}>{text}</Text>
          : <RichText text={text} size={14} color={muted ? colors.muted : colors.text} style={{ lineHeight: 21 }} />}
      </View>
    </FadeIn>
  );
}

function HeaderButton({ icon, label, onPress, disabled = false }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={18} color={colors.accent} strokeWidth={2} />
    </Pressable>
  );
}
