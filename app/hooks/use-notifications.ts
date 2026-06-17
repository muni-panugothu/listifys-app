/**
 * useNotifications — React hook.
 *
 * Wires up:
 *  1. FCM token registration + refresh subscription
 *  2. Notifee foreground event handler
 *  3. FCM foreground message handler
 *
 * Call this once inside NotificationProvider (authenticated scope only).
 */
import { useEffect, useState } from 'react';
import notifee, { EventType } from '@notifee/react-native';
// Lazy-load to avoid crash when google-services.json is missing.
let messaging: (() => any) | null = null;
try { messaging = require('@react-native-firebase/messaging').default; } catch {}
import { getSettingsPreferences } from '@/features/auth/services/auth-api';
import { useAppSelector } from '@/store/hooks';
import { store } from '@/store';
import { incomingCallReceived } from '@/store/slices/call-slice';
import {
  deleteFCMToken,
  getFCMToken,
  subscribeTokenRefresh,
} from '@/lib/notifications/token-manager';
import {
  getCachedPushEnabled,
  hydratePushEnabledCache,
  setCachedPushEnabled,
  subscribePushEnabledChange,
} from '@/lib/notifications/push-preference';
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

  // null = still loading preference; avoids registering a token before we know
  // whether the user opted out of push notifications.
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const loadPreference = async () => {
      await hydratePushEnabledCache();

      if (!enabled) {
        if (active) setPushEnabled(false);
        return;
      }

      try {
        const response = await getSettingsPreferences();
        await setCachedPushEnabled(response.preferences.pushNotifications);
        if (active) setPushEnabled(response.preferences.pushNotifications);
      } catch {
        const cached = await getCachedPushEnabled();
        if (active) setPushEnabled(cached);
      }
    };

    void loadPreference();

    const unsub = subscribePushEnabledChange((value) => {
      if (active) setPushEnabled(value);
    });

    return () => {
      active = false;
      unsub();
    };
  }, [enabled]);

  // ── Token registration ────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || pushEnabled === null) return;

    if (!pushEnabled) {
      void deleteFCMToken();
      return;
    }

    let unsubRefresh: (() => void) | undefined;

    getFCMToken().then((token) => {
      if (token) void registerFCMToken(token);
    });

    unsubRefresh = subscribeTokenRefresh((newToken) => {
      void registerFCMToken(newToken);
    });

    return () => unsubRefresh?.();
  }, [enabled, pushEnabled]);

  // ── Notifee foreground event handler ─────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    return notifee.onForegroundEvent(({ type, detail }) => {
      const data = detail.notification?.data as RichNotificationPayload | undefined;
      if (!data) return;

      const notifId = detail.notification?.id;

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
          return;
        }

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
  useEffect(() => {
    if (!enabled || pushEnabled !== true) return;
    if (!messaging) return;

    try {
      return messaging().onMessage(async (remoteMessage: any) => {
        const data = remoteMessage.data as Record<string, string> | undefined;
        if (!data) return;

        const callStatus = store.getState().call.status;

        if (data.type === 'incoming_call') {
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

        if (data.type !== 'silent') {
          await displayRichNotification(data);
        }
      });
    } catch {
      return undefined;
    }
  }, [enabled, pushEnabled]);
}

function safeParseOffer(raw: string | undefined): object {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function safeParseJSON<T>(raw: string | undefined): T | null {
  try { return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
