/**
 * FCM token manager.
 *
 * Responsibilities:
 *  - Request notification permission (iOS + Android 13+)
 *  - Fetch and cache the FCM device token
 *  - Detect and surface token refresh events
 */
// Lazy-load to avoid crash when google-services.json is missing.
let messaging: any = null;
try {
  messaging = require("@react-native-firebase/messaging").default;
  // Ensure the default Firebase app is initialized before getToken().
  require("@react-native-firebase/app");
} catch {
  /* native Firebase unavailable (Expo Go) */
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import type { PermissionStatus } from './types';

const TOKEN_CACHE_KEY = '@fcm_token_v2';

async function ensureAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (!apiLevel || apiLevel < 33) return true;

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// ── Permission ────────────────────────────────────────────────────────────────

/** Request notification permission. Returns the resulting status string. */
export async function requestPermission(): Promise<PermissionStatus> {
  try {
    const status = await messaging().requestPermission();
    if (status === messaging.AuthorizationStatus.AUTHORIZED)  return 'granted';
    if (status === messaging.AuthorizationStatus.PROVISIONAL) return 'provisional';
    if (status === messaging.AuthorizationStatus.DENIED)      return 'denied';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Check current permission without prompting. */
export async function checkPermission(): Promise<PermissionStatus> {
  try {
    const status = await messaging().hasPermission();
    if (status === messaging.AuthorizationStatus.AUTHORIZED)  return 'granted';
    if (status === messaging.AuthorizationStatus.PROVISIONAL) return 'provisional';
    if (status === messaging.AuthorizationStatus.DENIED)      return 'denied';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Token ─────────────────────────────────────────────────────────────────────

/**
 * Request permission and return the FCM token.
 * The token is cached in AsyncStorage for quick retrieval.
 * Returns null if permission is denied or on error.
 */
export async function getFCMToken(): Promise<string | null> {
  if (!messaging) {
    if (__DEV__) console.warn('[FCM] Firebase Messaging not available — rebuild native app with google-services.json');
    return null;
  }

  try {
    const androidOk = await ensureAndroidNotificationPermission();
    if (!androidOk) {
      if (__DEV__) console.warn('[FCM] POST_NOTIFICATIONS denied — enable in Settings → Apps → Listifys → Notifications');
      return null;
    }

    const status = await requestPermission();
    if (status === 'denied') {
      if (__DEV__) console.warn('[FCM] Notification permission denied');
      return null;
    }

    const token = await messaging().getToken();
    if (token) {
      await AsyncStorage.setItem(TOKEN_CACHE_KEY, token);
      if (__DEV__) console.log('[FCM] Device token:', token);
    } else if (__DEV__) {
      console.warn('[FCM] messaging().getToken() returned empty');
    }
    return token ?? null;
  } catch (error) {
    if (__DEV__) console.warn('[FCM] getFCMToken failed:', error);
    return null;
  }
}

/** Read the last cached token without requesting permission. */
export async function getCachedToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_CACHE_KEY);
  } catch {
    return null;
  }
}

/**
 * Delete the FCM token from this device + clear the local cache.
 * Forces the next `getFCMToken()` call to mint a brand-new token, which
 * guarantees any old token cannot receive pushes once the user re-enables
 * notifications.
 */
export async function deleteFCMToken(): Promise<void> {
  try {
    if (messaging) {
      await messaging().deleteToken().catch(() => {});
    }
  } catch {
    // Best effort — the native token may not exist (Expo Go, etc.)
  }
  try {
    await AsyncStorage.removeItem(TOKEN_CACHE_KEY);
  } catch {
    // Storage failure is not fatal — server-side delete still gates pushes.
  }
}

/**
 * Subscribe to FCM token-refresh events.
 * When the token changes the new token is cached and the callback is invoked.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function subscribeTokenRefresh(
  onRefresh: (newToken: string) => void
): () => void {
  if (!messaging) return () => {};
  try {
    return messaging().onTokenRefresh(async (token: string) => {
      await AsyncStorage.setItem(TOKEN_CACHE_KEY, token).catch(() => {});
      onRefresh(token);
    });
  } catch (_e) {
    // Firebase not yet initialised — token refresh subscription skipped
    return () => {};
  }
}
