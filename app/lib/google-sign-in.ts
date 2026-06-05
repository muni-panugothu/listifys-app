import { Platform } from "react-native";

import {
  AUTH_API_BASE_URL,
  getGoogleClientIds,
  type GoogleClientIds,
} from "@/features/auth/services/auth-api";

export class GoogleSignInError extends Error {
  cancelled: boolean;

  constructor(message: string, cancelled = false) {
    super(message);
    this.name = "GoogleSignInError";
    this.cancelled = cancelled;
  }
}

type GoogleModule = {
  GoogleSignin: {
    configure: (config: Record<string, unknown>) => void;
    hasPlayServices: (opts: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
    signOut: () => Promise<void>;
    signIn: () => Promise<unknown>;
  };
  isSuccessResponse: (response: unknown) => boolean;
  isErrorWithCode: (error: unknown) => boolean;
  statusCodes: {
    IN_PROGRESS: string;
    SIGN_IN_CANCELLED: string;
    PLAY_SERVICES_NOT_AVAILABLE: string;
  };
};

function isGoogleNativeModuleAvailable(): boolean {
  const proxy = (global as { __turboModuleProxy?: (name: string) => unknown }).__turboModuleProxy;
  if (proxy != null) {
    return proxy("RNGoogleSignin") != null;
  }
  try {
    const { NativeModules } = require("react-native");
    return NativeModules.RNGoogleSignin != null;
  } catch {
    return false;
  }
}

let googleModule: GoogleModule | null = null;
let googleModuleChecked = false;
let configurePromise: Promise<void> | null = null;
let resolvedClientIds: GoogleClientIds | null = null;

function getGoogleModule(): GoogleModule | null {
  if (googleModuleChecked) return googleModule;
  googleModuleChecked = true;

  if (!isGoogleNativeModuleAvailable()) {
    googleModule = null;
    return null;
  }

  try {
    googleModule = require("@react-native-google-signin/google-signin") as GoogleModule;
  } catch {
    googleModule = null;
  }

  return googleModule;
}

async function resolveGoogleClientIds(): Promise<GoogleClientIds> {
  if (resolvedClientIds) return resolvedClientIds;

  const envWebId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const envIosId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? null;
  const envAndroidId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? null;
  if (envWebId) {
    resolvedClientIds = {
      web: envWebId,
      ios: envIosId,
      android: envAndroidId,
    };
    return resolvedClientIds;
  }

  try {
    const ids = await getGoogleClientIds();
    resolvedClientIds = ids;
    return ids;
  } catch {
    // Env-based fallback when server is unreachable.
    // This avoids embedding OAuth credentials in source.
    resolvedClientIds = {
      web: envWebId ?? null,
      ios: envIosId,
      android: envAndroidId,
    };
    return resolvedClientIds;
  }
}

export async function configureGoogleSignIn() {
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    const module = getGoogleModule();
    if (!module) return;

    const clientIds = await resolveGoogleClientIds();
    if (!clientIds.web) {
      throw new GoogleSignInError(
        "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID on the server or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in the app env.",
      );
    }

    module.GoogleSignin.configure({
      webClientId: clientIds.web,
      iosClientId: clientIds.ios ?? undefined,
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
  })().catch((err: unknown) => {
    // Reset so the next sign-in attempt re-runs configure instead of
    // returning the same stale rejected promise forever.
    configurePromise = null;
    throw err;
  });

  return configurePromise;
}

export function isGoogleSignInAvailable() {
  return getGoogleModule() != null;
}

/** One attempt of the native sign-in flow.  Exported for testability. */
async function _attemptGoogleSignIn(module: GoogleModule): Promise<string> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = module;

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore stale session
    }

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new GoogleSignInError("Google sign-in did not complete.", true);
    }

    const idToken = (response as { data?: { idToken?: string | null } }).data?.idToken;
    if (!idToken) {
      throw new GoogleSignInError("Google did not return an ID token. Check OAuth client configuration.");
    }

    return idToken;
  } catch (error: unknown) {
    if (isErrorWithCode(error)) {
      const err = error as { code?: number | string; message?: string };
      const message = typeof err.message === "string" ? err.message : "";

      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new GoogleSignInError("Sign-in cancelled.", true);
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        throw new GoogleSignInError("Sign-in already in progress.");
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInError("Google Play Services is not available on this device.");
      }
      // err.code can be number 10 OR string "10" depending on library version
      if (
        err.code === 10 ||
        err.code === "10" ||
        message.includes("DEVELOPER_ERROR") ||
        message.toLowerCase().includes("developer error")
      ) {
        throw new GoogleSignInError(
          "Google Sign-In configuration error (code 10).\n" +
          "In Google Cloud Console → APIs & Services → Credentials, " +
          "open the Android OAuth client for com.listifys.app and add this SHA-1:\n" +
          "5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25",
        );
      }

      throw new GoogleSignInError(message || "Google sign-in failed.");
    }

    if (error instanceof GoogleSignInError) throw error;
    throw new GoogleSignInError(
      error instanceof Error ? error.message : "Google sign-in failed.",
    );
  }
}

/** Returns true when the error is the "activity is null" native crash. */
function isActivityNullError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("activity") && msg.toLowerCase().includes("null");
}

/**
 * Sign in with Google.  Retries once if the Activity is temporarily
 * unavailable (common right after an HMR reload in development, or during
 * Activity recreation on a low-memory device).
 */
export async function signInWithGoogleNative(): Promise<string> {
  const module = getGoogleModule();
  if (!module) {
    throw new GoogleSignInError(
      "Google Sign-In requires a development build with @react-native-google-signin/google-signin. It is not available in Expo Go.",
    );
  }

  await configureGoogleSignIn();

  try {
    return await _attemptGoogleSignIn(module);
  } catch (firstError: unknown) {
    if (isActivityNullError(firstError)) {
      // Activity was null — wait for it to settle then try once more.
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      return _attemptGoogleSignIn(module);
    }
    throw firstError;
  }
}
