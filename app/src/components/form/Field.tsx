import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { tr } from '@/lib/i18n';
import { colors, fonts } from '@/theme';
import { Icon, type IconName } from '../Icon';
import { Txt } from '../Txt';

const native = Platform.OS !== 'web';

/** idle: nothing to say yet · checking: asking the server · valid: ✓ · invalid: ✗ with a reason */
export type FieldState = 'idle' | 'checking' | 'valid' | 'invalid';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon: IconName;
  state?: FieldState;
  /** Shown under the field, coloured by the state (green ✓ / red ✗). */
  message?: string;
  /** Neutral help text, shown when there is no message. */
  hint?: string;
  /** Shows "12 / 50" under the field. */
  max?: number;
  /** Something on the right inside the box, e.g. the show-password eye. */
  right?: ReactNode;
  /** Locked fields show a lock and can't be edited (e.g. filled in from the school’s records). */
  locked?: boolean;
  /** Increase this number to shake the field (wrong password, missing value). */
  shake?: number;
  /** Extra content under the field (password rules, suggestions…). */
  children?: ReactNode;
}

/**
 * The one text field used by every form in TeachWise.
 * Border and icon follow the state: navy while typing, green when valid, red when not.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, icon, state = 'idle', message, hint, max, right, locked, shake = 0, children, onFocus, onBlur, value, ...input },
  ref
) {
  const [focused, setFocused] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shake) return;
    x.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((v) => Animated.timing(x, { toValue: v, duration: 55, useNativeDriver: native }))
    ).start();
  }, [shake, x]);

  const border =
    state === 'invalid' ? colors.danger : state === 'valid' ? colors.successFg : focused ? colors.navy : colors.border;
  const iconColor = state === 'invalid' ? colors.danger : focused || state === 'valid' ? colors.accent : colors.muted;
  const msgColor = state === 'invalid' ? colors.danger : state === 'valid' ? colors.successFg : colors.muted;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt weight="medium" size={14} color={colors.textSoft} style={{ flex: 1 }}>{label}</Txt>
        {locked && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="lock" size={12} color={colors.muted} strokeWidth={2} />
            <Txt size={12} color={colors.muted}>{tr('From school records', 'Mula sa records ng paaralan')}</Txt>
          </View>
        )}
      </View>
      <Animated.View
        style={{
          minHeight: 54,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: border,
          backgroundColor: locked ? colors.surface : colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          transform: [{ translateX: x }],
        }}
      >
        <Icon name={icon} size={20} color={iconColor} />
        <TextInput
          ref={ref}
          value={value}
          editable={!locked}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          accessibilityHint={message ?? hint}
          maxLength={max}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{ flex: 1, minWidth: 0, ...(input.multiline ? { minHeight: 96, paddingVertical: 14, textAlignVertical: 'top' as const } : { height: 52 }), fontFamily: fonts.regular, fontSize: 16, color: locked ? colors.textSoft : colors.text }}
        />
        {state === 'checking' && <ActivityIndicator size="small" color={colors.accent} />}
        {state === 'valid' && <Icon name="checkCircle" size={20} color={colors.successFg} strokeWidth={2} />}
        {state === 'invalid' && !right && <Icon name="close" size={18} color={colors.danger} strokeWidth={2.4} />}
        {right}
      </Animated.View>
      {(message || hint || max) && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }} accessibilityLiveRegion="polite">
          {message && state === 'valid' && <Icon name="checkCircle" size={14} color={msgColor} strokeWidth={2.2} />}
          {message && state === 'invalid' && <Icon name="close" size={14} color={msgColor} strokeWidth={2.4} />}
          <Txt size={13} color={message ? msgColor : colors.muted} style={{ flex: 1, lineHeight: 18 }}>{message ?? hint ?? ''}</Txt>
          {max ? <Txt size={12} color={length > max * 0.9 ? colors.urgentFg : colors.muted}>{`${length} / ${max}`}</Txt> : null}
        </View>
      )}
      {children}
    </View>
  );
});

/** Password field with show/hide and a Caps Lock warning (computers). */
export const PasswordField = forwardRef<TextInput, Omit<FieldProps, 'icon' | 'right' | 'secureTextEntry'>>(function PasswordField(props, ref) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [focused, setFocused] = useState(false);

  // Caps Lock can only be read from keyboard events, so listen while the field has focus.
  useEffect(() => {
    if (Platform.OS !== 'web' || !focused || typeof window === 'undefined') return;
    const read = (e: KeyboardEvent) => setCaps(!!e.getModifierState?.('CapsLock'));
    window.addEventListener('keydown', read);
    window.addEventListener('keyup', read);
    return () => {
      window.removeEventListener('keydown', read);
      window.removeEventListener('keyup', read);
    };
  }, [focused]);

  return (
    <Field
      ref={ref}
      {...props}
      icon="lock"
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        setCaps(false);
        props.onBlur?.(e);
      }}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={show ? tr('Hide password', 'Itago ang password') : tr('Show password', 'Ipakita ang password')}
          onPress={() => setShow((s) => !s)}
          style={{ height: 44, paddingHorizontal: 4, justifyContent: 'center' }}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={20} color={colors.muted} />
        </Pressable>
      }
    >
      {caps && focused && (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.urgentBg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Icon name="arrowUp" size={14} color={colors.urgentFg} strokeWidth={2.4} />
          <Txt weight="medium" size={13} color={colors.urgentFg}>{tr('Caps Lock is on', 'Naka-on ang Caps Lock')}</Txt>
        </View>
      )}
      {props.children}
    </Field>
  );
});

/** Debounces a value, e.g. so a username is checked once typing pauses. */
export function useDebounced<T>(value: T, ms = 450): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** A labelled on/off switch row. */
export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? colors.navy : colors.track, alignItems: value ? 'flex-end' : 'flex-start', justifyContent: 'center' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' }} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="medium" size={15}>{label}</Txt>
        {hint ? <Txt size={12} color={colors.muted}>{hint}</Txt> : null}
      </View>
    </Pressable>
  );
}

/** A checkbox row; `children` is the label (can contain links). */
export function Checkbox({ value, onChange, children, invalid, label }: { value: boolean; onChange: (v: boolean) => void; children: ReactNode; invalid?: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        onPress={() => onChange(!value)}
        hitSlop={10}
        style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: invalid ? colors.danger : value ? colors.navy : colors.border, backgroundColor: value ? colors.navy : colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}
      >
        {value && <Icon name="check" size={15} color="#FFFFFF" strokeWidth={3} />}
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
