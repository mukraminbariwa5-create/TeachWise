import { Stack } from 'expo-router';
import { useStudentDashboard } from '@/api/hooks';
import { RoleGate } from '@/components/RoleGate';
import { Shell, type NavItem, type PhoneTabs } from '@/components/Shell';
import type { WiseTip } from '@/components/WiseLauncher';
import { tr } from '@/lib/i18n';
import { useUI } from '@/lib/ui';

/** Built when rendered, so the labels follow the chosen language. */
const navItems = (): NavItem[] => [
  { href: '/student', icon: 'home', label: tr('Home', 'Home') },
  { href: '/student/wise', icon: 'chat', label: tr('Ask Wise', 'Tanong'), tourId: 'ask' },
  { href: '/student/history', icon: 'clock', label: tr('History', 'Kasaysayan') },
];

const settingsItem = (): NavItem => ({ href: '/student/settings', icon: 'settings', label: tr('Settings', 'Settings') });

/** Phone: Home · History · (Professor Wise) · Alerts · Account */
const phoneTabs = (): PhoneTabs => ({
  left: [
    { href: '/student', icon: 'home', label: tr('Home', 'Home') },
    { href: '/student/history', icon: 'clock', label: tr('History', 'Kasaysayan') },
  ],
  center: { href: '/student/wise', label: tr('Ask Wise', 'Tanong') },
  right: [
    { icon: 'bell', label: tr('Alerts', 'Abiso'), onPress: () => useUI.getState().setNotificationsOpen(true) },
    { href: '/student/account', icon: 'user', label: tr('Account', 'Account'), match: ['/student/profile', '/student/settings', '/student/help'] },
  ],
});

export default function StudentLayout() {
  return (
    <RoleGate role="student">
      <StudentShell />
    </RoleGate>
  );
}

function StudentShell() {
  const dash = useStudentDashboard();

  /** Professor Wise's tip for each page, like Dala's in Padala. */
  const tipFor = (path: string): WiseTip | null => {
    const d = dash.data;
    if (path === '/student') {
      if (!d) return null;
      const pending = d.progress.total - d.progress.completed;
      if (!d.period) return { text: tr('No evaluation is open yet. I’ll **let you know** when one starts.', 'Wala pang bukas na evaluation. **Sasabihan kita** kapag nagsimula na.'), mood: 'working' };
      if (pending === 0) return { text: tr('All done! **Thank you** for helping your teachers improve.', 'Tapos na lahat! **Salamat** sa pagtulong sa mga guro mo.'), mood: 'party' };
      return {
        text: tr(
          `You have **${pending} teacher${pending > 1 ? 's' : ''}** left. Tap **Evaluate Now** and I’ll walk you through it.`,
          `May **${pending} guro** ka pang natitira. Pindutin ang **Evaluate Now** at gagabayan kita.`
        ),
        mood: 'lecture',
      };
    }
    if (path.startsWith('/student/evaluate')) return { text: tr('Rate what you **really** experienced. Your teacher **never sees your name**.', 'I-rate ang **totoong** naranasan mo. **Hindi makikita** ng guro ang pangalan mo.'), mood: 'teach' };
    if (path.startsWith('/student/history')) return { text: tr('These are the evaluations you’ve **sent**. They can’t be changed, to keep things fair.', 'Ito ang mga evaluation na **naipasa** mo. Hindi na ito mababago para patas.'), mood: 'writing' };
    if (path.startsWith('/student/settings')) return { text: tr('Pick **dark mode**, **Filipino**, and which **notifications** you want here.', 'Dito pumili ng **dark mode**, **Filipino**, at kung anong **notifications** ang gusto mo.'), mood: 'wink' };
    return null;
  };

  return (
    <Shell
      nav={navItems()}
      settingsItem={settingsItem()}
      phoneTabs={phoneTabs()}
      wise={{ subtitle: tr('Evaluation helper', 'Katulong sa evaluation'), placeholder: tr('Ask about evaluations…', 'Magtanong tungkol sa evaluation…'), chatHref: '/student/wise' }}
      tipFor={tipFor}
      hideTabsOn={(path) => path.startsWith('/student/evaluate')}
    >
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
    </Shell>
  );
}
