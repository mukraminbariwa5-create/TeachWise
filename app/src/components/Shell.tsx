import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { Animated, Easing, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useNotifications } from '@/api/hooks';
import type { SchoolInfo } from '@/api/types';
import { routeFor, useAuth } from '@/auth/store';
import { useLayoutSize } from '@/lib/useLayout';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { tap, useUI } from '@/lib/ui';
import { colors, shadowStyle } from '@/theme';
import { Icon, type IconName } from './Icon';
import { LogoMark, Wordmark } from './Logo';
import { NotificationsSheet, useNotificationToasts } from './NotificationBell';
import { OfflineBanner } from './OfflineBanner';
import { SchoolBadge } from './SchoolBadge';
import { TourOverlay, TourTarget } from './Tour';
import { Txt } from './Txt';
import { DockedWiseChat, TipBubble, useTipBubble, WiseLauncher, type WiseTip } from './WiseLauncher';
import { WiseHead } from './WiseMascot';
import { Avatar } from './Avatar';
import { PageTransition } from './Motion';
import { NavigationDrawer } from './NavigationDrawer';

export interface NavItem {
  /** Page to open. Leave out for actions such as "Alerts". */
  href?: string;
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** Small red count, e.g. unread notifications. */
  badge?: number;
  /** Lets the guided tour point at this button. */
  tourId?: string;
  /** Other pages that count as this tab (e.g. Profile and Settings under Account). */
  match?: string[];
  /** Heading shown above this item in the open sidebar (only on the first item of each group). */
  group?: string;
}

export interface PhoneTabs {
  left: NavItem[];
  /** The raised Professor Wise button in the middle (left out for the TeachWise owner). */
  center?: { href: string; label: string };
  right: NavItem[];
}

interface Props {
  nav: NavItem[];
  /** Pinned at the bottom of the computer sidebar. */
  settingsItem: NavItem;
  phoneTabs: PhoneTabs;
  wise?: { subtitle: string; placeholder?: string; chatHref: string };
  /** Professor Wise's tip for the current page (null hides the bubble). */
  tipFor?: (path: string) => WiseTip | null;
  /** Routes where the phone bottom bar is hidden, e.g. the evaluation form. */
  hideTabsOn?: (path: string) => boolean;
  children: ReactNode;
}

const native = Platform.OS !== 'web';

/**
 * Light, responsive app canvas: a permanent compact computer/tablet rail,
 * and a five-tab phone bar with Professor Wise raised gently in the center.
 */
