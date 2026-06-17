import { requestJson } from "@/features/auth/services/auth-api";
import { connectSocket, getSocket } from "@/features/messaging/services/socket-service";

/**
 * Persist FCM token on the server (REST + socket fallback).
 * REST is reliable; socket duplicates for call wake-up paths.
 */
export async function registerFCMTokenWithServer(fcmToken: string): Promise<void> {
  if (!fcmToken) return;

  try {
    await requestJson<{ success: boolean }>("/api/notifications/fcm-token", {
      method: "POST",
      body: JSON.stringify({ fcmToken }),
    });
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info("[FCM] Token saved on server (REST)");
    }
    return true;
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[FCM] REST token register failed:", error);
    }
    return false;
  }

  try {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("call:update-fcm-token", { fcmToken });
      return;
    }
    const connected = await connectSocket();
    connected?.emit("call:update-fcm-token", { fcmToken });
  } catch {
    // Socket optional — REST registration is enough for push tests
  }
}

/**
 * Clear the FCM token from the server so no further pushes can be delivered.
 * Called when the user turns OFF push notifications in settings.
 */
export async function unregisterFCMTokenFromServer(): Promise<boolean> {
  try {
    await requestJson<{ success: boolean }>("/api/notifications/fcm-token", {
      method: "DELETE",
    });
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info("[FCM] Token cleared on server");
    }
    return true;
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[FCM] Token clear failed:", error);
    }
    return false;
  }
}
