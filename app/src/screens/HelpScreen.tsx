import { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { ApiError } from '@/api/client';
import { useAppInfo, useSendSupport } from '@/api/hooks';
import { homeFor, useAuth } from '@/auth/store';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { requestTour } from '@/components/Tour';
import { Txt } from '@/components/Txt';
import { ListRow, Section, Screen, Sheet } from '@/components/ui';
import { WiseMascot } from '@/components/WiseMascot';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, fonts, space, text } from '@/theme';

type Faq = { q: string; a: string };

function faqs(role: string): Faq[] {
  const common: Faq[] = [
    {
      q: tr('I forgot my password. What do I do?', 'Nakalimutan ko ang password ko. Ano ang gagawin ko?'),
      a: tr('On the sign-in screen, tap “Forgot password?”. The admin will give you a temporary password; sign in with it, then change it in Profile.', 'Sa sign-in screen, pindutin ang “Nakalimutan?”. Bibigyan ka ng admin ng pansamantalang password; mag-sign in gamit iyon, tapos palitan sa Profile.'),
    },
    {
      q: tr('How do I switch to dark mode or Filipino?', 'Paano lumipat sa dark mode o Filipino?'),
      a: tr('Open Settings. Appearance has System, Light and Dark; Language has English and Filipino.', 'Buksan ang Settings. May System, Light at Dark sa Itsura; may English at Filipino sa Wika.'),
    },
  ];
  if (role === 'student') {
    return [
      {
        q: tr('Can my teacher see my name?', 'Makikita ba ng guro ang pangalan ko?'),
        a: tr('No. Teachers only see combined ratings and comments. Your name is never shown to them, and the admin can only see whether you finished, not your answers.', 'Hindi. Pinagsama-samang rating at komento lang ang nakikita ng guro. Hindi kailanman ipinapakita ang pangalan mo, at kung tapos ka na lang ang nakikita ng admin, hindi ang mga sagot mo.'),
      },
      {
        q: tr('Can I change an evaluation after sending it?', 'Puwede ko bang baguhin ang evaluation pagkatapos ipasa?'),
        a: tr('No, to keep results fair. That’s why there’s a Review step before you submit.', 'Hindi, para manatiling patas. Kaya may Review bago ka magpasa.'),
      },
      {
        q: tr('What if I close the app halfway?', 'Paano kung maisara ko ang app sa gitna?'),
        a: tr('Your answers are saved on your device as a draft. Open the same teacher again and tap “Continue”.', 'Naka-save ang mga sagot mo bilang draft sa device mo. Buksan ulit ang parehong guro at pindutin ang “Ituloy”.'),
      },
      {
        q: tr('A teacher or subject is missing or wrong.', 'May kulang o maling guro o subject.'),
        a: tr('Use “Contact your admin” below with your section and the subject. Classes are set up by the admin.', 'Gamitin ang “Makipag-ugnayan sa admin” sa ibaba kasama ang section at subject mo. Ang admin ang nag-aayos ng mga klase.'),
      },
      ...common,
    ];
  }
  if (role === 'teacher') {
    return [
      {
        q: tr('Who wrote this comment?', 'Sino ang sumulat ng komentong ito?'),
        a: tr('Evaluations are anonymous, so nobody can see who wrote a comment, not even the admin.', 'Anonymous ang mga evaluation, kaya walang makakaalam kung sino ang sumulat, kahit ang admin.'),
      },
      {
        q: tr('When do my results appear?', 'Kailan lalabas ang mga resulta ko?'),
        a: tr('Once a few students have submitted (your school sets how many, usually 3). Until then they stay hidden so nobody can be identified. After that, your dashboard updates automatically.', 'Kapag ilang estudyante na ang nakapagpasa (ang paaralan ang nagtatakda, kadalasan 3). Hanggang doon, nakatago ito para walang makilala. Pagkatapos, kusang nag-a-update ang dashboard mo.'),
      },
      {
        q: tr('How do I save my report as a PDF?', 'Paano i-save ang report bilang PDF?'),
        a: tr('Open Report and choose “Print / Save as PDF”.', 'Buksan ang Report at piliin ang “I-print / I-save bilang PDF”.'),
      },
      ...common,
    ];
  }
  if (role === 'platform') {
    return [
      {
        q: tr('How do I approve a school?', 'Paano mag-apruba ng paaralan?'),
        a: tr('Open Schools, choose the application, check that the contact really works there, then Approve. Send the invite code to the contact; they create the first admin account and set up the school.', 'Buksan ang Schools, piliin ang aplikasyon, siguraduhing nagtatrabaho roon ang contact, saka Aprubahan. Ipadala ang invite code sa contact; sila ang gagawa ng unang admin account at magse-set up ng paaralan.'),
      },
      {
        q: tr('Can I see a school’s evaluation answers?', 'Makikita ko ba ang sagot sa evaluation ng isang paaralan?'),
        a: tr('No. You see counts only. Ratings and comments belong to each school.', 'Hindi. Bilang lang ang nakikita mo. Pag-aari ng bawat paaralan ang rating at komento.'),
      },
      ...common,
    ];
  }
  return [
    {
      q: tr('How do students get accounts?', 'Paano nagkakaroon ng account ang mga estudyante?'),
      a: tr('Add their ID numbers (with names and sections) under Approved IDs, then share your join link from School settings. Students create their own account with their ID.', 'Idagdag ang ID number nila (kasama ang pangalan at section) sa Approved IDs, saka ibahagi ang join link mula sa School settings. Sila na ang gagawa ng account gamit ang ID nila.'),
    },
    {
      q: tr('How do teachers join?', 'Paano sumasali ang mga guro?'),
      a: tr('Open People → Invite teachers, paste their names, and send each one their code. They choose “Join with an invite code” in the app.', 'Buksan ang People → Mag-imbita ng guro, i-paste ang mga pangalan, at ipadala ang code sa bawat isa. Pipiliin nila ang “Sumali gamit ang invite code” sa app.'),
    },
    {
      q: tr('Can a dean manage only their college?', 'Puwede bang ang dean ay sa kolehiyo lang niya?'),
      a: tr('Yes. Invite them as an admin for their department. They’ll see and manage only that department’s teachers, sections, classes and reports.', 'Oo. Imbitahan sila bilang admin ng departamento nila. Ang mga guro, section, klase at report lang ng departamentong iyon ang makikita at mapapamahalaan nila.'),
    },
    {
      q: tr('Someone forgot their password.', 'May nakalimot ng password.'),
      a: tr('Open Requests. Each request has “Reset password”, which gives you a temporary password to pass on.', 'Buksan ang Requests. May “I-reset ang password” ang bawat request, na magbibigay ng pansamantalang password na ibibigay mo.'),
    },
    ...common,
  ];
}

