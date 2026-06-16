/**
 * Push-notification preference cache.
 *
 * Persists the master "Push notifications" toggle locally so the
 * `useNotifications` hook can decide whether to register an FCM token at app
 * start, before the server preference roundtrip completes. Source of truth
 * remains the server (`User.preferences.pushNotifications`); this cache only
 * mirrors the latest known value to avoid race conditions on cold start.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@listify/push_notifications_enabled";

type Listener = (enabled: boolean) => void;
const listeners = new Set<Listener>();

/**
 * Read the cached preference.
 *
 * Defaults to `true` (legacy users + fresh installs that never opened
 * settings should receive notifications; the user opts out explicitly).
 */
export async function getCachedPushEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

/** Synchronous accessor reading the last-known value updated by `setCachedPushEnabled`. */
let inMemoryValue = true;
export function getInMemoryPushEnabled(): boolean {
  return inMemoryValue;
}

/** Hydrate the in-memory cache from storage on app start. */
export async function hydratePushEnabledCache(): Promise<boolean> {
  const value = await getCachedPushEnabled();
  inMemoryValue = value;
  return value;
}

export async function setCachedPushEnabled(enabled: boolean): Promise<void> {
  inMemoryValue = enabled;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Local persistence failure — server preference still governs.
  }
  listeners.forEach((listener) => {
    try {
      listener(enabled);
    } catch {
      // Listener errors must not break other listeners.
    }
  });
}

export function subscribePushEnabledChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
