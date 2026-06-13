import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  getGoogleClientIds,
  type GoogleClientIds,
} from "@/features/auth/services/auth-api";
import { GOOGLE_OAUTH_CONFIG } from "@/lib/google-oauth-config";

export class GoogleSignInError extends Error {
  cancelled: boolean;
  code?: number | string;

  constructor(message: string, cancelled = false, code?: number | string) {
    super(message);
    this.name = "GoogleSignInError";
    this.cancelled = cancelled;
    this.code = code;
  }
}

type GoogleSigninApi = {
  configure: (config: Record<string, unknown>) => void;
  hasPlayServices?: (opts: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
  signOut?: () => Promise<void>;
  signIn: () => Promise<unknown>;
  signInSilently?: () => Promise<unknown>;
  getTokens?: () => Promise<{ idToken?: string | null; accessToken?: string | null }>;
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

const GOOGLE_SIGN_IN_STATUS_NAMES: Record<number, string> = {
  4: "SIGN_IN_REQUIRED",
  7: "NETWORK_ERROR",
  8: "INTERNAL_ERROR",
  10: "DEVELOPER_ERROR",
  12500: "SIGN_IN_FAILED",
  12501: "SIGN_IN_CANCELLED",
  12502: "SIGN_IN_CURRENTLY_IN_PROGRESS",
};

function extractGoogleErrorCode(error: unknown): number | string | undefined {
  if (error != null && typeof error === "object" && "code" in error) {
    const code = (error as { code?: number | string }).code;
    if (code !== undefined && code !== null && code !== "") return code;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);

  const fromMessage = message.match(/ApiException:\s*(\d+)/i)?.[1];
  if (fromMessage) return Number(fromMessage);

  return undefined;
}

function describeGoogleSignInStatus(code: number | string | undefined): string | null {
  if (code === undefined || code === null) return null;
  const numeric = typeof code === "number" ? code : Number(code);
  if (!Number.isNaN(numeric) && GOOGLE_SIGN_IN_STATUS_NAMES[numeric]) {
    return GOOGLE_SIGN_IN_STATUS_NAMES[numeric];
  }
  return null;
}

function formatNativeGoogleSignInError(err: {
  code?: number | string;
  message?: string;
}): string {
  const code = extractGoogleErrorCode(err);
  const statusName = describeGoogleSignInStatus(code);
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "No message from Google Sign-In native module.";

  const codeLabel =
    code !== undefined && code !== null ? String(code) : "unknown";
  const statusSuffix = statusName ? ` (${statusName})` : "";

  const lines = [
    `Google Sign-In error [code ${codeLabel}${statusSuffix}]: ${message}`,
  ];

  if (codeLabel === "12500" || codeLabel === "10" || statusName === "DEVELOPER_ERROR") {
    lines.push(
      "Usually means the app signing SHA-1 or OAuth client IDs do not match Google Cloud Console.",
    );
    if (__DEV__) {
      lines.push(`Expected debug SHA-1: ${GOOGLE_OAUTH_CONFIG.debugSha1}`);
    }
  }

  if (__DEV__) {
    try {
      lines.push(`Raw: ${JSON.stringify(err, Object.getOwnPropertyNames(err as object))}`);
    } catch {
      lines.push(`Raw: ${String(err)}`);
    }
  }

  return lines.join("\n");
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
    const raw = require("@react-native-google-signin/google-signin") as GoogleModule & {
      default?: GoogleModule;
    };
    const pkg = raw?.GoogleSignin ? raw : raw?.default ?? raw;
    const GoogleSignin = pkg.GoogleSignin ?? (pkg as unknown as GoogleSigninApi);

    if (!GoogleSignin || typeof GoogleSignin.signIn !== "function") {
      googleModule = null;
      return null;
    }

    googleModule = {
      GoogleSignin,
      isSuccessResponse:
        typeof pkg.isSuccessResponse === "function"
          ? pkg.isSuccessResponse
          : typeof raw.isSuccessResponse === "function"
            ? raw.isSuccessResponse
            : undefined,
      isErrorWithCode:
        typeof pkg.isErrorWithCode === "function"
          ? pkg.isErrorWithCode
          : typeof raw.isErrorWithCode === "function"
            ? raw.isErrorWithCode
            : undefined,
      statusCodes: pkg.statusCodes ?? raw.statusCodes,
    };
  } catch {
    googleModule = null;
  }

  return googleModule;
}

function assertGoogleSigninReady(GoogleSignin: GoogleSigninApi): void {
  if (typeof GoogleSignin.configure !== "function" || typeof GoogleSignin.signIn !== "function") {
    throw new GoogleSignInError(
      "Google Sign-In native module is incomplete. Rebuild and reinstall the Listifys APK (EAS preview or production profile).",
    );
  }
  if (Platform.OS === "android" && typeof GoogleSignin.hasPlayServices !== "function") {
    throw new GoogleSignInError(
      "Google Play Services check is unavailable in this build. Reinstall the Listifys APK built with EAS.",
    );
  }
}

function extractIdTokenFromResponse(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const typed = response as {
    idToken?: string | null;
    data?: {
      idToken?: string | null;
      user?: { idToken?: string | null };
    };
  };

  return (
    typed.data?.idToken ??
    typed.data?.user?.idToken ??
    typed.idToken ??
    null
  );
}

async function resolveIdToken(
  GoogleSignin: GoogleSigninApi,
  response: unknown,
): Promise<string> {
  const fromResponse = extractIdTokenFromResponse(response);
  if (fromResponse) return fromResponse;

  if (typeof GoogleSignin.getTokens === "function") {
    try {
      const tokens = await GoogleSignin.getTokens();
      if (tokens?.idToken) return tokens.idToken;
    } catch {
      // fall through
    }
  }

  throw new GoogleSignInError("Google did not return an ID token.");
}

function safeTrim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v || undefined;
}

