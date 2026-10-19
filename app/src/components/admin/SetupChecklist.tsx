import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAdminSchool, useSaveSchool, type SetupStep } from '@/api/admin';
import { useAuth } from '@/auth/store';
import { tr } from '@/lib/i18n';
import { tap } from '@/lib/ui';
import { colors, shadowStyle, space, text } from '@/theme';
import { Button } from '../Button';
import { Icon, type IconName } from '../Icon';
import { ProgressBar } from '../ProgressRing';
import { Txt } from '../Txt';
import { WiseMascot } from '../WiseMascot';

const STEPS: Record<SetupStep['key'], { icon: IconName; title: () => string; hint: () => string; href: string }> = {
  profile: { icon: 'book', title: () => tr('School profile and contacts', 'Profile at contact ng paaralan'), hint: () => tr('Place, logo and a help email', 'Lugar, logo at help email'), href: '/admin/school' },
  departments: { icon: 'layers', title: () => tr('Departments and programs', 'Mga departamento at programa'), hint: () => tr('e.g. College of Computer Studies → BSIT', 'hal. College of Computer Studies → BSIT'), href: '/admin/academics?tab=departments' },
  semester: { icon: 'calendar', title: () => tr('Current semester', 'Kasalukuyang semestre'), hint: () => tr('So dashboards show this term’s classes', 'Para ipakita ang mga klase ngayong term'), href: '/admin/academics?tab=semesters' },
  teachers: { icon: 'users', title: () => tr('Invite your teachers', 'Imbitahan ang mga guro'), hint: () => tr('Paste their names, send each a code', 'I-paste ang pangalan, padalhan ng code'), href: '/admin/users?invite=1' },
  classes: { icon: 'grid', title: () => tr('Sections and classes', 'Mga section at klase'), hint: () => tr('Who teaches what to which section (paste from Excel)', 'Sino ang nagtuturo ng ano sa aling section'), href: '/admin/academics?tab=classes' },
  students: { icon: 'shield', title: () => tr('Approved student IDs', 'Mga aprubadong student ID'), hint: () => tr('Paste the registrar’s list; students sign up themselves', 'I-paste ang listahan; mag-sign up ang estudyante'), href: '/admin/ids' },
  period: { icon: 'clipboard', title: () => tr('First evaluation period', 'Unang evaluation period'), hint: () => tr('Everyone is notified when it opens', 'Maaabisuhan ang lahat pagbukas'), href: '/admin/evaluation' },
};

/** Getting a new school ready, step by step. Disappears once the admin marks it done. */
export function SetupChecklist() {
  const router = useRouter();
  const q = useAdminSchool();
  const save = useSaveSchool();
  const setSchool = useAuth((s) => s.setSchool);
  const setup = q.data?.setup;
  if (!setup || setup.completed) return null;
  const next = setup.steps.find((s) => !s.done);
  const all = setup.done === setup.total;

  const finish = () =>
    save.mutate({ settings: { setup_completed: true } }, { onSuccess: (r) => setSchool(r.school) });

  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: 28, padding: space.lg, gap: space.md }, shadowStyle('soft')]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <WiseMascot size={84} mood={all ? 'party' : 'teach'} float={false} shadow={false} />
        <View style={{ flex: 1, gap: 6 }}>
          <Txt weight="bold" size={text.title} accessibilityRole="header">{all ? tr('Your school is set up', 'Naka-set up na ang paaralan mo') : tr('Set up your school', 'I-set up ang paaralan mo')}</Txt>
          <Txt size={text.small} color={colors.muted}>{tr(`${setup.done} of ${setup.total} done · about 30 minutes in total`, `${setup.done} sa ${setup.total} tapos · mga 30 minuto lahat`)}</Txt>
          <ProgressBar value={setup.done / setup.total} height={8} />
        </View>
      </View>
      <View style={{ gap: 2 }}>
        {setup.steps.map((s) => {
          const meta = STEPS[s.key];
          const current = next?.key === s.key;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityState={{ checked: s.done }}
              onPress={() => {
                tap();
                router.push(meta.href as Href);
              }}
              style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: 10, borderRadius: 16, backgroundColor: current ? colors.brandSoft : hovered ? colors.surface : 'transparent' })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? colors.successBg : colors.chip }}>
                <Icon name={s.done ? 'check' : meta.icon} size={17} color={s.done ? colors.successFg : colors.accent} strokeWidth={s.done ? 2.6 : 1.9} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight={current ? 'semibold' : 'medium'} size={text.body} color={s.done ? colors.muted : colors.text} style={s.done ? { textDecorationLine: 'line-through' } : undefined}>{meta.title()}</Txt>
                {!s.done && <Txt size={text.small} color={colors.muted}>{meta.hint()}</Txt>}
              </View>
              {!s.done && <Icon name="chevronRight" size={16} color={colors.muted} strokeWidth={2.2} />}
            </Pressable>
          );
        })}
      </View>
      <Button title={all ? tr('Finish setup', 'Tapusin ang setup') : tr('Hide this checklist', 'Itago ang checklist')} variant={all ? 'primary' : 'outline'} loading={save.isPending} onPress={finish} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}
