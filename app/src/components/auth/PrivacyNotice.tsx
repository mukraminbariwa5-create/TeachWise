import { Modal, Pressable, ScrollView, View } from 'react-native';
import { tr } from '@/lib/i18n';
import { useLayoutSize } from '@/lib/useLayout';
import { colors, shadowStyle } from '@/theme';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { WiseMascot } from '../WiseMascot';

/**
 * A short, plain-language Data Privacy Notice (Republic Act 10173, the Data Privacy Act of 2012).
 * Shown from the sign-up checkbox; "I agree" ticks the box.
 */
export function PrivacyNotice({ visible, onClose, onAgree }: { visible: boolean; onClose: () => void; onAgree: () => void }) {
  const phone = useLayoutSize() === 'phone';
  const sections: { title: string; body: string }[] = [
    {
      title: tr('What we collect', 'Ano ang kinokolekta namin'),
      body: tr(
        'Your student ID, name, section and username, and the ratings and comments you submit in evaluations.',
        'Ang student ID, pangalan, section at username mo, at ang mga rating at komentong ipinapasa mo sa evaluation.'
      ),
    },
    {
      title: tr('Why', 'Bakit'),
      body: tr(
        'To check that only enrolled students evaluate their own teachers, and to give teachers and your school feedback that helps teaching improve.',
        'Para matiyak na mga naka-enroll na estudyante lang ang nag-e-evaluate ng sarili nilang guro, at para mabigyan ang mga guro at paaralan ng feedback na makakatulong sa pagtuturo.'
      ),
    },
    {
      title: tr('Your answers are anonymous', 'Anonymous ang mga sagot mo'),
      body: tr(
        'Teachers only see combined ratings and comments, never your name or ID. Your name is kept separate from your answers.',
        'Pinagsama-samang rating at komento lang ang nakikita ng mga guro, hindi ang pangalan o ID mo. Hiwalay na itinatago ang pangalan mo sa mga sagot mo.'
      ),
    },
    {
      title: tr('Who can see what', 'Sino ang nakakakita ng ano'),
      body: tr(
        'The admin can see whether you have finished your evaluations, to send reminders, but not which answers are yours.',
        'Nakikita ng admin kung tapos ka na sa mga evaluation mo, para makapagpadala ng paalala, pero hindi kung alin ang mga sagot mo.'
      ),
    },
    {
      title: tr('Your rights', 'Ang mga karapatan mo'),
      body: tr(
        'Under the Data Privacy Act of 2012 (RA 10173) you can ask to see, correct or delete your personal data. Contact your school’s admin or Data Protection Officer.',
        'Sa ilalim ng Data Privacy Act of 2012 (RA 10173), puwede mong hilinging makita, itama o burahin ang personal data mo. Makipag-ugnayan sa admin o Data Protection Officer ng paaralan mo.'
      ),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType={phone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(5,5,40,0.45)', justifyContent: phone ? 'flex-end' : 'center', alignItems: 'center', padding: phone ? 0 : 20 }}>
        <Pressable onPress={() => {}} style={[{ width: '100%', maxWidth: phone ? undefined : 560, maxHeight: phone ? '90%' : '85%', backgroundColor: colors.card, borderRadius: 28, borderBottomLeftRadius: phone ? 0 : 28, borderBottomRightRadius: phone ? 0 : 28, padding: 22, gap: 14 }, shadowStyle('lift')]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <WiseMascot size={78} mood="teach" float={false} shadow={false} />
            <View style={{ flex: 1, paddingBottom: 6 }}>
              <Txt weight="semibold" size={12} color={colors.muted} style={{ letterSpacing: 1 }}>RA 10173</Txt>
              <Txt weight="bold" size={21} accessibilityRole="header">{tr('Data Privacy Notice', 'Data Privacy Notice')}</Txt>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Isara')} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={16} color={colors.textSoft} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14 }}>
            {sections.map((s) => (
              <View key={s.title} style={{ gap: 4 }}>
                <Txt weight="semibold" size={16}>{s.title}</Txt>
                <Txt size={15} color={colors.textSoft} style={{ lineHeight: 22 }}>{s.body}</Txt>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={tr('Close', 'Isara')} variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={tr('I agree', 'Sumasang-ayon ako')}
              onPress={() => {
                onAgree();
                onClose();
              }}
              style={{ flex: 1.4 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