function readEmbeddedGoogleClientIds(): GoogleClientIds | null {
  const extra: unknown = Constants.expoConfig?.extra?.googleOAuth;

  // Defensive: some builds may store this under a different shape
  // (e.g. `extra.googleOAuth.iosClient` instead of `iosClientId`).
  const webClientId =
    safeTrim(
      (extra as { webClientId?: unknown } | null | undefined)?.webClientId,
    ) ||
    safeTrim(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
    GOOGLE_OAUTH_CONFIG.webClientId;

  if (!webClientId) return null;

  const androidClientId =
    safeTrim(
      (extra as { androidClientId?: unknown } | null | undefined)?.androidClientId,
    ) ||
    safeTrim(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ||
    GOOGLE_OAUTH_CONFIG.androidClientId;

  // Fix crash source: avoid `.trim()` on non-string values.
  // Support both keys: iosClientId (preferred) and iosClient (legacy/alt).
  const iosClientId =
    safeTrim(
      (extra as { iosClientId?: unknown } | null | undefined)?.iosClientId,
    ) ||
    safeTrim(
      (extra as { iosClient?: unknown } | null | undefined)?.iosClient,
    ) ||
    safeTrim(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) ||
    null;

  return {
    web: webClientId,
    android: androidClientId,
    ios: iosClientId,
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

    if (__DEV__) {
      console.info("[GoogleSignIn] configured", {
        webClientId: clientIds.web,
        androidClientId: clientIds.android,
        packageName: GOOGLE_OAUTH_CONFIG.packageName,
      });
    }

    // v16 configure is async on the native side; signInSilently awaits the same
    // config promise without showing UI when no saved credential exists.
    if (typeof module.GoogleSignin.signInSilently === "function") {
      await module.GoogleSignin.signInSilently().catch(() => null);
    }
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
  assertGoogleSigninReady(GoogleSignin);

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
    if (Platform.OS === "android" && GoogleSignin.hasPlayServices) {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    if (typeof GoogleSignin.signOut === "function") {
      try {
        await GoogleSignin.signOut();
      } catch {
        // ignore stale session
      }
    }

    const response = await GoogleSignin.signIn();

    if (!checkSuccess(response)) {
      throw new GoogleSignInError("Google sign-in did not complete.", true);
    }

    return await resolveIdToken(GoogleSignin, response);
  } catch (error: unknown) {
    if (checkErrorWithCode(error)) {
      const err = error as { code?: number | string; message?: string };
      const resolvedCode = extractGoogleErrorCode(err);

      if (__DEV__) {
        console.warn("[GoogleSignIn] native sign-in error", {
          code: resolvedCode,
          status: describeGoogleSignInStatus(resolvedCode),
          message: err.message,
          raw: err,
        });
      }

      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new GoogleSignInError("Sign-in cancelled.", true, err.code);
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        throw new GoogleSignInError("Sign-in already in progress.", false, err.code);
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInError(
          "Google Play Services is not available on this device.",
          false,
          err.code,
        );
      }

      throw new GoogleSignInError(
        formatNativeGoogleSignInError(err),
        false,
        resolvedCode ?? err.code,
      );
    }

    const fallbackCode = extractGoogleErrorCode(error);
    if (fallbackCode !== undefined) {
      const err = {
        code: fallbackCode,
        message: error instanceof Error ? error.message : String(error),
      };
      if (__DEV__) {
        console.warn("[GoogleSignIn] native sign-in error", err);
      }
      throw new GoogleSignInError(formatNativeGoogleSignInError(err), false, fallbackCode);
    }

    if (error instanceof GoogleSignInError) throw error;

    const rawMessage = error instanceof Error ? error.message : String(error);
    if (/undefined is not a function|is not a function/i.test(rawMessage)) {
      throw new GoogleSignInError(
        "Google Sign-In native module failed to load. Rebuild and reinstall the Listifys APK (EAS preview or production profile), then try again.",
      );
    }

    throw new GoogleSignInError(rawMessage || "Google sign-in failed.");
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
