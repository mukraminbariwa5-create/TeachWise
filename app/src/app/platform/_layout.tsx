import { Stack } from 'expo-router';
import { usePlatformOverview } from '@/api/platform';
import { RoleGate } from '@/components/RoleGate';
import { Shell, type NavItem, type PhoneTabs } from '@/components/Shell';
import { tr } from '@/lib/i18n';

/** The TeachWise owner's console: schools and app health. No Professor Wise here. */
export default function PlatformLayout() {
  return (
    <RoleGate role="platform">
      <PlatformShell />
    </RoleGate>
  );
}

function PlatformShell() {
  const overview = usePlatformOverview();
  const pending = overview.data?.schools.pending ?? 0;
  const messages = overview.data?.open_messages ?? 0;

  const nav: NavItem[] = [
    { href: '/platform', icon: 'grid', label: tr('Overview', 'Overview') },
    { href: '/platform/schools', icon: 'book', label: tr('Schools', 'Mga paaralan'), badge: pending },
    { href: '/platform/messages', icon: 'inbox', label: tr('Messages', 'Mga mensahe'), badge: messages },
    { href: '/platform/errors', icon: 'activity', label: tr('App health', 'Kalusugan ng app') },
  ];
  const phoneTabs: PhoneTabs = {
    left: nav.slice(0, 2),
    right: [nav[2], { href: '/platform/account', icon: 'user', label: tr('Account', 'Account'), match: ['/platform/profile', '/platform/settings', '/platform/help', '/platform/errors'] }],
  };

  return (
    <Shell nav={nav} settingsItem={{ href: '/platform/settings', icon: 'settings', label: tr('Settings', 'Settings') }} phoneTabs={phoneTabs}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
    </Shell>
  );
}
