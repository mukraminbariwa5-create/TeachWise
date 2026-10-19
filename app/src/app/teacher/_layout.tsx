import { Stack } from 'expo-router';
import { useTeacherDashboard } from '@/api/hooks';
import { weakestCriterion } from '@/components/Charts';
import { RoleGate } from '@/components/RoleGate';
import { Shell, type NavItem, type PhoneTabs } from '@/components/Shell';
import type { WiseTip } from '@/components/WiseLauncher';
import { tr } from '@/lib/i18n';
import { useUI } from '@/lib/ui';

const navItems = (): NavItem[] => [
  { href: '/teacher', icon: 'home', label: tr('Home', 'Home') },
  { href: '/teacher/feedback', icon: 'chat', label: tr('Feedback', 'Feedback') },
  { href: '/teacher/report', icon: 'barChart', label: tr('My report', 'Report ko') },
  { href: '/teacher/wise', icon: 'glasses', label: tr('Ask Wise', 'Tanong') },
];

const settingsItem = (): NavItem => ({ href: '/teacher/settings', icon: 'settings', label: tr('Settings', 'Settings') });

/** Phone: Home · Feedback · (Professor Wise) · Alerts · Account */
const phoneTabs = (): PhoneTabs => ({
  left: [
    { href: '/teacher', icon: 'home', label: tr('Home', 'Home') },
    { href: '/teacher/feedback', icon: 'chat', label: tr('Feedback', 'Feedback') },
  ],
  center: { href: '/teacher/wise', label: tr('Ask Wise', 'Tanong') },
  right: [
    { icon: 'bell', label: tr('Alerts', 'Abiso'), onPress: () => useUI.getState().setNotificationsOpen(true) },
    { href: '/teacher/account', icon: 'user', label: tr('Account', 'Account'), match: ['/teacher/profile', '/teacher/settings', '/teacher/help', '/teacher/report'] },
  ],
});

export default function TeacherLayout() {
  return (
    <RoleGate role="teacher">
      <TeacherShell />
    </RoleGate>
  );
}

function TeacherShell() {
  const dash = useTeacherDashboard();

  const tipFor = (path: string): WiseTip | null => {
    const d = dash.data;
    if (path === '/teacher') {
      if (!d) return null;
      const pendingPeers = d.peer_period?.is_open ? d.peers.filter((p) => p.status === 'pending').length : 0;
      if (pendingPeers > 0) return { text: tr(`**${pendingPeers} colleague${pendingPeers > 1 ? 's' : ''}** still waiting for your peer evaluation.`, `May **${pendingPeers} kasamahan** pang naghihintay ng peer evaluation mo.`), mood: 'point' };
      const weak = weakestCriterion(d.criteria);
      if (weak) return { text: tr(`Your students rate **${weak.category}** lowest. Ask me for ideas to improve it.`, `Pinakamababa ang **${weak.category}** sa rating ng mga estudyante. Magtanong sa akin ng mga ideya.`), mood: 'idea' };
      return { text: tr('Results appear here as soon as students submit.', 'Lalabas dito ang resulta agad pagkapasa ng mga estudyante.'), mood: 'working' };
    }
    if (path.startsWith('/teacher/feedback')) return { text: tr('Comments are **anonymous**. Look for patterns, not one-off remarks.', '**Anonymous** ang mga komento. Hanapin ang pattern, hindi ang iisang puna.'), mood: 'teach' };
    if (path.startsWith('/teacher/report')) return { text: tr('Use **Print** to save this report as a **PDF** for your portfolio.', 'Gamitin ang **Print** para i-save ito bilang **PDF** para sa portfolio mo.'), mood: 'writing' };
    if (path.startsWith('/teacher/peers')) return { text: tr('Be fair and specific. Your colleague **won’t see your name**.', 'Maging patas at tiyak. **Hindi makikita** ng kasamahan mo ang pangalan mo.'), mood: 'teach' };
    return null;
  };

  return (
    <Shell
      nav={navItems()}
      settingsItem={settingsItem()}
      phoneTabs={phoneTabs()}
      wise={{ subtitle: tr('Teaching coach', 'Coach sa pagtuturo'), placeholder: tr('Ask about your results…', 'Magtanong tungkol sa resulta mo…'), chatHref: '/teacher/wise' }}
      tipFor={tipFor}
      hideTabsOn={(path) => path.startsWith('/teacher/peers')}
    >
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
    </Shell>
  );
}
