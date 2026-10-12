import { Platform, Share, View } from 'react-native';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/ui';
import { colors, space, text } from '@/theme';
import { Button } from './Button';
import { Txt } from './Txt';
import { Sheet } from './ui';
import { WiseMascot } from './WiseMascot';

/** The message to send with an invite code, ready to paste into email, Messenger or SMS. */
export function inviteMessage(code: string, school: string, role: 'admin' | 'teacher', name?: string | null): string {
  const who = name ? `Hi ${name}, ` : '';
  const what = role === 'admin' ? `set up ${school} on TeachWise` : `join ${school} on TeachWise`;
  return `${who}you're invited to ${what}.\n\n1. Get the TeachWise app (Google Play) or open the web app.\n2. Tap "Join with an invite code".\n3. Enter this code: ${code}\n\nThe code works once and expires in ${role === 'admin' ? '14' : '30'} days.`;
}

/** Shows freshly made invite codes with Copy / Share. */
export function InviteCodeSheet({ visible, onClose, invites, school, role }: { visible: boolean; onClose: () => void; invites: { code: string; name: string | null }[]; school: string; role: 'admin' | 'teacher' }) {
  const all = invites.map((i) => (invites.length > 1 ? `${i.name ?? tr('Invite', 'Invite')}: ${i.code}` : inviteMessage(i.code, school, role, i.name))).join('\n');
  const copy = async () => {
    try {
      if (Platform.OS === 'web') await navigator.clipboard?.writeText(all);
      else await Share.share({ message: all });
      toast({ title: Platform.OS === 'web' ? tr('Copied', 'Nakopya') : tr('Shared', 'Naibahagi'), tone: 'success' });
    } catch {
      // the share sheet was closed
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={invites.length > 1 ? tr(`${invites.length} invite codes`, `${invites.length} invite code`) : tr('Invite code', 'Invite code')}>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <WiseMascot size={100} mood="wink" float={false} />
        <Txt size={text.body} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 22 }}>
          {role === 'admin'
            ? tr('Send this to the school’s admin. They tap “Join with an invite code” and set up their school.', 'Ipadala ito sa admin ng paaralan. Pipindutin nila ang “Sumali gamit ang invite code” at ise-set up ang paaralan.')
            : tr('Send each person their code. It works once, so nobody else can use it.', 'Ipadala sa bawat tao ang code nila. Isang beses lang ito gumagana.')}
        </Txt>
        <View style={{ alignSelf: 'stretch', gap: space.xs }}>
          {invites.map((i) => (
            <View key={i.code} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: space.sm, paddingHorizontal: space.md, borderWidth: 1.5, borderColor: colors.borderSoft, borderStyle: 'dashed' }}>
              <Txt size={text.body} color={colors.textSoft} numberOfLines={1} style={{ flex: 1 }}>{i.name ?? tr('Anyone', 'Kahit sino')}</Txt>
              <Txt weight="bold" size={text.title} selectable style={{ letterSpacing: 1.5 }}>{i.code}</Txt>
            </View>
          ))}
        </View>
        <Button title={Platform.OS === 'web' ? tr('Copy invite message', 'Kopyahin ang mensahe') : tr('Share invite', 'I-share ang invite')} onPress={copy} style={{ alignSelf: 'stretch' }} size="lg" />
      </View>
    </Sheet>
  );
}
