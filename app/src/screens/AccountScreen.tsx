import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { routeFor, useAuth } from '@/auth/store';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { confirmLogout } from '@/components/PageHeader';
import { Txt } from '@/components/Txt';
import { ListRow, Section, Screen } from '@/components/ui';
import { APP_VERSION } from '@/lib/appInfo';
import { useUI } from '@/lib/ui';
import { tr } from '@/lib/i18n';
import { colors, shadowStyle, space, text } from '@/theme';

/** The phone's Account tab: your card, then Profile, Settings, Help and Log out. */
export default function AccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  if (!user) return null;
  const go = (page: 'profile' | 'settings' | 'help') => router.push(routeFor(user.role, page) as Href);

  return (
    <Screen title={tr('Account', 'Account')}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(`${user.name}. Open profile`, `${user.name}. Buksan ang profile`)}
        onPress={() => go('profile')}
        style={({ pressed }: { pressed?: boolean }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderRadius: 24, padding: space.md, transform: [{ scale: pressed ? 0.98 : 1 }] }, shadowStyle('soft')]}
      >
        <Avatar name={user.name} initials={user.initials} size={60} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="bold" size={text.title} numberOfLines={1}>{user.name}</Txt>
          <Txt size={text.small} color={colors.muted} numberOfLines={1}>{[user.id_number, user.section?.label ?? user.department].filter(Boolean).join(' · ')}</Txt>
        </View>
        <Icon name="chevronRight" size={18} color={colors.muted} strokeWidth={2.2} />
      </Pressable>

      {user.role === 'platform' && (
        <Section title={tr('TeachWise', 'TeachWise')}>
          <ListRow icon="activity" title={tr('App health', 'Kalusugan ng app')} subtitle={tr('Errors reported by the app', 'Mga error na iniulat ng app')} onPress={() => router.push('/platform/errors')} last />
        </Section>
      )}

      {user.role === 'admin' && (
        <Section title={tr('Manage', 'Pamahalaan')}>
          <ListRow icon="book" title={tr('Classes & sections', 'Klase at section')} onPress={() => router.push('/admin/academics')} />
          {user.admin_scope !== 'department' && <ListRow icon="settings2" title={tr('School settings', 'Settings ng paaralan')} onPress={() => router.push('/admin/school')} />}
          {user.admin_scope !== 'department' && <ListRow icon="clipboard" title={tr('Evaluation setup', 'Setup ng evaluation')} onPress={() => router.push('/admin/evaluation')} />}
          <ListRow icon="shield" title={tr('Approved IDs', 'Mga aprubadong ID')} onPress={() => router.push('/admin/ids')} />
          <ListRow icon="barChart" title={tr('Reports', 'Mga report')} onPress={() => router.push('/admin/reports')} />
          {user.admin_scope !== 'department' && <ListRow icon="activity" title={tr('Activity', 'Aktibidad')} onPress={() => router.push('/admin/activity')} />}
          <ListRow icon="bell" title={tr('Notifications', 'Mga notification')} onPress={() => useUI.getState().setNotificationsOpen(true)} last />
        </Section>
      )}

      {user.role === 'teacher' && (
        <Section>
          <ListRow icon="barChart" title={tr('My report', 'Report ko')} subtitle={tr('Full results, print or share', 'Buong resulta, i-print o i-share')} onPress={() => router.push('/teacher/report')} last />
        </Section>
      )}

      <Section>
        <ListRow icon="user" title={tr('Profile', 'Profile')} subtitle={tr('Details, password, devices', 'Detalye, password, mga device')} onPress={() => go('profile')} />
        <ListRow icon="settings" title={tr('Settings', 'Settings')} subtitle={tr('Appearance, language, notifications', 'Itsura, wika, notifications')} onPress={() => go('settings')} />
        <ListRow icon="help" title={tr('Help & feedback', 'Tulong at feedback')} onPress={() => go('help')} last />
      </Section>

      <Section>
        <ListRow icon="logout" title={tr('Log out', 'Mag-log out')} danger onPress={() => confirmLogout(logout)} last />
      </Section>

      <Txt size={text.caption} color={colors.muted} style={{ textAlign: 'center' }}>{`TeachWise v${APP_VERSION}`}</Txt>
    </Screen>
  );
}
