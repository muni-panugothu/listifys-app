/**
 * Notification analytics tracker.
 *
 * Fires fire-and-forget POST requests to /api/notifications/track.
 * Silently swallowed on failure — analytics should never crash the app.
 *
 * Events tracked:
 *   shown         — notification appeared on device
 *   clicked       — user tapped the notification body
 *   action_clicked — user tapped a CTA button
 *   dismissed     — user swiped away
 */
import type { NotificationAnalyticsPayload } from './types';
import { isPersistedNotificationId } from '@/lib/notifications/notification-id';
import { readStoredTokens } from '@/lib/secure-auth-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export async function trackNotificationEvent(
  payload: NotificationAnalyticsPayload
): Promise<void> {
  if (!API_BASE || !payload.notificationId) return;
  if (!isPersistedNotificationId(payload.notificationId)) return;

  try {
    const tokens = await readStoredTokens();
    const authHeader = tokens?.accessToken
      ? { Authorization: `Bearer ${tokens.accessToken}` }
      : {};

    await fetch(`${API_BASE}/api/notifications/track`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body:    JSON.stringify(payload),
    });
  } catch {
    // Silently ignore — analytics must never surface errors to users
  }
}
