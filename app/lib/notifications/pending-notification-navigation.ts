/**
 * Queue notification deep-links until the root navigator + auth session are ready.
 * Notifee background / cold-start handlers fire before React Navigation mounts.
 */
import type { Href } from '@/lib/safe-router';
import { persistNotificationNavigation } from './pending-notification-storage';

let pending: Href | null = null;
const listeners = new Set<() => void>();

export function queueNotificationNavigation(href: Href): void {
  pending = href;
  void persistNotificationNavigation(href);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.info('[Notifications] Queued navigation:', href);
  }

  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function hasPendingNotificationNavigation(): boolean {
  return pending !== null;
}

export function takePendingNotificationNavigation(): Href | null {
  const href = pending;
  pending = null;
  return href;
}

export function subscribePendingNotificationNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
