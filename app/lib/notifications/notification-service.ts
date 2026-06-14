/**
 * Core notification display service.
 *
 * Renders rich Notifee notifications from raw FCM data payloads:
 *   - Big text / big picture (Myntra-style expandable)
 *   - CTA action buttons (Add to Cart, View Offer, Open Product…)
 *   - Notification grouping / summary
 *   - Incoming call full-screen overlay
 *   - Sound + vibration per channel
 *   - Silent / data-only pass-through
 */
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
  type AndroidAction,
  type AndroidNotification,
  type IOSNotificationAttachment,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import type { RichNotificationPayload, NotificationAction } from './types';
import { channelForType, CHANNEL } from './channels';
import { trackNotificationEvent } from './analytics';

// ── Small icon (must exist as a vector drawable in android/app/src/main/res/drawable)
const SMALL_ICON = 'ic_notification';

// ── Light colour (ARGB) ───────────────────────────────────────────────────────
const LIGHT_COLOUR = 0xff4f46e5; // indigo-600 — change to your brand colour

// ─────────────────────────────────────────────────────────────────────────────
// displayRichNotification
// Called from: background message handler, foreground message handler
// ─────────────────────────────────────────────────────────────────────────────
export async function displayRichNotification(
  data: Record<string, string>
): Promise<void> {
  const payload = data as unknown as RichNotificationPayload;
  const { type, title, body } = payload;

  if (!title?.trim() || !body?.trim()) return; // guard: malformed payload
  if (type === 'silent') return;               // data-only — nothing to show

  if (type === 'incoming_call') {
    await displayCallNotification(payload);
    return;
  }

  await displayStandardNotification(payload);
}

// ── Standard rich notification (all types except call) ───────────────────────
async function displayStandardNotification(
  payload: RichNotificationPayload
): Promise<void> {
  const {
    notificationId,
    type,
    title,
    body,
    imageUrl,
    iconUrl,
    actions: actionsJson,
    groupKey,
    sound,
    badge,
  } = payload;

  const channelId = channelForType(type ?? 'general');
  const notifId   = notificationId ?? String(Date.now());

  // ── Parse CTA action buttons ─────────────────────────────────────────────
  let parsedActions: NotificationAction[] = [];
  try {
    if (actionsJson) parsedActions = JSON.parse(actionsJson);
  } catch { /* ignore */ }

  const androidActions: AndroidAction[] = parsedActions.map((a) => ({
    title:       a.title,
    pressAction: { id: a.id, launchActivity: 'default' },
  }));

  // ── Android-specific config ───────────────────────────────────────────────
  const android: AndroidNotification = {
    channelId,
    smallIcon:   SMALL_ICON,
    color:       '#4f46e5',
    importance:  AndroidImportance.HIGH,
    visibility:  AndroidVisibility.PRIVATE,
    groupId:     groupKey,
    groupSummary: false,
    sound:       sound ?? 'default',
    vibrationPattern: [0, 300, 150, 300],
    lights:      [LIGHT_COLOUR, 300, 300],
    pressAction: { id: 'default', launchActivity: 'default' },
    actions:     androidActions,

    // Big picture style when imageUrl is provided, else big text
    style: imageUrl
      ? {
          type:       AndroidStyle.BIGPICTURE,
          picture:    imageUrl,
          largeIcon:  imageUrl,
          // Android shows the body as the summary text when expanded
          summary:    body,
        }
      : {
          type: AndroidStyle.BIGTEXT,
          text: body,
        },

    // Person avatar (large icon) shown in messaging-style notifications
    ...(iconUrl
      ? { largeIcon: iconUrl }
      : {}),
  };

  // ── Post a summary notification when groupKey is set (collapsed count) ───
  if (groupKey) {
    await notifee.displayNotification({
      id:    `grp_${groupKey}`,
      title,
      body:  'New notifications',
      android: {
        channelId,
        smallIcon:    SMALL_ICON,
        groupId:      groupKey,
        groupSummary: true,
        importance:   AndroidImportance.LOW,
        pressAction:  { id: 'default', launchActivity: 'default' },
      },
    });
  }

  // ── Display the notification ──────────────────────────────────────────────
  await notifee.displayNotification({
    id:    notifId,
    title,
    body,
    data:  payload as unknown as Record<string, string>,
    ios: {
      sound:      sound ?? 'default',
      badgeCount: badge ? parseInt(badge, 10) : undefined,
      // Register the notification category so iOS shows action buttons
      categoryId: type,
      attachments: imageUrl
        ? ([{ url: imageUrl, typeHint: 'public.image' }] as IOSNotificationAttachment[])
        : undefined,
    },
    android,
  });

  // Fire-and-forget analytics
  if (notificationId) {
    trackNotificationEvent({
      notificationId,
      event:     'shown',
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ── WhatsApp/full-screen incoming call notification ───────────────────────────
async function displayCallNotification(
  payload: RichNotificationPayload
): Promise<void> {
  const { notificationId, callerName, callerPhoto, callType } = payload;

  const channelId = CHANNEL.CALLS;
  const title     = `📞 ${callerName ?? 'Unknown'} is calling`;
  const body      = callType === 'video' ? 'Incoming video call' : 'Incoming audio call';
  const notifId   = notificationId ?? `call_${Date.now()}`;

  await notifee.displayNotification({
    id:    notifId,
    title,
    body,
    data:  payload as unknown as Record<string, string>,
    ios: {
      sound:      'default',
      categoryId: 'incoming_call',
    },
    android: {
      channelId,
      smallIcon:   SMALL_ICON,
      importance:  AndroidImportance.HIGH,
      visibility:  AndroidVisibility.PUBLIC,
      category:    AndroidCategory.CALL,
      sound:       'default',
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      pressAction: { id: 'default', launchActivity: 'default' },
      fullScreenAction: { id: 'default', launchActivity: 'default' },
      actions: [
        {
          title:       '✅ Accept',
          pressAction: { id: 'accept', launchActivity: 'default' },
        },
        {
          title:       '❌ Reject',
          pressAction: { id: 'reject' },
        },
      ],
      ...(callerPhoto ? { largeIcon: callerPhoto } : {}),
    },
  });
}

// ── Register iOS notification categories (call action buttons) ────────────────
export async function registerIOSCategories(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await notifee.setNotificationCategories([
    {
      id: 'incoming_call',
      actions: [
        { id: 'accept', title: '✅ Accept' },
        { id: 'reject', title: '❌ Reject', destructive: true },
      ],
    },
    {
      id: 'offer_received',
      actions: [
        { id: 'view_offer',  title: '👀 View Offer' },
        { id: 'add_to_cart', title: '🛒 Add to Cart' },
      ],
    },
    {
      id: 'price_drop',
      actions: [
        { id: 'open_product', title: '🏷️ View Deal' },
      ],
    },
    {
      id: 'promotion',
      actions: [
        { id: 'view_offer', title: '🎁 View Offer' },
      ],
    },
    {
      id: 'new_listing',
      actions: [
        { id: 'open_listing', title: '👀 View listing' },
      ],
    },
    {
      id: 'engagement_digest',
      actions: [
        { id: 'browse', title: '🔍 Browse now' },
      ],
    },
    {
      id: 're_engagement',
      actions: [
        { id: 'browse', title: '👀 See deals' },
      ],
    },
    {
      id: 'message',
      actions: [
        { id: 'reply', title: '💬 Reply' },
      ],
    },
  ]);
}
