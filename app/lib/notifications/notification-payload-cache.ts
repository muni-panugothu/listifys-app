/**
 * Cache recent notification payloads by id for tap recovery on Android.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RichNotificationPayload } from './types';

const STORAGE_KEY = '@listifys/notification_payload_cache';
const MAX_ENTRIES = 30;

export async function cacheNotificationPayload(
  id: string,
  payload: RichNotificationPayload,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, RichNotificationPayload>;
    map[id] = payload;

    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) {
        delete map[key];
      }
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function readCachedNotificationPayload(
  id: string,
): Promise<RichNotificationPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, RichNotificationPayload>;
    return map[id] ?? null;
  } catch {
    return null;
  }
}