export function Shell({ nav, settingsItem, phoneTabs, wise, tipFor, hideTabsOn, children }: Props) {
  const size = useLayoutSize();
  const keyboardVisible = useKeyboardVisible();
  const path = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useNotificationToasts();

  const school = useAuth((s) => s.school);
  const home = nav[0]?.href ?? '/';
  const allItems = [...nav, settingsItem, ...phoneTabs.left, ...phoneTabs.right];
  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === home ? path === href : path.startsWith(href)) return true;
    return !!allItems.find((i) => i.href === href)?.match?.some((m) => path.startsWith(m));
  };
  const go = (item: NavItem) => {
    tap();
    if (item.onPress) item.onPress();
    else if (item.href) router.navigate(item.href as Href);
  };
  const tip = tipFor?.(path) ?? null;
  const { width } = useWindowDimensions();
  const wiseOpen = useUI((st) => st.wiseOpen);
  const wisePage = !!wise && path === wise.chatHref;
  const showTabs = !(hideTabsOn?.(path) ?? false);
  const user = useAuth((s) => s.user);
  const hasMobileNavigation = user?.role === 'admin';
  const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(() => { setNavigationOpen(false); }, [path, size, hasMobileNavigation]);
  const mobileItems: NavItem[] = [...nav.filter(item => !phoneTabs.center || item.href !== phoneTabs.center.href),
    settingsItem,
  ];

  if (size !== 'phone') {
    const docked = !!wise && wiseOpen && !wisePage && width >= 1440;
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View testID="app-navigation" accessibilityRole="menu" style={{ width: 72, flexShrink: 0, backgroundColor: colors.card, borderRightWidth: 1, borderColor: colors.borderSoft, zIndex: 10, alignItems: 'center', paddingTop: 16, paddingBottom: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={tr('TeachWise home', 'Home ng TeachWise')}
                onPress={() => router.navigate(home as Href)}
                style={({ hovered }: { hovered?: boolean }) => ({ alignItems: 'center', transform: [{ scale: hovered ? 1.04 : 1 }] })}
              >
                <LogoMark size={34} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1, alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
              {nav.map((item, i) => {
                const divider = i > 0 && item.group && item.group !== nav[i - 1]?.group;
                const el = <SideItem item={item} active={isActive(item.href)} compact onPress={() => go(item)} />;
                return (
                  <View key={item.label} style={{ alignItems: 'center' }}>
                    {divider && <View style={{ width: 28, height: 1, backgroundColor: colors.borderSoft, marginBottom: 10 }} />}
                    {item.tourId ? <TourTarget id={item.tourId}>{el}</TourTarget> : el}
                  </View>
                );
              })}
            </ScrollView>
            {school && <SchoolDot school={school} compact />}
            <SideItem item={settingsItem} active={isActive(settingsItem.href)} compact onPress={() => go(settingsItem)} />
          </View>
          <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <OfflineBanner />
            <PageTransition routeKey={path}>{children}</PageTransition>
          </View>
          {docked && wise && <DockedWiseChat subtitle={wise.subtitle} placeholder={wise.placeholder} />}
        </View>
        {wise && showTabs && !path.startsWith(wise.chatHref) && (
          <WiseLauncher
            subtitle={wise.subtitle}
            placeholder={wise.placeholder}
            tip={tip}
            tipKey={path}
            docked={width >= 1440}
            inset={{ right: 24, bottom: 24 }}
          />
        )}
        <NotificationsSheet />
        <TourOverlay />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      {showTabs && <View style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {hasMobileNavigation && <Pressable accessibilityRole="button" accessibilityLabel={tr('Open navigation', 'Buksan ang navigation')} aria-expanded={navigationOpen} onPress={() => setNavigationOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.brandSoft }}>
          <Icon name="menu" size={22} color={colors.accent} />
        </Pressable>}
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <LogoMark size={30} />
          <Wordmark size={21} />
        </View>
        {user && <Pressable accessibilityRole="button" accessibilityLabel={tr('Open account', 'Buksan ang account')} onPress={() => router.navigate(routeFor(user.role, 'account') as Href)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Avatar name={user.name} initials={user.initials} size={40} /></Pressable>}
      </View>}

      <View style={{ flex: 1, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <OfflineBanner />
        <PageTransition routeKey={path}>{children}</PageTransition>
      </View>

      {showTabs && !keyboardVisible && (
        <PhoneTabBar
          tabs={phoneTabs}
          isActive={isActive}
          onPress={go}
          tip={phoneTabs.center && !path.startsWith(phoneTabs.center.href) ? tip : null}
          tipKey={path}
          bottomInset={insets.bottom}
        />
      )}
      {hasMobileNavigation && <NavigationDrawer visible={navigationOpen} onClose={() => setNavigationOpen(false)}>
        {school && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
          <SchoolBadge school={school} size={38} />
          <Txt weight="semibold" size={15} style={{ flex: 1 }}>{school.name}</Txt>
        </View>}
        <View style={{ gap: 4 }}>
          {mobileItems.map((item) => {
            const active = path === item.href || (!!item.href && item.href !== home && path.startsWith(`${item.href}/`));
            return <Pressable
              key={item.href}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              aria-current={active ? 'page' : undefined}
              onPress={() => { setNavigationOpen(false); go(item); }}
              style={{ minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: active ? colors.brandSoft : colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              {item.icon === 'glasses' ? <WiseHead size={25} mood="wink" /> : <Icon name={item.icon} size={22} color={active ? colors.accent : colors.textSoft} />}
              <Txt size={15} weight={active ? 'semibold' : 'medium'} style={{ flex: 1 }}>{item.label}</Txt>
              {!!item.badge && <Txt size={13} color={colors.danger}>{item.badge}</Txt>}
            </Pressable>;
          })}
        </View>
      </NavigationDrawer>}
      <NotificationsSheet />
      <TourOverlay />
    </View>
  );
}

function SideItem({ item, active, compact, onPress }: { item: NavItem; active: boolean; compact: boolean; onPress: () => void }) {
  const d = 48;
  return (
    <Pressable
        ref={(node) => {
          // Native tooltips are not clipped by the rail's scroll container.
          if (Platform.OS === 'web') (node as unknown as HTMLElement | null)?.setAttribute('title', item.label);
        }}
      accessibilityRole="menuitem"
      accessibilityLabel={item.badge ? `${item.label} (${item.badge})` : item.label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: active ? colors.brandSoft : hovered ? colors.surface : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      {({ hovered }: { hovered?: boolean }) => (
        <>
          {item.icon === 'glasses' ? <WiseHead size={23} mood="wink" /> : <Icon name={item.icon} size={24} color={active ? colors.accent : colors.muted} strokeWidth={active ? 1.9 : 1.6} />}
          {!!item.badge && (
            <View style={{ position: 'absolute', top: active ? 8 : 2, right: active ? 8 : 0, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.alert, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.frame }}>
              <Txt weight="bold" size={11} color="#FFFFFF">{item.badge > 99 ? '99+' : String(item.badge)}</Txt>
            </View>
          )}
          {hovered && !native && (
            <View pointerEvents="none" style={{ position: 'absolute', left: d + 10, backgroundColor: colors.inverse, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, zIndex: 50 }}>
              <Txt weight="semibold" size={13} color={colors.onInverse} numberOfLines={1} style={{ whiteSpace: 'nowrap' } as object}>{item.label}</Txt>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

/** Icon sidebar: just the badge, with the school's name on hover. */
function SchoolDot({ school, compact }: { school: SchoolInfo; compact: boolean }) {
  return (
    <Pressable accessible accessibilityLabel={tr(`School: ${school.name}`, `Paaralan: ${school.name}`)} style={{ marginBottom: compact ? 12 : 18 }}>
      {({ hovered }: { hovered?: boolean }) => (
        <>
          <SchoolBadge school={school} size={38} />
          {hovered && !native && (
            <View pointerEvents="none" style={{ position: 'absolute', left: (compact ? 38 : 46) + 12, top: 4, backgroundColor: colors.inverse, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, zIndex: 50 }}>
              <Txt weight="semibold" size={13} color={colors.onInverse} numberOfLines={1} style={{ whiteSpace: 'nowrap' } as object}>{school.name}</Txt>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

/** Navy bottom bar. The middle slot is Professor Wise himself; page tips pop up above him. */
function PhoneTabBar({ tabs, isActive, onPress, tip, tipKey, bottomInset }: { tabs: PhoneTabs; isActive: (href?: string) => boolean; onPress: (i: NavItem) => void; tip: WiseTip | null; tipKey: string; bottomInset: number }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [bubble, setBubble] = useTipBubble(tip, tipKey);
  const { data } = useNotifications();
  const centerActive = !!tabs.center && isActive(tabs.center.href);
  const center = tabs.center;
  const pop = useRef(new Animated.Value(0)).current;

  // Professor Wise bobs up when he has something to say.
  useEffect(() => {
    if (!bubble || reduced) return;
    pop.setValue(0);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(pop, { toValue: 0, duration: 420, easing: Easing.bounce, useNativeDriver: native }),
    ]).start();
  }, [bubble, pop, reduced]);

  const unread = data?.unread ?? 0;
  const withBadges = (items: NavItem[]) => items.map((i) => (i.icon === 'bell' ? { ...i, badge: unread } : i));

  return (
    <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.borderSoft }}>
      {bubble && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 104 + bottomInset, alignItems: 'center', zIndex: 20 }}>
          <View>
            <TipBubble tip={bubble} onClose={() => setBubble(null)} tail="center" maxWidth={330} />
            <View style={{ alignSelf: 'center', width: 16, height: 16, backgroundColor: colors.card, transform: [{ rotate: '45deg' }], marginTop: -9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSoft }} />
          </View>
        </View>
      )}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6, paddingBottom: Math.max(8, bottomInset), paddingHorizontal: 4 }}>
        {withBadges(tabs.left).map((item) => (
          <TabButton key={item.label} item={item} active={isActive(item.href)} onPress={() => onPress(item)} />
        ))}

        {center && (
        <TourTarget id="ask" style={{ flex: 1.1, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={center.label}
            accessibilityState={{ selected: centerActive }}
            aria-selected={centerActive}
            onPress={() => {
              tap(18);
              setBubble(null);
              router.navigate(center.href as Href);
            }}
            style={({ pressed }: { pressed?: boolean }) => ({ alignItems: 'center', gap: 4, transform: [{ scale: pressed ? 0.94 : 1 }] })}
          >
            <Animated.View
              style={[
                {
                  width: 68,
                  height: 68,
                  marginTop: -23,
                  borderRadius: 34,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 3,
                  borderColor: colors.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }],
                },
                shadowStyle('lift'),
              ]}
            >
              <WiseHead size={42} mood={bubble ? 'laugh' : centerActive ? 'grin' : 'wink'} pop />
            </Animated.View>
            <Txt weight="semibold" size={11} color={colors.accent}>{center.label}</Txt>
          </Pressable>
        </TourTarget>
        )}

        {withBadges(tabs.right).map((item) => (
          <TabButton key={item.label} item={item} active={isActive(item.href)} onPress={() => onPress(item)} />
        ))}
      </View>
    </View>
  );
}

function TabButton({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.badge ? tr(`${item.label}, ${item.badge} new`, `${item.label}, ${item.badge} bago`) : item.label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => ({ flex: 1, minHeight: 52, alignItems: 'center', gap: 3, paddingBottom: 4, borderBottomWidth: 2, borderColor: active ? colors.brand : 'transparent', transform: [{ scale: pressed && !reduced ? 0.92 : 1 }] })}
    >
      <View style={{ width: 32, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={item.icon} size={23} color={active ? colors.accent : colors.muted} strokeWidth={active ? 2.2 : 1.7} />
        {!!item.badge && (
          <View style={{ position: 'absolute', top: -3, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.alert, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Txt weight="bold" size={10} color="#FFFFFF">{item.badge > 9 ? '9+' : String(item.badge)}</Txt>
          </View>
        )}
      </View>
      <Txt weight={active ? 'semibold' : 'medium'} size={11} color={active ? colors.accent : colors.muted}>{item.label}</Txt>
    </Pressable>
  );
}
