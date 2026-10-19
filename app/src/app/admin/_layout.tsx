import { Stack } from 'expo-router';
import { useAdminCounts, useAdminDashboard } from '@/api/admin';
import { useAuth } from '@/auth/store';
import { RoleGate } from '@/components/RoleGate';
import { Shell, type NavItem, type PhoneTabs } from '@/components/Shell';
import type { WiseTip } from '@/components/WiseLauncher';
import { tr } from '@/lib/i18n';

const MANAGE = ['/admin/academics', '/admin/evaluation', '/admin/ids', '/admin/reports', '/admin/activity', '/admin/school', '/admin/profile', '/admin/settings', '/admin/help'];

export default function AdminLayout() {
  return (
    <RoleGate role="admin">
      <AdminShell />
    </RoleGate>
  );
}

function AdminShell() {
  const counts = useAdminCounts();
  const dash = useAdminDashboard();
  const dept = useAuth((s) => s.user?.admin_scope === 'department');
  const requests = counts.passwords + counts.inbox;

  // Department admins (deans, chairs) manage people and classes in their department only.
  const people = tr('People', 'Mga tao');
  const evaluation = tr('Evaluation', 'Evaluation');
  const schoolGroup = tr('School', 'Paaralan');
  const nav: NavItem[] = [
    { href: '/admin', icon: 'grid', label: tr('Overview', 'Overview') },
    { href: '/admin/users', icon: 'users', label: tr('People', 'Mga tao'), group: people },
    { href: '/admin/ids', icon: 'shield', label: tr('Approved IDs', 'Mga aprubadong ID'), group: people },
    { href: '/admin/requests', icon: 'inbox', label: tr('Requests', 'Mga request'), badge: requests, group: people },
    { href: '/admin/academics', icon: 'book', label: tr('Classes & sections', 'Klase at section'), group: evaluation },
    ...(dept ? [] : [{ href: '/admin/evaluation', icon: 'clipboard', label: tr('Evaluation setup', 'Setup ng evaluation'), group: evaluation } as NavItem]),
    { href: '/admin/reports', icon: 'barChart', label: tr('Reports', 'Mga report'), group: evaluation },
    ...(dept
      ? []
      : [
          { href: '/admin/activity', icon: 'activity', label: tr('Activity', 'Aktibidad'), group: schoolGroup } as NavItem,
          { href: '/admin/school', icon: 'settings2', label: tr('School settings', 'Settings ng paaralan'), group: schoolGroup } as NavItem,
        ]),
  ];

  const phoneTabs: PhoneTabs = {
    left: [
      { href: '/admin', icon: 'grid', label: tr('Overview', 'Overview') },
      { href: '/admin/users', icon: 'users', label: tr('People', 'Mga tao') },
    ],
    center: { href: '/admin/wise', label: tr('Ask Wise', 'Tanong') },
    right: [
      { href: '/admin/requests', icon: 'inbox', label: tr('Requests', 'Request'), badge: requests },
      { href: '/admin/account', icon: 'user', label: tr('Manage', 'Pamahalaan'), match: MANAGE },
    ],
  };

  const tipFor = (path: string): WiseTip | null => {
    const d = dash.data;
    if (path === '/admin') {
      if (!d) return null;
      if (requests > 0) return { text: tr(`You have **${requests} request${requests > 1 ? 's' : ''}** waiting in Requests.`, `May **${requests} request** na naghihintay sa Requests.`), mood: 'point' };
      if (d.period?.is_open && d.completion.percent < 100) return { text: tr(`Completion is **${d.completion.percent}%**. A reminder usually helps.`, `**${d.completion.percent}%** pa lang ang tapos. Nakakatulong ang paalala.`), mood: 'lecture' };
      if (!d.period) return { text: tr('No evaluation period yet. Set one up in **Evaluation setup**.', 'Wala pang evaluation period. Gumawa sa **Setup ng evaluation**.'), mood: 'idea' };
      return null;
    }
    if (path.startsWith('/admin/ids')) return { text: tr('Paste IDs from a spreadsheet: **one per line**, with name and section if you have them.', 'I-paste ang mga ID mula sa spreadsheet: **isa bawat linya**, kasama ang pangalan at section kung meron.'), mood: 'teach' };
    if (path.startsWith('/admin/evaluation')) return { text: tr('Students are notified **automatically** when a period opens.', '**Kusang** naaabisuhan ang mga estudyante kapag nagbukas ang period.'), mood: 'wink' };
    if (path.startsWith('/admin/requests')) return { text: tr('Check the person’s **ID and section** before giving a temporary password.', 'I-check ang **ID at section** ng tao bago magbigay ng temporary password.'), mood: 'stern' };
    return null;
  };

  return (
    <Shell
      nav={nav}
      settingsItem={{ href: '/admin/settings', icon: 'settings', label: tr('Settings', 'Settings') }}
      phoneTabs={phoneTabs}
      wise={{ subtitle: tr('Admin helper', 'Katulong ng admin'), placeholder: tr('Ask about running evaluations…', 'Magtanong tungkol sa pagpapatakbo ng evaluation…'), chatHref: '/admin/wise' }}
      tipFor={tipFor}
    >
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
    </Shell>
  );
}
