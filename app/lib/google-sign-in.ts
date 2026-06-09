import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  getGoogleClientIds,
  type GoogleClientIds,
} from "@/features/auth/services/auth-api";
import { GOOGLE_OAUTH_CONFIG } from "@/lib/google-oauth-config";

export class GoogleSignInError extends Error {
  cancelled: boolean;

  constructor(message: string, cancelled = false) {
    super(message);
    this.name = "GoogleSignInError";
    this.cancelled = cancelled;
  }
}

type GoogleSigninApi = {
  configure: (config: Record<string, unknown>) => void;
  hasPlayServices: (opts: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
  signOut: () => Promise<void>;
  signIn: () => Promise<unknown>;
};

type GoogleStatusCodes = {
  IN_PROGRESS: string;
  SIGN_IN_CANCELLED: string;
  PLAY_SERVICES_NOT_AVAILABLE: string;
};

type GoogleModule = {
  GoogleSignin: GoogleSigninApi;
  isSuccessResponse?: (response: unknown) => boolean;
  isErrorWithCode?: (error: unknown) => boolean;
  statusCodes?: GoogleStatusCodes;
};

/** v16+ returns `{ type: 'success', data: { idToken } }` — helpers may be missing from require(). */
function isGoogleSignInSuccess(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;

  const typed = response as { type?: string; data?: { idToken?: string | null } };
  if (typed.type === "success") return true;
  return Boolean(typed.data?.idToken);
}

function isGoogleSignInErrorWithCode(
  error: unknown,
): error is { code?: number | string; message?: string } {
  return error != null && typeof error === "object" && "code" in error;
}

const FALLBACK_STATUS_CODES: GoogleStatusCodes = {
  IN_PROGRESS: "ASYNC_OP_IN_PROGRESS",
  SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
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

function readEmbeddedGoogleClientIds(): GoogleClientIds | null {
  const extra = Constants.expoConfig?.extra?.googleOAuth as
    | {
        webClientId?: string;
        androidClientId?: string;
        iosClientId?: string | null;
      }
    | undefined;

  const web =
    extra?.webClientId?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    GOOGLE_OAUTH_CONFIG.webClientId;

  if (!web) return null;

  return {
    web,
    android:
      extra?.androidClientId?.trim() ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ||
      GOOGLE_OAUTH_CONFIG.androidClientId,
    ios:
      extra?.iosClientId?.trim() ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ||
      null,
  };
}

async function resolveGoogleClientIds(): Promise<GoogleClientIds> {
  if (resolvedClientIds) return resolvedClientIds;

  const embedded = readEmbeddedGoogleClientIds();
  if (embedded?.web) {
    resolvedClientIds = embedded;
    return embedded;
  }

  try {
    const ids = await getGoogleClientIds();
    if (ids.web) {
      resolvedClientIds = ids;
      return ids;
    }
  } catch {
    // Server unreachable — use baked-in public client IDs.
  }

  resolvedClientIds = {
    web: GOOGLE_OAUTH_CONFIG.webClientId,
    ios: null,
    android: GOOGLE_OAUTH_CONFIG.androidClientId,
  };
  return resolvedClientIds;
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
  const { GoogleSignin } = module;
  const statusCodes = module.statusCodes ?? FALLBACK_STATUS_CODES;
  const checkSuccess =
    typeof module.isSuccessResponse === "function"
      ? module.isSuccessResponse
      : isGoogleSignInSuccess;
  const checkErrorWithCode =
    typeof module.isErrorWithCode === "function"
      ? module.isErrorWithCode
      : isGoogleSignInErrorWithCode;

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

    if (!checkSuccess(response)) {
      throw new GoogleSignInError("Google sign-in did not complete.", true);
    }

    const idToken = (response as { data?: { idToken?: string | null } }).data?.idToken;
    if (!idToken) {
      throw new GoogleSignInError("Google did not return an ID token. Check OAuth client configuration.");
    }

    return idToken;
  } catch (error: unknown) {
    if (checkErrorWithCode(error)) {
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
          "Google Sign-In configuration error (code 10).\n\n" +
          "The app signing key must match Google Cloud Console.\n\n" +
          "1. Open Google Cloud Console → project 582870381419 → Credentials\n" +
          "2. Open the Android OAuth client for com.listifys.app\n" +
          "3. Add BOTH SHA-1 fingerprints:\n" +
          `   Release/EAS: ${GOOGLE_OAUTH_CONFIG.releaseSha1}\n` +
          `   Debug/dev:   ${GOOGLE_OAUTH_CONFIG.debugSha1}\n\n` +
          "4. Confirm Web client ID matches:\n" +
          `   ${GOOGLE_OAUTH_CONFIG.webClientId}\n\n` +
          "Note: Adding SHA-1 only in Firebase (listifysapp) is not enough — use GCP project 582870381419.\n" +
          "After updating Console, rebuild and reinstall the APK.",
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
function isRunningInExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

export async function signInWithGoogleNative(): Promise<string> {
  if (isRunningInExpoGo()) {
    throw new GoogleSignInError(
      "Google Sign-In is not available in Expo Go. Install the Listifys preview APK or run a development build (eas build --profile preview).",
    );
  }

  const module = getGoogleModule();
  if (!module) {
    throw new GoogleSignInError(
      "Google Sign-In is not available in this build. Reinstall the Listifys APK built with EAS (preview or production profile) — the native Google module is missing.",
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
