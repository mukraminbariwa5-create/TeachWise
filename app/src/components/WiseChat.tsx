import { useEffect, useRef, useState } from 'react';
import { tr } from '@/lib/i18n';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useClearWise, useSendWise, useWise } from '@/api/hooks';
import { colors, fonts } from '@/theme';
import { FadeIn } from './Motion';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';
import { WiseHead, WiseMascot } from './WiseMascot';

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
  const clear = useClearWise();
  const [text, setText] = useState('');
  const scroll = useRef<ScrollView>(null);

  const messages = wise.data?.messages ?? [];

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length, send.isPending]);

  const submit = (value: string) => {
    const message = value.trim();
    if (!message || send.isPending) return;
    setText('');
    send.mutate(message);
  };

  const error = send.error ?? wise.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <View style={{ backgroundColor: colors.frame, paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onBack && <HeaderButton icon="arrowLeft" label={tr('Back', 'Bumalik')} onPress={onBack} />}
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <WiseHead size={send.isPending ? 34 : 30} mood={send.isPending ? 'ask' : 'grin'} pop />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={17} color="#FFFFFF">Professor Wise</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#5BE49B' }} />
            <Txt size={13} color={colors.onFrameMuted}>{send.isPending ? tr('Typing…', 'Nagta-type…') : subtitle}</Txt>
          </View>
        </View>
        <HeaderButton icon="refresh" label={tr('Refresh conversation', 'I-refresh ang usapan')} onPress={() => wise.refetch()} />
        <HeaderButton icon="trash" label={tr('Delete chat history', 'Burahin ang chat')} onPress={() => clear.mutate()} />
        {onClose && <HeaderButton icon="close" label={tr('Close chat', 'Isara ang chat')} onPress={onClose} />}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
        {wise.isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
        {wise.data && messages.length === 0 && !send.isPending && (
          <FadeIn style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 4 }}>
            <WiseMascot size={132} mood="hello" />
          </FadeIn>
        )}
        {wise.data && <Bubble role="assistant" text={wise.data.greeting} />}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.content} />
        ))}
        {send.isPending && (
          <>
            <Bubble role="user" text={send.variables ?? ''} />
            <Bubble role="assistant" text="Thinking…" muted face="ask" />
          </>
        )}
        {error ? (
          <Txt size={14} color={colors.danger}>{error instanceof ApiError ? error.firstMessage : tr('Professor Wise is unavailable right now.', 'Hindi available si Professor Wise ngayon.')}</Txt>
        ) : null}
      </ScrollView>

      {wise.data && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {wise.data.suggestions.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => submit(s)}
              style={({ hovered }: { hovered?: boolean }) => ({
                minHeight: 38,
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

      <View style={{ paddingHorizontal: 14, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => submit(text)}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={tr('Message Professor Wise', 'Mensahe kay Professor Wise')}
          returnKeyType="send"
          maxLength={1000}
          style={{ flex: 1, height: 48, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 18, fontFamily: fonts.regular, fontSize: 15, color: colors.text }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Send', 'Ipadala')}
          onPress={() => submit(text)}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="send" size={20} color="#FFFFFF" strokeWidth={1.9} />
        </Pressable>
      </View>
    </View>
  );
}

function Bubble({ role, text, muted, face = 'grin' }: { role: 'user' | 'assistant'; text: string; muted?: boolean; face?: 'grin' | 'ask' }) {
  const mine = role === 'user';
  return (
    <FadeIn distance={8} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {!mine && (
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <WiseHead size={face === 'ask' ? 28 : 24} mood={face} />
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
        }}
      >
        <Txt size={15} color={mine ? '#FFFFFF' : muted ? colors.muted : colors.text} style={{ lineHeight: 21 }}>
          {text}
        </Txt>
      </View>
    </FadeIn>
  );
}

function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.frameSoft, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={18} color="#FFFFFF" strokeWidth={2} />
    </Pressable>
  );
}
