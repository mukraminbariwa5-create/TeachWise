import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { Animated, Easing, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useNotifications } from '@/api/hooks';
import type { SchoolInfo } from '@/api/types';
import { useAuth } from '@/auth/store';
import { schoolShortName } from '@/lib/school';
import { useLayoutSize } from '@/lib/useLayout';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { getPref, setPref } from '@/lib/prefs';
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
 * The TeachWise frame, from the reference design: a navy frame with an icon sidebar
 * (the active page in a big white circle) around a light rounded panel.
 * Phones: navy top bar, light rounded panel, navy bottom bar with a raised Professor Wise in the middle.
 */
export function Shell({ nav, settingsItem, phoneTabs, wise, tipFor, hideTabsOn, children }: Props) {
  const size = useLayoutSize();
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
  const [sidebarOpen, toggleSidebar] = useSidebarPref(nav.length > 5);

  if (size !== 'phone') {
    const compact = size === 'tablet';
    const expanded = !compact && sidebarOpen;
    const docked = !!wise && wiseOpen && width >= 1200;
    const sideWidth = expanded ? 248 : compact ? 76 : 116;
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, padding: compact ? 14 : 28 }}>
        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.frame, borderRadius: compact ? 32 : 44, padding: compact ? 10 : 14 }}>
          <View accessibilityRole="menu" style={{ width: sideWidth, zIndex: 10, alignItems: expanded ? 'stretch' : 'center', paddingTop: compact ? 22 : 34, paddingBottom: 24, paddingHorizontal: expanded ? 14 : 0 }}>
            <View style={{ flexDirection: expanded ? 'row' : 'column', alignItems: 'center', gap: expanded ? 10 : 14, marginBottom: compact ? 30 : expanded ? 30 : 34, paddingHorizontal: expanded ? 6 : 0 }}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={tr('TeachWise home', 'Home ng TeachWise')}
                onPress={() => router.navigate(home as Href)}
                style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, flex: expanded ? 1 : undefined, transform: [{ scale: hovered ? 1.04 : 1 }] })}
              >
                <LogoMark size={compact ? 50 : expanded ? 46 : 62} />
                {expanded && <Wordmark size={20} onDark />}
              </Pressable>
              {!compact && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? tr('Collapse sidebar', 'Paliitin ang sidebar') : tr('Expand sidebar', 'Palakihin ang sidebar')}
                  accessibilityState={{ expanded }}
                  onPress={toggleSidebar}
                  style={({ hovered }: { hovered?: boolean }) => ({ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? colors.frameSoft : 'transparent' })}
                >
                  <Icon name="sidebar" size={20} color={colors.onFrameMuted} strokeWidth={1.8} />
                </Pressable>
              )}
            </View>
            <View style={{ alignItems: expanded ? 'stretch' : 'center', gap: expanded ? 4 : nav.length > 5 ? (compact ? 10 : 14) : compact ? 20 : 30 }}>
              {nav.map((item, i) => {
                const heading = expanded && item.group && item.group !== nav[i - 1]?.group ? item.group : null;
                const divider = !expanded && i > 0 && item.group && item.group !== nav[i - 1]?.group;
                const el = expanded ? (
                  <SideRow item={item} active={isActive(item.href)} onPress={() => go(item)} />
                ) : (
                  <SideItem item={item} active={isActive(item.href)} compact={compact} onPress={() => go(item)} />
                );
                return (
                  <View key={item.label} style={{ alignItems: expanded ? 'stretch' : 'center' }}>
                    {heading && (
                      <Txt weight="semibold" size={11} color={colors.onFrameMuted} style={{ letterSpacing: 1.1, textTransform: 'uppercase', marginTop: i === 0 ? 0 : 14, marginBottom: 6, marginLeft: 16, opacity: 0.8 }}>{heading}</Txt>
                    )}
                    {divider && <View style={{ width: 28, height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: compact ? 10 : 14 }} />}
                    {item.tourId ? <TourTarget id={item.tourId}>{el}</TourTarget> : el}
                  </View>
                );
              })}
            </View>
            <View style={{ flex: 1 }} />
            {school && (expanded ? <SchoolRow school={school} /> : <SchoolDot school={school} compact={compact} />)}
            {expanded ? (
              <SideRow item={settingsItem} active={isActive(settingsItem.href)} onPress={() => go(settingsItem)} />
            ) : (
              <SideItem item={settingsItem} active={isActive(settingsItem.href)} compact={compact} onPress={() => go(settingsItem)} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: compact ? 26 : 36, overflow: 'hidden' }}>
            <OfflineBanner />
            {children}
          </View>
          {docked && wise && <DockedWiseChat subtitle={wise.subtitle} placeholder={wise.placeholder} />}
        </View>
        {wise && !path.startsWith(wise.chatHref) && (
          <WiseLauncher
            subtitle={wise.subtitle}
            placeholder={wise.placeholder}
            tip={tip}
            tipKey={path}
            docked={width >= 1200}
            inset={compact ? { right: 44, bottom: 40 } : { right: 64, bottom: 60 }}
          />
        )}
        <NotificationsSheet />
        <TourOverlay />
      </View>
    );
  }

  const showTabs = !(hideTabsOn?.(path) ?? false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.frame }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LogoMark size={38} />
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Wordmark size={21} onDark />
        </View>
        {school && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '45%' }}>
            <Txt weight="semibold" size={13} color={colors.onFrameMuted} numberOfLines={1} style={{ flexShrink: 1 }}>{schoolShortName(school)}</Txt>
            <SchoolBadge school={school} size={30} onDark />
          </View>
        )}
      </View>

      <View style={{ flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>
        <OfflineBanner />
        {children}
      </View>

      {showTabs && (
        <PhoneTabBar
          tabs={phoneTabs}
          isActive={isActive}
          onPress={go}
          tip={phoneTabs.center && !path.startsWith(phoneTabs.center.href) ? tip : null}
          tipKey={path}
          bottomInset={insets.bottom}
        />
      )}
      <NotificationsSheet />
      <TourOverlay />
    </View>
  );
}

