/**
 * Public Google OAuth client IDs for Listifys (GCP project listifys-499209 / 250525074952).
 * These are not secrets — they must match Google Cloud Console + google-services.json.
 * Used as fallback when EXPO_PUBLIC_* env vars are missing from EAS/cloud builds.
 */
export const GOOGLE_OAUTH_CONFIG = {
  /** Web application client — required as webClientId on Android for idToken. */
  webClientId:
    "250525074952-6e1spofl9ro4jo2369c965s8a0463l5a.apps.googleusercontent.com",
  /** Android OAuth client for com.listifys.app + signing SHA-1. */
  androidClientId:
    "250525074952-32uouodmqkfvl2u7nh2a61ugo16caqqs.apps.googleusercontent.com",
  packageName: "com.listifys.app",
  /** Release / EAS upload-key SHA-1 (register in Google Cloud Console). */
  releaseSha1: "AD:7F:2F:92:47:C9:0B:BF:DB:CF:76:01:6B:AC:B8:FF:BE:B6:76:14",
  /** Expo / debug dev-client SHA-1 — add this too if testing development builds. */
  debugSha1: "5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25",
} as const;
