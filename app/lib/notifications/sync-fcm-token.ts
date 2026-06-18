import { getFCMToken } from "@/lib/notifications/token-manager";
import { getCachedPushEnabled } from "@/lib/notifications/push-preference";
import { registerFCMTokenWithServer } from "@/lib/notifications/register-fcm-server";

let syncInFlight: Promise<boolean> | null = null;
let lastSyncedToken: string | null = null;

/**
 * Fetch the device FCM token and persist it on the server.
 * Safe to call repeatedly — dedupes concurrent calls and identical tokens.
 */
export async function syncFcmTokenWithServer(options?: {
  force?: boolean;
}): Promise<boolean> {
  if (syncInFlight && !options?.force) {
    return syncInFlight;
  }

  const run = async (): Promise<boolean> => {
    const pushOn = await getCachedPushEnabled();
    if (!pushOn) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.info("[FCM] Push disabled in preferences — skipping token sync");
      }
      return false;
    }

    const token = await getFCMToken();
    if (!token) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          "[FCM] No device token. Allow notifications for Listifys in system settings, then reopen the app.",
        );
      }
      return false;
    }

    if (!options?.force && token === lastSyncedToken) {
      return true;
    }

    const saved = await registerFCMTokenWithServer(token);
    if (saved) {
      lastSyncedToken = token;
    }
    return saved;
  };

  syncInFlight = run().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Call after logout so the next login always re-syncs. */
export function resetFcmSyncState(): void {
  lastSyncedToken = null;
  syncInFlight = null;
}