/** Help center: answers, the guided tour, and a way to reach the admin. */
export default function HelpScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const info = useAppInfo();
  const scrollHide = useScrollHide();
  const [open, setOpen] = useState<number | null>(0);
  const [sheet, setSheet] = useState<'contact' | 'problem' | null>(null);
  if (!user) return null;
  const list = faqs(user.role);
  // Students and teachers reach their school's admins; admins reach the TeachWise team.
  const staffToTeachwise = user.role === 'admin';

  return (
    <Screen title={tr('Help & feedback', 'Tulong at feedback')} onBack={() => (router.canGoBack() ? router.back() : router.replace(homeFor(user.role)))} {...scrollHide}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, backgroundColor: colors.frame, borderRadius: 28, padding: space.lg, paddingBottom: 0, overflow: 'hidden' }}>
        <View style={{ flex: 1, paddingBottom: space.lg, gap: 4 }}>
          <Txt weight="bold" size={text.h2} color="#FFFFFF">{tr('How can I help?', 'Paano kita matutulungan?')}</Txt>
          <Txt size={text.body} color={colors.onFrameMuted} style={{ lineHeight: 21 }}>{tr('Find a quick answer below, or ask me in Ask Wise any time.', 'Hanapin ang mabilis na sagot sa ibaba, o tanungin ako sa Ask Wise kahit kailan.')}</Txt>
        </View>
        <WiseMascot size={120} mood="teach" shadow={false} />
      </View>

      <Section title={tr('Common questions', 'Mga karaniwang tanong')}>
        {list.map((f, i) => {
          const on = open === i;
          return (
            <Pressable
              key={f.q}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
              onPress={() => setOpen(on ? null : i)}
              style={({ hovered }: { hovered?: boolean }) => ({ paddingVertical: 14, paddingHorizontal: space.md, gap: 8, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, backgroundColor: hovered ? colors.surface : 'transparent' })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Txt weight="semibold" size={text.bodyLg} style={{ flex: 1 }}>{f.q}</Txt>
                <View style={{ transform: [{ rotate: on ? '180deg' : '0deg' }] }}>
                  <Icon name="chevronDown" size={16} color={colors.muted} strokeWidth={2.2} />
                </View>
              </View>
              {on && <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>{f.a}</Txt>}
            </Pressable>
          );
        })}
      </Section>

      <Section title={tr('Get started', 'Pagsisimula')}>
        {user.role === 'student' && (
          <ListRow
            icon="glasses"
            title={tr('Take the tour again', 'Mag-tour ulit')}
            subtitle={tr('Professor Wise shows you around the dashboard', 'Ipapakita ni Professor Wise ang dashboard')}
            onPress={() => {
              requestTour();
              router.navigate(homeFor(user.role) as Href);
            }}
          />
        )}
        <ListRow icon="chat" title={tr('Ask Professor Wise', 'Magtanong kay Professor Wise')} subtitle={tr('Instant answers about evaluations', 'Agarang sagot tungkol sa evaluation')} onPress={() => router.push(`${homeFor(user.role)}/wise` as Href)} last />
      </Section>

      {user.role !== 'platform' && (
        <Section title={tr('Contact', 'Makipag-ugnayan')} footer={staffToTeachwise ? tr('As an admin, your messages go to the TeachWise team.', 'Bilang admin, sa TeachWise team napupunta ang mga mensahe mo.') : undefined}>
          <ListRow
            icon="mail"
            title={staffToTeachwise ? tr('Contact TeachWise support', 'Makipag-ugnayan sa TeachWise support') : tr('Contact your admin', 'Makipag-ugnayan sa admin')}
            subtitle={staffToTeachwise ? tr('Questions about setting up or running your school', 'Tanong sa pag-set up o pagpapatakbo ng paaralan') : tr('Missing classes, wrong section, account questions', 'Kulang na klase, maling section, tanong sa account')}
            onPress={() => setSheet('contact')}
          />
          <ListRow icon="bug" title={tr('Report a problem', 'Mag-report ng problema')} subtitle={tr('Something not working? Tell us what happened.', 'May hindi gumagana? Sabihin kung ano ang nangyari.')} onPress={() => setSheet('problem')} />
          {(staffToTeachwise ? info.data?.platform_email : info.data?.support_email) ? (
            <ListRow icon="mail" title={tr('Email', 'Email')} value={(staffToTeachwise ? info.data?.platform_email : info.data?.support_email) ?? ''} onPress={() => Linking.openURL(`mailto:${staffToTeachwise ? info.data?.platform_email : info.data?.support_email}`).catch(() => {})} last />
          ) : null}
        </Section>
      )}

      <SupportSheet kind={sheet} onClose={() => setSheet(null)} toTeachwise={staffToTeachwise} />
    </Screen>
  );
}

