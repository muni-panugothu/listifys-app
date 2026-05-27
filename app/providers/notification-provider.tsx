/**
 * NotificationProvider
 *
 * Boots the entire notification system:
 *   1. Creates Android notification channels
 *   2. Registers iOS categories
 *   3. Handles app-opened-from-notification (quit state)
 *   4. Attaches the useNotifications hook
 *
 * Bootstrap functions (background handlers) are exported for module-level
 * call in app/_layout.tsx — they MUST run before the first React render.
 */
import { useEffect, type ReactNode } from 'react';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { store } from '@/store';
import { incomingCallReceived } from '@/store/slices/call-slice';
import { router } from 'expo-router';
import { createAllChannels } from '@/lib/notifications/channels';
import { registerIOSCategories, displayRichNotification } from '@/lib/notifications/notification-service';
import { navigateFromNotification } from '@/lib/notifications/deep-link-handler';
import { trackNotificationEvent } from '@/lib/notifications/analytics';
import { useNotifications } from '@/hooks/use-notifications';
import type { RichNotificationPayload } from '@/lib/notifications/types';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL BOOTSTRAP  (call in app/_layout.tsx OUTSIDE any component)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register FCM background + quit message handler and Notifee background event
 * handler. Must be called at module level before any React tree renders.
 */
export function bootstrapNotifications(): void {
  // ── FCM: background / quit state handler ─────────────────────────────────
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    const data = remoteMessage.data as Record<string, string> | undefined;
    if (!data) return;

    // incoming_call is handled by full-screen Notifee notification
    if (data.type === 'incoming_call') {
      await displayRichNotification(data);
      return;
    }
    // silent — no visible notification
    if (data.type === 'silent') return;

    // all other types: show rich notification
    await displayRichNotification(data);
  });

  // ── Notifee: background / quit state event handler ────────────────────────
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const data = detail.notification?.data as RichNotificationPayload | undefined;
    if (!data) return;

    const notifId = detail.notification?.id;
    if (notifId) await notifee.cancelNotification(notifId).catch(() => {});

    // ── Incoming call actions ────────────────────────────────────────────────
    if (data.type === 'incoming_call') {
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'reject') {
        // Rejected — nothing to do; server-side will time out the call
        return;
      }
      // Accept or body press → dispatch + navigate
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

    // ── Generic press / CTA ──────────────────────────────────────────────────
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction?.id;
      if (data.notificationId) {
        await trackNotificationEvent({
          notificationId: data.notificationId,
          event:          type === EventType.ACTION_PRESS ? 'action_clicked' : 'clicked',
          actionId,
          timestamp:      Date.now(),
        });
      }

      if (actionId && actionId !== 'default') {
        // Find the matching action's route
        const actions: Array<{ id: string; route?: string; params?: Record<string,string> }> =
          safeParseJSON(data.actions) ?? [];
        const action = actions.find((a) => a.id === actionId);
        if (action?.route) {
          navigateFromNotification({
            ...data,
            route:  action.route,
            params: action.params ? JSON.stringify(action.params) : undefined,
          });
          return;
        }
      }
      navigateFromNotification(data);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT PROVIDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  // Attach the useNotifications hook (token, foreground events, FCM foreground)
  useNotifications();

  // ── One-time setup: channels + iOS categories ─────────────────────────────
  useEffect(() => {
    createAllChannels().catch(() => {});
    registerIOSCategories().catch(() => {});
  }, []);

  // ── App opened from notification (quit state) ─────────────────────────────
  // FCM: getInitialNotification fires when the app was completely killed and
  // the user tapped a notification to open it.
  useEffect(() => {
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (!remoteMessage?.data) return;
        const data = remoteMessage.data as Record<string, string>;
        if (data.type !== 'incoming_call' && data.type !== 'silent') {
          navigateFromNotification(data as RichNotificationPayload);
        }
      })
      .catch(() => {});
  }, []);

  // Notifee: getInitialNotification fires when app was killed and user tapped
  // a Notifee-displayed notification (e.g., a scheduled or call notification).
  useEffect(() => {
    notifee
      .getInitialNotification()
      .then((initial) => {
        if (!initial?.notification?.data) return;
        const data = initial.notification.data as RichNotificationPayload;
        navigateFromNotification(data);
      })
      .catch(() => {});
  }, []);

  return <>{children}</>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeParseOffer(raw: string | undefined): object {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function safeParseJSON<T>(raw: string | undefined): T | null {
  try { return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
