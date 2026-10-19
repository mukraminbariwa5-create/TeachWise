import { useState, type ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { Modal, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { routeFor, useAuth } from '@/auth/store';
import { colors, fonts, shadowStyle } from '@/theme';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';
import { NotificationBell } from './NotificationBell';
import { Txt } from './Txt';


/**
 * Header row from the reference design:
 * "Dashboard" + search pill on the left; round black action, bell and the user on the right.
 */
export function PageHeader({
  title,
  search,
  action,
  children,
}: {
  title: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  action?: { icon: IconName; label: string; onPress: () => void };
  children?: ReactNode;
}) {
  const user = useAuth((s) => s.user);
  const { width } = useWindowDimensions();
  // Laptops (1100–1320px): tighter gaps and just the avatar, so the row never wraps.
  const tight = width < 1320;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tight ? 18 : 34 }}>
      <Txt weight="bold" size={tight ? 30 : 34} accessibilityRole="header" numberOfLines={1} style={{ letterSpacing: -0.3, flexShrink: 0 }}>{title}</Txt>
      {search && (
        <View style={{ flexShrink: 1, flexBasis: 380, minWidth: 150 }}>
          <SearchPill {...search} />
        </View>
      )}
      {children}
      <View style={{ flex: 1, minWidth: 0 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tight ? 12 : 22, flexShrink: 0 }}>
        {action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ hovered }: { hovered?: boolean }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inverse, alignItems: 'center', justifyContent: 'center', transform: [{ scale: hovered ? 1.08 : 1 }] })}
          >
            <Icon name={action.icon} size={18} color={colors.onInverse} strokeWidth={2.4} />
          </Pressable>
        )}
        <NotificationBell />
        {user && <ProfileMenu compact={tight} />}
      </View>
    </View>
  );
}

export function SearchPill({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  placeholder = placeholder ?? tr('Search', 'Maghanap');
  return (
    <View style={[{ width: '100%', height: 56, borderRadius: 999, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24 }, shadowStyle('soft')]}>
      <Icon name="search" size={24} color={colors.muted} strokeWidth={1.6} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={placeholder}
        style={{ flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.regular, fontSize: 18, color: colors.text }}
      />
    </View>
  );
}

/** The name next to the avatar: in full when it fits ("Aisha Tan", "DSU Registrar"), else "Aisha T". */
function shortName(name: string) {
  const clean = name.replace(/^(prof|dr|mr|ms|mrs|engr)\.?\s+/i, '').trim();
  if (clean.length <= 16) return clean;
  const [first, second] = clean.split(/\s+/);
  return second ? `${first} ${second[0]}.` : first;
}

/** Page title inside the phone panel: optional back button and title. */
export function AppBar({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Back', 'Bumalik')}
          onPress={onBack}
          style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, shadowStyle('soft')]}
        >
          <Icon name="arrowLeft" size={20} strokeWidth={2} />
        </Pressable>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {subtitle && <Txt size={14} color={colors.muted}>{subtitle}</Txt>}
        <Txt weight="bold" size={26} numberOfLines={1} accessibilityRole="header">{title}</Txt>
      </View>
      {right}
    </View>
  );
}

/** The avatar + name in the top-right corner. Click it for a small menu. */
function ProfileMenu({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const items: { icon: IconName; label: string; onPress: () => void; danger?: boolean }[] = [
    { icon: 'user', label: tr('Profile', 'Profile'), onPress: () => router.push(routeFor(user.role, 'profile') as Href) },
    { icon: 'settings', label: tr('Settings', 'Settings'), onPress: () => router.push(routeFor(user.role, 'settings') as Href) },
    { icon: 'help', label: tr('Help & feedback', 'Tulong at feedback'), onPress: () => router.push(routeFor(user.role, 'help') as Href) },
    { icon: 'logout', label: tr('Log out', 'Mag-log out'), onPress: () => confirmLogout(logout), danger: true },
  ];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(`Account menu for ${user.name}`, `Account menu ni ${user.name}`)}
        onPress={() => setOpen(true)}
        style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: compact ? 6 : 12, paddingVertical: 4, paddingLeft: 4, paddingRight: compact ? 8 : 12, borderRadius: 999, backgroundColor: hovered || open ? colors.track : 'transparent' })}
      >
        <Avatar name={user.name} initials={user.initials} size={44} />
        {!compact && <Txt weight="semibold" size={18} color={colors.textSoft} numberOfLines={1}>{shortName(user.name)}</Txt>}
        <Icon name="chevronDown" size={16} color={colors.textSoft} strokeWidth={2.2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel={tr('Close menu', 'Isara ang menu')} onPress={() => setOpen(false)} style={{ flex: 1 }}>
          <Pressable onPress={() => {}} style={[{ position: 'absolute', top: 104, right: 60, width: 260, backgroundColor: colors.card, borderRadius: 22, padding: 8, borderWidth: 1, borderColor: colors.borderSoft }, shadowStyle('lift')]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, marginBottom: 6 }}>
              <Avatar name={user.name} initials={user.initials} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="semibold" size={15} numberOfLines={1}>{user.name}</Txt>
                <Txt size={13} color={colors.muted} numberOfLines={1}>{user.section?.label ?? user.department ?? `@${user.username}`}</Txt>
              </View>
            </View>
            {items.map((it) => (
              <View key={it.label}>
              {it.danger && <View style={{ height: 1, backgroundColor: colors.borderSoft, marginVertical: 6 }} />}
              <Pressable
                accessibilityRole="menuitem"
                onPress={() => {
                  setOpen(false);
                  it.onPress();
                }}
                style={({ hovered }: { hovered?: boolean }) => ({ height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, backgroundColor: hovered ? colors.surface : 'transparent' })}
              >
                <Icon name={it.icon} size={19} color={it.danger ? colors.danger : colors.textSoft} />
                <Txt weight="medium" size={15} color={it.danger ? colors.danger : colors.text}>{it.label}</Txt>
              </Pressable>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Log out after a quick confirmation (used by the menu, Account and Settings). */
export async function confirmLogout(logout: () => Promise<void>) {
  const { confirm } = await import('./ui');
  if (await confirm({ title: tr('Log out?', 'Mag-log out?'), message: tr('You’ll need your password to sign in again.', 'Kakailanganin mo ang password para mag-sign in ulit.'), confirmLabel: tr('Log out', 'Mag-log out'), mood: 'hello' })) {
    await logout();
  }
}
