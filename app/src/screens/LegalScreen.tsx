import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppInfo } from '@/api/hooks';
import { useAuth, homeFor } from '@/auth/store';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Txt } from '@/components/Txt';
import { tr } from '@/lib/i18n';
import { useIsWide } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, shadowStyle, space, text } from '@/theme';

const UPDATED = 'October 12, 2026';

type Block = { h: string; p: string[] };

function terms(school: string): Block[] {
  return [
    { h: tr('1. What TeachWise is', '1. Ano ang TeachWise'), p: [tr(`TeachWise is ${school}’s system for anonymous teacher evaluations. Students rate their teachers; teachers see combined results and tips to improve; administrators manage classes and evaluation periods.`, `Ang TeachWise ay sistema ng ${school} para sa anonymous na teacher evaluation. Nire-rate ng mga estudyante ang kanilang guro; nakikita ng mga guro ang pinagsama-samang resulta at mga tip; pinamamahalaan ng mga admin ang mga klase at evaluation period.`)] },
    { h: tr('2. Your account', '2. Ang account mo'), p: [tr('Only students on their school’s approved list (and staff invited by the school) can create an account. Keep your password private and don’t share your account. You are responsible for what is done with it.', 'Mga estudyanteng nasa aprubadong listahan lang ng paaralan (at mga staff na inimbitahan ng paaralan) ang makakagawa ng account. Panatilihing pribado ang password at huwag ipagamit ang account mo. Ikaw ang mananagot sa ginagawa rito.')] },
    { h: tr('3. Honest, respectful feedback', '3. Tapat at magalang na feedback'), p: [tr('Rate what you actually experienced. Comments must not contain threats, insults, hate speech or personal information about anyone. The admin may remove comments that break these rules.', 'I-rate ang talagang naranasan mo. Hindi dapat maglaman ang komento ng pananakot, insulto, mapanirang pananalita o personal na impormasyon ng sinuman. Puwedeng tanggalin ng admin ang komentong lumalabag dito.')] },
    { h: tr('4. Anonymity', '4. Pagiging anonymous'), p: [tr('Teachers never see who wrote an evaluation. The system keeps who has finished only to prevent duplicates and to send reminders.', 'Hindi kailanman makikita ng guro kung sino ang sumulat ng evaluation. Itinatago lang ng sistema kung sino ang tapos na para maiwasan ang doble at makapagpadala ng paalala.')] },
    { h: tr('5. Professor Wise', '5. Si Professor Wise'), p: [tr('Professor Wise is an automated assistant. Its answers are guidance, not official decisions of your school.', 'Si Professor Wise ay automated na katulong. Gabay lang ang mga sagot nito, hindi opisyal na desisyon ng paaralan mo.')] },
    { h: tr('6. Availability and changes', '6. Availability at mga pagbabago'), p: [tr('We work to keep TeachWise available but can’t promise it will never be interrupted. These terms may be updated; the date above shows the latest version.', 'Sinisikap naming laging gumagana ang TeachWise pero hindi namin maipapangakong hindi ito kailanman maaantala. Puwedeng i-update ang mga tuntuning ito; ipinapakita ng petsa sa itaas ang pinakabagong bersyon.')] },
  ];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function privacy(school: string, dpo: string): Block[] {
  return [
    { h: tr('Who is responsible', 'Sino ang responsable'), p: [
      tr(`${cap(school)} is the personal information controller for your TeachWise data, under the Data Privacy Act of 2012 (Republic Act 10173). TeachWise processes it only on the school’s behalf, keeps each school’s data separate, and never sells or shares it. Contact the Data Protection Officer at ${dpo}.`, `Ang ${school} ang personal information controller ng data mo sa TeachWise, sa ilalim ng Data Privacy Act of 2012 (Republic Act 10173). Pinoproseso lang ito ng TeachWise para sa paaralan, hiwalay ang data ng bawat paaralan, at hindi kailanman ibinebenta o ibinabahagi. Makipag-ugnayan sa Data Protection Officer sa ${dpo}.`),
    ] },
    { h: tr('What we collect', 'Ano ang kinokolekta namin'), p: [tr('Account details: ID number, name, section or department, username, and optionally email and phone. Evaluation answers and comments. Notifications, your chat with Professor Wise, signed-in devices, and basic crash reports (screen, app version) to fix problems.', 'Detalye ng account: ID number, pangalan, section o departamento, username, at kung gusto mo, email at telepono. Mga sagot at komento sa evaluation. Notifications, chat mo kay Professor Wise, mga naka-sign in na device, at simpleng crash report (screen, bersyon ng app) para maayos ang problema.')] },
    { h: tr('Why we use it', 'Bakit namin ito ginagamit'), p: [tr('To confirm only enrolled students evaluate their own teachers, to give teachers anonymous feedback, to help your school improve teaching, to send reminders, and to keep the system secure.', 'Para matiyak na mga naka-enroll na estudyante lang ang nag-e-evaluate ng sarili nilang guro, mabigyan ang guro ng anonymous na feedback, matulungan ang paaralan na mapabuti ang pagtuturo, makapagpadala ng paalala, at mapanatiling ligtas ang sistema.')] },
    { h: tr('Who can see it', 'Sino ang nakakakita'), p: [tr('Teachers see only combined ratings and comments, never names. Administrators see who has finished (for reminders) but not whose answers are whose. We don’t sell or share your data with advertisers. Push notifications are delivered through Expo’s push service.', 'Pinagsama-samang rating at komento lang ang nakikita ng guro, hindi ang pangalan. Nakikita ng admin kung sino ang tapos na (para sa paalala) pero hindi kung kanino ang mga sagot. Hindi namin ibinebenta o ibinabahagi ang data mo sa mga advertiser. Ipinapadala ang push notification sa pamamagitan ng push service ng Expo.')] },
    { h: tr('How long we keep it', 'Gaano katagal namin itinatago'), p: [tr('Account data is kept while you are enrolled or until you delete your account. Evaluation results are kept as part of your school’s records, without any link to you once your account is deleted.', 'Itinatago ang data ng account habang naka-enroll ka o hanggang burahin mo ang account. Itinatago ang resulta ng evaluation bilang bahagi ng records ng paaralan, nang walang koneksyon sa iyo kapag nabura na ang account mo.')] },
    { h: tr('Your rights', 'Ang mga karapatan mo'), p: [tr('You can see and download your data (Settings → Download my data), correct it (ask the admin), and delete your account (Settings → Delete account). You may also complain to the National Privacy Commission.', 'Puwede mong makita at i-download ang data mo (Settings → I-download ang data ko), ipaayos ito (sa admin), at burahin ang account (Settings → Burahin ang account). Puwede ka ring magreklamo sa National Privacy Commission.')] },
    { h: tr('Security', 'Seguridad'), p: [tr('Connections are encrypted, passwords are stored hashed, sign-ins expire, and repeated wrong passwords lock the account for a short time.', 'Naka-encrypt ang koneksyon, naka-hash ang password, nag-e-expire ang sign-in, at nala-lock saglit ang account kapag paulit-ulit na mali ang password.')] },
  ];
}

/** Terms of Use and Privacy Policy. Public pages (also linked from the store listing). */
export default function LegalScreen({ doc }: { doc: 'terms' | 'privacy' }) {
  const router = useRouter();
  const wide = useIsWide();
  const user = useAuth((s) => s.user);
  const info = useAppInfo();
  // Signed out there's no particular school: the pages speak about "your school".
  const school = info.data?.school?.name ?? tr('your school', 'ang paaralan mo');
  const dpo = info.data?.dpo_email ?? 'the Data Protection Officer';
  const title = doc === 'terms' ? tr('Terms of Use', 'Mga Tuntunin ng Paggamit') : tr('Privacy Policy', 'Privacy Policy');
  const blocks = doc === 'terms' ? terms(school) : privacy(school, dpo);
  useTitle(title);

  return (
    <View style={{ flex: 1, backgroundColor: colors.frame }}>
      <View style={{ paddingHorizontal: wide ? 40 : space.lg, paddingTop: wide ? 28 : 44, paddingBottom: space.lg }}>
        <Logo size={wide ? 46 : 38} onDark />
      </View>
      <ScrollView style={{ flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 }} contentContainerStyle={{ padding: wide ? 40 : space.lg, paddingBottom: 60, width: '100%', maxWidth: 820, alignSelf: 'center', gap: space.lg }}>
        <View style={{ gap: 4 }}>
          <Txt weight="bold" size={wide ? text.h1 : text.h2} accessibilityRole="header">{title}</Txt>
          <Txt size={text.small} color={colors.muted}>{tr(`Last updated ${UPDATED}`, `Huling na-update ${UPDATED}`)}</Txt>
        </View>
        <View style={[{ backgroundColor: colors.card, borderRadius: 24, padding: wide ? space.xxl : space.lg, gap: space.lg }, shadowStyle('soft')]}>
          {blocks.map((b) => (
            <View key={b.h} style={{ gap: 6 }}>
              <Txt weight="semibold" size={text.title} accessibilityRole="header">{b.h}</Txt>
              {b.p.map((p) => (
                <Txt key={p} size={text.bodyLg} color={colors.textSoft} style={{ lineHeight: 24 }}>{p}</Txt>
              ))}
            </View>
          ))}
        </View>
        <Button title={tr('Back', 'Bumalik')} variant="outline" onPress={() => (router.canGoBack() ? router.back() : router.replace(user ? homeFor(user.role) : '/login'))} style={{ alignSelf: 'flex-start' }} />
      </ScrollView>
    </View>
  );
}
