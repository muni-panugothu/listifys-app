/**
 * Notifee Android notification channels — one per notification category.
 * createAllChannels() must be called once at app startup (notification provider).
 */
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import type { NotificationType } from './types';

// ── Channel ID constants ──────────────────────────────────────────────────────
export const CHANNEL = {
  GENERAL:      'general',
  PROMOTIONS:   'promotions',
  ORDERS:       'orders',
  MESSAGES:     'messages',
  CALLS:        'incoming_calls',
  PRICE_ALERTS: 'price_alerts',
  SYSTEM:       'system',
} as const;

export type ChannelId = typeof CHANNEL[keyof typeof CHANNEL];

// ── Channel group ─────────────────────────────────────────────────────────────
const GROUP_ID = 'listifys';

// ── Create all channels once ──────────────────────────────────────────────────
export async function createAllChannels(): Promise<void> {
  await notifee.createChannelGroup({ id: GROUP_ID, name: 'Listifys' });

  await Promise.all([
    notifee.createChannel({
      id:          CHANNEL.GENERAL,
      name:        'General',
      groupId:     GROUP_ID,
      importance:  AndroidImportance.DEFAULT,
      vibration:   true,
      lights:      true,
      sound:       'default',
    }),
    notifee.createChannel({
      id:          CHANNEL.PROMOTIONS,
      name:        'Promotions & Offers',
      description: 'Flash sales, discount codes, and exclusive deals',
      groupId:     GROUP_ID,
      importance:  AndroidImportance.DEFAULT,
      vibration:   false,
      sound:       'default',
    }),
    notifee.createChannel({
      id:          CHANNEL.ORDERS,
      name:        'Orders & Bookings',
      description: 'Order status, booking confirmations and updates',
      groupId:     GROUP_ID,
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      lights:      true,
      sound:       'default',
    }),
    notifee.createChannel({
      id:          CHANNEL.MESSAGES,
      name:        'Messages',
      description: 'Chat messages and offers from other users',
      groupId:     GROUP_ID,
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      lights:      true,
      sound:       'default',
    }),
    notifee.createChannel({
      id:          CHANNEL.CALLS,
      name:        'Incoming Calls',
      description: 'Audio and video call alerts',
      groupId:     GROUP_ID,
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      lights:      true,
      sound:       'default',
      visibility:  AndroidVisibility.PUBLIC,
    }),
    notifee.createChannel({
      id:          CHANNEL.PRICE_ALERTS,
      name:        'Price Alerts',
      description: 'Price drops on items you saved',
      groupId:     GROUP_ID,
      importance:  AndroidImportance.DEFAULT,
      vibration:   true,
      sound:       'default',
    }),
    notifee.createChannel({
      id:          CHANNEL.SYSTEM,
      name:        'System',
      description: 'Account security and system notices',
      groupId:     GROUP_ID,
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      sound:       'default',
    }),
  ]);
}

/** Resolve the right channel for a given notification type. */
export function channelForType(type: NotificationType | string): ChannelId {
  switch (type) {
    case 'incoming_call':
      return CHANNEL.CALLS;
    case 'message':
    case 'offer_received':
    case 'offer_accepted':
    case 'offer_rejected':
      return CHANNEL.MESSAGES;
    case 'order_update':
    case 'booking_created':
    case 'booking_confirmed':
    case 'booking_completed':
    case 'booking_cancelled':
      return CHANNEL.ORDERS;
    case 'price_drop':
      return CHANNEL.PRICE_ALERTS;
    case 'promotion':
    case 'flash_sale':
      return CHANNEL.PROMOTIONS;
    case 'system':
    case 'security_alert':
      return CHANNEL.SYSTEM;
    default:
      return CHANNEL.GENERAL;
  }
}