function SideItem({ item, active, compact, onPress }: { item: NavItem; active: boolean; compact: boolean; onPress: () => void }) {
  const d = active ? (compact ? 60 : 76) : 48;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={item.badge ? `${item.label} (${item.badge})` : item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: active ? colors.card : hovered ? colors.frameSoft : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      {({ hovered }: { hovered?: boolean }) => (
        <>
          <Icon name={item.icon} size={active ? 32 : 30} color={active ? colors.navy : '#FFFFFF'} strokeWidth={active ? 1.9 : 1.6} />
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

/** Remembers whether the computer sidebar shows labels. Admins (many pages) start with it open. */
function useSidebarPref(defaultOpen: boolean): [boolean, () => void] {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    getPref('sidebarOpen').then((v) => {
      if (v === '1' || v === '0') setOpen(v === '1');
    });
  }, []);
  const toggle = () => {
    tap();
    setOpen((o) => {
      setPref('sidebarOpen', o ? '0' : '1');
      return !o;
    });
  };
  return [open, toggle];
}

/** A labelled row in the open sidebar: the active page is a white pill. */
function SideRow({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={item.badge ? `${item.label} (${item.badge})` : item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({
        height: 48,
        borderRadius: 16,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: active ? colors.card : hovered ? colors.frameSoft : 'transparent',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Icon name={item.icon} size={22} color={active ? colors.navy : '#FFFFFF'} strokeWidth={active ? 2 : 1.7} />
      <Txt weight={active ? 'semibold' : 'medium'} size={15} color={active ? colors.accent : '#FFFFFF'} numberOfLines={1} style={{ flex: 1 }}>{item.label}</Txt>
      {!!item.badge && (
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.alert, alignItems: 'center', justifyContent: 'center' }}>
          <Txt weight="bold" size={11} color="#FFFFFF">{item.badge > 99 ? '99+' : String(item.badge)}</Txt>
        </View>
      )}
    </Pressable>
  );
}

/** Open sidebar: the school's badge with its name, so it's clear what "DS" means. */
function SchoolRow({ school }: { school: SchoolInfo }) {
  return (
    <View accessible accessibilityLabel={tr(`School: ${school.name}`, `Paaralan: ${school.name}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)' }}>
      <SchoolBadge school={school} size={38} onDark />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={11} color={colors.onFrameMuted} style={{ letterSpacing: 0.8 }}>{tr('SCHOOL', 'PAARALAN')}</Txt>
        <Txt weight="semibold" size={14} color="#FFFFFF" numberOfLines={2}>{school.name}</Txt>
      </View>
    </View>
  );
}

/** Icon sidebar: just the badge, with the school's name on hover. */
function SchoolDot({ school, compact }: { school: SchoolInfo; compact: boolean }) {
  return (
    <Pressable accessible accessibilityLabel={tr(`School: ${school.name}`, `Paaralan: ${school.name}`)} style={{ marginBottom: compact ? 12 : 18 }}>
      {({ hovered }: { hovered?: boolean }) => (
        <>
          <SchoolBadge school={school} size={compact ? 38 : 46} onDark />
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
    <View style={{ backgroundColor: colors.frame }}>
      {bubble && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 104 + bottomInset, alignItems: 'center', zIndex: 20 }}>
          <View>
            <TipBubble tip={bubble} onClose={() => setBubble(null)} tail="center" maxWidth={330} />
            <View style={{ alignSelf: 'center', width: 16, height: 16, backgroundColor: colors.card, transform: [{ rotate: '45deg' }], marginTop: -9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSoft }} />
          </View>
        </View>
      )}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'flex-end', paddingTop: 8, paddingBottom: Math.max(10, bottomInset + 4), paddingHorizontal: 6 }}>
        {withBadges(tabs.left).map((item) => (
          <TabButton key={item.label} item={item} active={isActive(item.href)} onPress={() => onPress(item)} />
        ))}

        {center && (
        <TourTarget id="ask" style={{ flex: 1.15, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={center.label}
            accessibilityState={{ selected: centerActive }}
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
                  width: 70,
                  height: 70,
                  marginTop: -34,
                  borderRadius: 35,
                  backgroundColor: centerActive ? colors.brand : '#FFFFFF',
                  borderWidth: 5,
                  borderColor: colors.frame,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }],
                },
                shadowStyle('lift'),
              ]}
            >
              <WiseHead size={44} mood={bubble ? 'laugh' : centerActive ? 'grin' : 'wink'} pop />
            </Animated.View>
            <Txt weight="semibold" size={11} color="#FFFFFF">{center.label}</Txt>
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
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.badge ? tr(`${item.label}, ${item.badge} new`, `${item.label}, ${item.badge} bago`) : item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => ({ flex: 1, alignItems: 'center', gap: 4, transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      <View style={{ width: active ? 46 : 40, height: active ? 46 : 40, borderRadius: 23, backgroundColor: active ? colors.card : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={item.icon} size={active ? 23 : 22} color={active ? colors.navy : '#FFFFFF'} strokeWidth={active ? 1.9 : 1.6} />
        {!!item.badge && (
          <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.alert, borderWidth: 2, borderColor: colors.frame, alignItems: 'center', justifyContent: 'center' }}>
            <Txt weight="bold" size={10} color="#FFFFFF">{item.badge > 9 ? '9+' : String(item.badge)}</Txt>
          </View>
        )}
      </View>
      <Txt weight={active ? 'semibold' : 'medium'} size={11} color={active ? '#FFFFFF' : colors.onFrameMuted}>{item.label}</Txt>
    </Pressable>
  );
}
