import { useState } from 'react';
import { Pressable } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { colors } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { ListRow, Section, Sheet } from './ui';

/** "🌐 English ▾" in the sign-in footer, the usual place for a language choice before signing in. */
export function LanguagePicker({ onDark }: { onDark?: boolean }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const color = onDark ? colors.onFrameMuted : colors.muted;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Language: English. Change', 'Wika: Filipino. Palitan')} onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 6 }}>
        <Icon name="globe" size={16} color={color} strokeWidth={2} />
        <Txt weight="medium" size={14} color={color}>{lang === 'fil' ? 'Filipino' : 'English'}</Txt>
        <Icon name="chevronDown" size={14} color={color} strokeWidth={2.2} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={tr('Language', 'Wika')} maxWidth={360}>
        <Section>
          {(['en', 'fil'] as const).map((l, i) => (
            <ListRow
              key={l}
              title={l === 'fil' ? 'Filipino' : 'English'}
              last={i === 1}
              right={lang === l ? <Icon name="check" size={18} color={colors.accent} strokeWidth={2.6} /> : undefined}
              onPress={() => {
                setOpen(false);
                if (lang !== l) setLang(l);
              }}
            />
          ))}
        </Section>
      </Sheet>
    </>
  );
}
