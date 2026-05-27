/**
 * Deep-link handler for push notification payloads.
 *
 * Maps a RichNotificationPayload → expo-router route and navigates.
 * When a `route` field is present in the payload it is used directly,
 * otherwise the type-based mapping below is applied.
 */
import { router } from 'expo-router';
import type { RichNotificationPayload } from './types';
import type { Href } from '@/lib/safe-router';

// ── Navigate from a push notification payload ─────────────────────────────────
export function navigateFromNotification(payload: RichNotificationPayload): void {
  const href = resolveHref(payload);
  if (!href) return;

  try {
    if (typeof href === 'string') {
      router.push(href as Href);
    } else {
      router.push(href as Href);
    }
  } catch {
    // Navigation can fail if the stack isn't ready yet — silently ignore
  }
}

// ── Resolve the Href for a payload ────────────────────────────────────────────
function resolveHref(
  payload: RichNotificationPayload
): Href | null {
  // 1. Explicit route override — highest priority
  if (payload.route) {
    const params = safeParseParams(payload.params);
    if (params) {
      return { pathname: payload.route as any, params } as Href;
    }
    return payload.route as Href;
  }

  // 2. Type-based mapping
  const type = (payload.type ?? '').toLowerCase();

  if (type === 'message') {
    if (payload.conversationId) {
      return {
        pathname: '/chat-conversation',
        params: {
          conversationId: payload.conversationId,
          ...(payload.senderId   ? { recipientId:  payload.senderId }  : {}),
          ...(payload.senderName ? { name:         payload.senderName } : {}),
          ...(payload.listingId  ? { listingId:    payload.listingId }  : {}),
        },
      } as Href;
    }
    return '/messages-inbox' as Href;
  }

  if (type === 'offer_received' || type === 'offer_accepted' || type === 'offer_rejected') {
    if (payload.listingId) {
      return listingHref(payload.listingId, payload.listingType ?? 'electronics');
    }
    return '/messages-inbox' as Href;
  }

  if (type === 'listing_saved' || type === 'new_listing' || type === 'listing_sold') {
    if (payload.listingId) {
      return listingHref(payload.listingId, payload.listingType ?? 'electronics');
    }
    return '/(tabs)/home-feed-root' as Href;
  }

  if (type === 'price_drop') {
    if (payload.listingId) {
      return listingHref(payload.listingId, payload.listingType ?? 'electronics');
    }
    return '/saved-items' as Href;
  }

  if (type === 'follow') {
    if (payload.followerId ?? payload.senderId) {
      return {
        pathname: '/seller-public-profile',
        params: {
          sellerId:   payload.followerId ?? payload.senderId!,
          sellerName: payload.senderName ?? '',
        },
      } as Href;
    }
    return '/(tabs)/home-feed-root' as Href;
  }

  if (
    type === 'booking_created' ||
    type === 'booking_confirmed' ||
    type === 'booking_completed' ||
    type === 'booking_cancelled' ||
    type === 'order_update'
  ) {
    return '/(tabs)/home-feed-root' as Href;
  }

  if (type === 'review_received') {
    if (payload.listingId) {
      return listingHref(payload.listingId, payload.listingType ?? 'services');
    }
    return '/(tabs)/home-feed-root' as Href;
  }

  if (type === 'promotion' || type === 'flash_sale') {
    return '/(tabs)/home-feed-root' as Href;
  }

  if (type === 'incoming_call') {
    return '/incoming-call' as Href;
  }

  // Default: home feed
  return '/(tabs)/home-feed-root' as Href;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function listingHref(listingId: string, listingType: string): Href {
  const specialRoutes: Record<string, string> = {
    events:     '/event-detail',
    properties: '/property-detail',
    jobs:       '/job-detail',
  };
  const pathname = (specialRoutes[listingType] ?? '/listing-detail-template') as any;
  return { pathname, params: { category: listingType, id: listingId } } as Href;
}

function safeParseParams(
  raw: string | undefined
): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, string>;
  } catch { /* ignore */ }
  return null;
}
