import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from '@/api/client';
import { getPref, setPref } from './prefs';

/**
 * Push notifications on phones ("Midterm evaluation is open", "Closes in 24 hours").
 * The token is sent to the server, which sends through Expo's push service.
 * Computers use the in-app notification list instead.
 */

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type PushStatus = 'on' | 'off' | 'blocked' | 'unsupported';

export async function pushStatus(): Promise<PushStatus> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'on';
  return status === 'denied' ? 'blocked' : 'off';
}

/** Asks for permission (only when the person turns it on) and registers this phone. */
export async function enablePush(): Promise<PushStatus> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return status === 'denied' ? 'blocked' : 'off';
  await registerPushToken();
  return 'on';
}

/** Sends this phone's push token to the server (after sign-in, and when it changes). */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'TeachWise', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await api('/me/push-tokens', { method: 'POST', body: { token, platform: Platform.OS } });
  await setPref('pushToken', token);
}

/** On log out: stop sending pushes to this phone for the old account. */
export async function unregisterPushToken(): Promise<void> {
  const token = await getPref('pushToken');
  if (!token) return;
  await api('/me/push-tokens', { method: 'DELETE', body: { token } }).catch(() => {});
  await setPref('pushToken', '');
}

/** Opens the phone's settings for TeachWise (when notifications were blocked). */
export const openSystemSettings = () => Linking.openSettings().catch(() => {});

/** Tapping a notification opens the app on Home. Returns a cleanup function. */
export function onNotificationTap(handler: (data: Record<string, unknown>) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => handler((r.notification.request.content.data ?? {}) as Record<string, unknown>));
  return () => sub.remove();
}