function SupportSheet({ kind, onClose, toTeachwise }: { kind: 'contact' | 'problem' | null; onClose: () => void; toTeachwise: boolean }) {
  const send = useSendSupport();
  const path = usePathname();
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState(false);
  const problem = kind === 'problem';
  const tooShort = message.trim().length < 5;

  return (
    <Sheet visible={!!kind} onClose={onClose} title={problem ? tr('Report a problem', 'Mag-report ng problema') : toTeachwise ? tr('Contact TeachWise support', 'Makipag-ugnayan sa TeachWise support') : tr('Contact your admin', 'Makipag-ugnayan sa admin')}>
      <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 21 }}>
        {problem
          ? tr('What were you doing, and what happened? The app version and device are added for you.', 'Ano ang ginagawa mo, at ano ang nangyari? Kusang idinadagdag ang bersyon ng app at device.')
          : toTeachwise
            ? tr('Your message goes to the TeachWise team. We reply by email.', 'Mapupunta ang mensahe mo sa TeachWise team. Sasagot kami sa email.')
            : tr('Your message goes to your school’s admins. They’ll reply with a notification or in person.', 'Mapupunta ang mensahe mo sa mga admin ng paaralan. Sasagot sila sa notification o personal.')}
      </Txt>
      <TextInput
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        autoFocus
        placeholder={problem ? tr('e.g. The Submit button didn’t respond on the last question.', 'hal. Hindi gumana ang Submit sa huling tanong.') : tr('e.g. My Database Management class is missing.', 'hal. Wala ang Database Management class ko.')}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={tr('Message', 'Mensahe')}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ minHeight: 140, borderWidth: 1.5, borderColor: focused ? colors.navy : colors.border, borderRadius: 18, padding: 14, fontFamily: fonts.regular, fontSize: 16, color: colors.text, textAlignVertical: 'top', backgroundColor: colors.card }}
      />
      <Txt size={text.caption} color={colors.muted} style={{ alignSelf: 'flex-end' }}>{`${message.length} / 2000`}</Txt>
      {send.error ? <Txt size={text.small} color={colors.danger}>{send.error instanceof ApiError ? send.error.firstMessage : tr('Couldn’t send. Please try again.', 'Hindi naipadala. Pakisubukan ulit.')}</Txt> : null}
      <Button
        title={tr('Send', 'Ipadala')}
        size="lg"
        disabled={tooShort}
        loading={send.isPending}
        onPress={() =>
          send.mutate(
            { kind: kind!, message: message.trim(), screen: path },
            {
              onSuccess: (r) => {
                setMessage('');
                toast({ title: r.message, tone: 'success', mood: 'proud' });
                onClose();
              },
            }
          )
        }
      />
    </Sheet>
  );
}
