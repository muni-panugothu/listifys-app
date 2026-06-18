/**
 * Persist pending notification navigation across JS contexts.
 * Notifee background handlers run in a headless task — in-memory state is lost.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Href } from '@/lib/safe-router';

const STORAGE_KEY = '@listifys/pending_notification_href';

export async function persistNotificationNavigation(href: Href): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(href));
  } catch {
    /* ignore */
  }
}

export async function consumePersistedNotificationNavigation(): Promise<Href | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as Href;
  } catch {
    return null;
  }
}

export async function peekPersistedNotificationNavigation(): Promise<Href | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Href;
  } catch {
    return null;
  }
}
