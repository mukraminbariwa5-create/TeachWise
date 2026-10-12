import { create } from 'zustand';
import { api, setSuspendedHandler, setUnauthorizedHandler } from '@/api/client';
import type { SchoolInfo, User } from '@/api/types';
import { deviceName } from '@/lib/appInfo';
import { getPref, setPref } from '@/lib/prefs';
import { usePickedSchool } from '@/lib/school';
import { toast } from '@/lib/ui';
import { registerPushToken, unregisterPushToken } from '@/lib/push';
import { clearQueryCache } from '@/lib/queryPersist';
import { queryClient } from '@/lib/queryClient';
import { DEFAULT_SETTINGS, useSettings, type AccountSettings } from '@/lib/settings';
import { clearToken, getToken, setToken } from './tokenStorage';

export interface RegisterPayload {
  school_id: number;
  name: string;
  id_number: string;
  username: string;
  email?: string;
  section_id: number;
  password: string;
  password_confirmation: string;
  accepted_privacy: boolean;
}

export interface InvitePayload {
  code: string;
  name: string;
  id_number: string;
  username: string;
  email?: string;
  password: string;
  password_confirmation: string;
  accepted_privacy: boolean;
}

interface MeResponse {
  user: User;
  school: SchoolInfo | null;
  settings: AccountSettings;
  token_expires_at: string | null;
}

interface AuthState {
  user: User | null;
  /** The account's school (name, logo, settings). Null for the TeachWise owner. */
  school: SchoolInfo | null;
  status: 'loading' | 'signedIn' | 'signedOut';
  /** The session ran out while the app was open: a small sign-in sheet appears over the page. */
  expired: boolean;
  /** Restores the session from the saved token when the app opens (and renews it when close to expiring). */
  hydrate: () => Promise<void>;
  login: (login: string, password: string, remember?: boolean, schoolId?: number | null) => Promise<User>;
  register: (data: RegisterPayload) => Promise<User>;
  acceptInvite: (data: InvitePayload) => Promise<User>;
  setSchool: (school: SchoolInfo | null) => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const RENEW_WITHIN_MS = 7 * 24 * 3600 * 1000;

/** Loads the user, their school and settings; renews the token when it expires within a week. */
async function loadMe(token: string): Promise<User> {
  const me = await api<MeResponse>('/auth/me', { token });
  useSettings.getState().set(me.settings ?? DEFAULT_SETTINGS);
  useAuth.setState({ school: me.school ?? null });
  setPref('user', JSON.stringify(me.user));
  setPref('userSchool', me.school ? JSON.stringify(me.school) : '');
  registerPushToken().catch(() => {});
  if (me.token_expires_at && new Date(me.token_expires_at).getTime() - Date.now() < RENEW_WITHIN_MS) {
    try {
      const r = await api<{ token: string }>('/auth/refresh', { method: 'POST', token });
      await setToken(r.token, (await getPref('remember')) !== '0');
    } catch {
      // keep the current token; it still works until it expires
    }
  }
  return me.user;
}

/** After signing in: remember the account's school so the next sign-in starts there. */
function signedIn(set: (p: Partial<AuthState>) => void, user: User, school: SchoolInfo | null) {
  set({ user, school, status: 'signedIn', expired: false });
  if (school) usePickedSchool.getState().pick({ id: school.id, name: school.name, short_name: school.short_name, code: school.code, location: school.location, logo_url: school.logo_url });
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  school: null,
  status: 'loading',
  expired: false,

  hydrate: async () => {
    const token = await getToken();
    if (!token) {
      set({ status: 'signedOut' });
      return;
    }
    try {
      const user = await loadMe(token);
      set({ user, status: 'signedIn' });
    } catch (e) {
      // Offline at launch: open with the last known account; pages show saved data until the connection returns.
      if ((e as { status?: number })?.status === 0) {
        const cached = await getPref('user');
        if (cached) {
          const school = await getPref('userSchool');
          set({ user: JSON.parse(cached) as User, school: school ? (JSON.parse(school) as SchoolInfo) : null, status: 'signedIn' });
          return;
        }
        set({ status: 'signedOut' });
        return;
      }
      await clearToken();
      set({ user: null, status: 'signedOut' });
    }
  },

  login: async (login, password, remember = true, schoolId = null) => {
    const { token, user, school } = await api<{ token: string; user: User; school: SchoolInfo | null }>('/auth/login', {
      method: 'POST',
      body: { login, password, remember, device_name: deviceName(), school_id: schoolId ?? undefined },
      token: null,
    });
    await setToken(token, remember);
    await setPref('remember', remember ? '1' : '0');
    signedIn(set, user, school);
    loadMe(token).catch(() => {});
    return user;
  },

  register: async (data) => {
    const { token, user, school } = await api<{ token: string; user: User; school: SchoolInfo }>('/auth/register', {
      method: 'POST',
      body: { ...data, device_name: deviceName() },
      token: null,
    });
    await setToken(token);
    await setPref('remember', '1');
    signedIn(set, user, school);
    loadMe(token).catch(() => {});
    return user;
  },

  acceptInvite: async (data) => {
    const { token, user, school } = await api<{ token: string; user: User; school: SchoolInfo }>('/auth/accept-invite', {
      method: 'POST',
      body: { ...data, device_name: deviceName() },
      token: null,
    });
    await setToken(token);
    await setPref('remember', '1');
    signedIn(set, user, school);
    loadMe(token).catch(() => {});
    return user;
  },

  setSchool: (school) => set({ school }),

  logout: async () => {
    await unregisterPushToken();
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // The token may already be invalid; log out locally anyway.
    }
    await clearToken();
    await setPref('user', '');
    await setPref('userSchool', '');
    await clearQueryCache();
    queryClient.clear();
    useSettings.getState().set(DEFAULT_SETTINGS);
    set({ user: null, school: null, status: 'signedOut', expired: false });
  },

  setUser: (user) => set({ user }),
}));

setUnauthorizedHandler(() => {
  // Signed in and the token stopped working: keep the page, ask for the password again.
  if (useAuth.getState().user) {
    useAuth.setState({ expired: true });
    return;
  }
  clearToken();
  useAuth.setState({ user: null, status: 'signedOut' });
});

// The school paused or the account was deactivated: sign out and say why.
setSuspendedHandler((message) => {
  if (!useAuth.getState().user) return;
  useAuth.getState().logout();
  toast({ title: message, mood: 'worried' });
});

/** Where each role lands after login. */
export function homeFor(role: User['role']): '/student' | '/teacher' | '/admin' | '/platform' {
  return role === 'student' ? '/student' : role === 'teacher' ? '/teacher' : role === 'platform' ? '/platform' : '/admin';
}

/** The settings/profile/help pages live under each role's folder. */
export function routeFor(role: User['role'], page: 'account' | 'profile' | 'settings' | 'help'): string {
  return `${homeFor(role)}/${page}`;
}
