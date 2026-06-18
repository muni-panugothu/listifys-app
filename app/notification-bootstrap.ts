/**
 * Must run before expo-router entry so Notifee background events are registered
 * in the headless JS context (required for notification tap when app is backgrounded).
 */
import { bootstrapNotifications } from './providers/notification-provider';

try {
  bootstrapNotifications();
} catch (e) {
  console.warn('[Notifications] Early bootstrap failed:', e);
}
