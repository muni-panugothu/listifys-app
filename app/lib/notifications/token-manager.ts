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
try { messaging = require('@react-native-firebase/messaging').default; } catch {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PermissionStatus } from './types';

const TOKEN_CACHE_KEY = '@fcm_token_v2';

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
  try {
    const status = await requestPermission();
    if (status === 'denied') return null;

    const token = await messaging().getToken();
    if (token) {
      await AsyncStorage.setItem(TOKEN_CACHE_KEY, token);
      console.log('[FCM] Device token:', token); // copy this for testing
    }
    return token ?? null;
  } catch {
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
 * Subscribe to FCM token-refresh events.
 * When the token changes the new token is cached and the callback is invoked.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function subscribeTokenRefresh(
  onRefresh: (newToken: string) => void
): () => void {
  if (!messaging) return () => {};
  return messaging().onTokenRefresh(async (token: string) => {
    await AsyncStorage.setItem(TOKEN_CACHE_KEY, token).catch(() => {});
    onRefresh(token);
  });
}
