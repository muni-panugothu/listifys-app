/**
 * useNotifications — React hook.
 *
 * Wires up:
 *  1. FCM token registration + refresh subscription
 *  2. Notifee foreground event handler
 *       - PRESS          → deep-link + analytics
 *       - ACTION_PRESS   → CTA route + analytics
 *       - DISMISSED      → analytics
 *  3. FCM foreground message handler (fires when app is in foreground and
 *     a data push arrives — the socket usually beats it, but this is the
 *     reliable fallback for promotional / silent pushes)
 *
 * Call this once inside AppLayout (authenticated scope only).
 */
import { useEffect } from 'react';
import notifee, { EventType } from '@notifee/react-native';
// Lazy-load to avoid crash when google-services.json is missing.
let messaging: (() => any) | null = null;
try { messaging = require('@react-native-firebase/messaging').default; } catch {}
import { useAppSelector } from '@/store/hooks';
import { store } from '@/store';
import { incomingCallReceived } from '@/store/slices/call-slice';
import {
  getFCMToken,
  subscribeTokenRefresh,
} from '@/lib/notifications/token-manager';
import { registerFCMToken } from '@/features/calling/services/call-socket-service';
import {
  displayRichNotification,
} from '@/lib/notifications/notification-service';
import { navigateFromNotification } from '@/lib/notifications/deep-link-handler';
import { trackNotificationEvent } from '@/lib/notifications/analytics';
import type { RichNotificationPayload } from '@/lib/notifications/types';

export function useNotifications() {
  const isAuthenticated  = useAppSelector((s) => s.auth.isAuthenticated);
  const sessionHydrated  = useAppSelector((s) => s.auth.sessionHydrated);
  const enabled          = isAuthenticated && sessionHydrated;

  // ── Token registration ────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    let unsubRefresh: (() => void) | undefined;

    getFCMToken().then((token) => {
      if (token) registerFCMToken(token);
    });

    unsubRefresh = subscribeTokenRefresh((newToken) => {
      registerFCMToken(newToken);
    });

    return () => unsubRefresh?.();
  }, [enabled]);

  // ── Notifee foreground event handler ─────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    return notifee.onForegroundEvent(({ type, detail }) => {
      const data = detail.notification?.data as RichNotificationPayload | undefined;
      if (!data) return;

      const notifId = detail.notification?.id;

      // ── Notification body tapped ──────────────────────────────────────────
      if (
        type === EventType.PRESS ||
        (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'default')
      ) {
        if (data.notificationId) {
          trackNotificationEvent({
            notificationId: data.notificationId,
            event:          'clicked',
            timestamp:      Date.now(),
          }).catch(() => {});
        }
        if (notifId) notifee.cancelNotification(notifId).catch(() => {});
        navigateFromNotification(data);
        return;
      }

      // ── CTA action button tapped ──────────────────────────────────────────
      if (type === EventType.ACTION_PRESS) {
        const actionId = detail.pressAction?.id ?? '';
        if (data.notificationId) {
          trackNotificationEvent({
            notificationId: data.notificationId,
            event:          'action_clicked',
            actionId,
            timestamp:      Date.now(),
          }).catch(() => {});
        }
        if (notifId) notifee.cancelNotification(notifId).catch(() => {});

        // Incoming call actions
        if (data.type === 'incoming_call') {
          if (actionId === 'accept') {
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
            navigateFromNotification({ ...data, route: '/incoming-call' });
          }
          // reject → do nothing, call will time out server-side
          return;
        }

        // Generic CTA: route from action definition
        if (actionId !== 'reject') {
          const actions: Array<{ id: string; route?: string; params?: Record<string,string> }> =
            safeParseJSON(data.actions) ?? [];
          const action = actions.find((a) => a.id === actionId);
          if (action?.route) {
            navigateFromNotification({
              ...data,
              route:  action.route,
              params: action.params ? JSON.stringify(action.params) : undefined,
            });
          } else {
            navigateFromNotification(data);
          }
        }
        return;
      }

      // ── Notification dismissed ────────────────────────────────────────────
      if (type === EventType.DISMISSED) {
        if (data.notificationId) {
          trackNotificationEvent({
            notificationId: data.notificationId,
            event:          'dismissed',
            timestamp:      Date.now(),
          }).catch(() => {});
        }
      }
    });
  }, [enabled]);

  // ── FCM foreground message handler ───────────────────────────────────────
  // The socket covers call + chat events when connected.
  // This handler covers promotional pushes and acts as a backup for call
  // notifications when the socket is briefly unavailable.
  useEffect(() => {
    if (!enabled) return;
    if (!messaging) return;

    return messaging().onMessage(async (remoteMessage) => {
      const data = remoteMessage.data as Record<string, string> | undefined;
      if (!data) return;

      const callStatus = store.getState().call.status;

      if (data.type === 'incoming_call') {
        // If socket already handled it, skip duplicate
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
        navigateFromNotification({ ...data, route: '/incoming-call' } as RichNotificationPayload);
        return;
      }

      // Show all other types as visible notifications (e.g., promotions)
      if (data.type !== 'silent') {
        await displayRichNotification(data);
      }
    });
  }, [enabled]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeParseOffer(raw: string | undefined): object {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function safeParseJSON<T>(raw: string | undefined): T | null {
  try { return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
