/**
 * firebase-messaging.ts
 *
 * Bridges @react-native-firebase/messaging with the Notifee-powered
 * notification service.  Existing callers in _layout.tsx are unchanged.
 *
 * Public API:
 *   getFCMToken()                    — request permission + return token
 *   registerBackgroundCallHandler()  — module-level background/quit bootstrap
 *   subscribeForegroundCallHandler() — foreground subscription (returns unsub fn)
 */
// Lazy-load — throws at module level when google-services.json is missing or
// the native Firebase bridge isn't linked yet.
let messaging: (() => any) | null = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch (e) {
  console.warn('[Firebase] @react-native-firebase/messaging not available:', e);
}
import notifee, { EventType } from '@notifee/react-native';
import { router } from 'expo-router';
import { store } from '@/store';
import { incomingCallReceived } from '@/store/slices/call-slice';
import { displayRichNotification } from '@/lib/notifications/notification-service';
import { navigateFromNotification } from '@/lib/notifications/deep-link-handler';
import { trackNotificationEvent } from '@/lib/notifications/analytics';
import type { RichNotificationPayload } from '@/lib/notifications/types';

// Re-export token helper used by call-socket-service + use-notifications
export { getFCMToken, subscribeTokenRefresh } from '@/lib/notifications/token-manager';

/**
 * Register the background/quit FCM message handler + Notifee background
 * event handler.  Must be called at module level before any React tree.
 */
export function registerBackgroundCallHandler(): void {
  if (!messaging) return;
  // ── FCM: background / quit state ─────────────────────────────────────────
  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      const data = remoteMessage.data as Record<string, string> | undefined;
      if (!data || data.type === 'silent') return;
      await displayRichNotification(data);
    });
  } catch (_e) {
    // Firebase not yet initialised — background handler not registered
  }

  // ── Notifee: background / quit state event handler ────────────────────────
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.ACTION_PRESS && type !== EventType.PRESS) return;
    const data = detail.notification?.data as RichNotificationPayload | undefined;
    if (!data) return;

    const notifId = detail.notification?.id;
    if (notifId) await notifee.cancelNotification(notifId).catch(() => {});

    // ── Incoming call ────────────────────────────────────────────────────────
    if (data.type === 'incoming_call') {
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'reject') return;

      store.dispatch(
        incomingCallReceived({
          callId:          data.callId       ?? '',
          remoteUserId:    data.from         ?? '',
          remoteUserName:  data.callerName   ?? 'Unknown',
          remoteUserPhoto: data.callerPhoto  ?? '',
          callType:        (data.callType as 'audio' | 'video') ?? 'audio',
          offer:           safeParseOffer(data.offer),
        })
      );
      router.push('/incoming-call');
      return;
    }

    // ── Generic CTA / body press ─────────────────────────────────────────────
    if (data.notificationId) {
      await trackNotificationEvent({
        notificationId: data.notificationId,
        event:          type === EventType.ACTION_PRESS ? 'action_clicked' : 'clicked',
        actionId:       detail.pressAction?.id,
        timestamp:      Date.now(),
      });
    }
    navigateFromNotification(data);
  });
}

/**
 * Subscribe to foreground FCM messages (call this once when authenticated).
 * Returns an unsubscribe function.
 */
export function subscribeForegroundCallHandler(): () => void {
  if (!messaging) return () => {};
  try {
    return messaging().onMessage(async (remoteMessage: any) => {
      const data = remoteMessage.data as Record<string, string> | undefined;
      if (!data || data.type === 'silent') return;

      if (data.type === 'incoming_call') {
        const callStatus = store.getState().call.status;
        if (callStatus === 'incoming' || callStatus === 'active') return;

        store.dispatch(
          incomingCallReceived({
            callId:          data.callId       ?? '',
            remoteUserId:    data.from         ?? '',
            remoteUserName:  data.callerName   ?? 'Unknown',
            remoteUserPhoto: data.callerPhoto  ?? '',
            callType:        (data.callType as 'audio' | 'video') ?? 'audio',
            offer:           safeParseOffer(data.offer),
          })
        );
        router.push('/incoming-call');
        return;
      }

      // All other types: show via Notifee
      await displayRichNotification(data);
    });
  } catch (_e) {
    return () => {};
  }
}

function safeParseOffer(raw: string | undefined): object {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
