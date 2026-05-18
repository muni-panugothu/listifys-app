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
  if (envWebId) {
    resolvedClientIds = {
      web: envWebId,
      ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? null,
      android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? null,
    };
    return resolvedClientIds;
  }

  try {
    const ids = await getGoogleClientIds();
    resolvedClientIds = ids;
    return ids;
  } catch {
    const fallbackWeb =
      "335766515911-5corrme09mfaplitd0r9ra9k7m2nr76i.apps.googleusercontent.com";
    resolvedClientIds = { web: fallbackWeb, ios: null, android: null };
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
  })();

  return configurePromise;
}

export function isGoogleSignInAvailable() {
  return getGoogleModule() != null;
}

export async function signInWithGoogleNative(): Promise<string> {
  const module = getGoogleModule();
  if (!module) {
    throw new GoogleSignInError(
      "Google Sign-In requires a development build with @react-native-google-signin/google-signin. It is not available in Expo Go.",
    );
  }

  await configureGoogleSignIn();

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
      if (
        err.code === 10 ||
        message.includes("DEVELOPER_ERROR") ||
        message.toLowerCase().includes("developer error")
      ) {
        throw new GoogleSignInError(
          `Google Sign-In is misconfigured for this build. Verify package com.listifys.app, SHA-1 in Google Cloud, and API base URL ${AUTH_API_BASE_URL}.`,
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
