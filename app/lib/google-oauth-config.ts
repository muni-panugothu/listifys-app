/**
 * Public Google OAuth client IDs for Listifys (GCP project 582870381419).
 * These are not secrets — they must match Google Cloud Console + google-services.json.
 * Used as fallback when EXPO_PUBLIC_* env vars are missing from EAS/cloud builds.
 */
export const GOOGLE_OAUTH_CONFIG = {
  /** Web application client — required as webClientId on Android for idToken. */
  webClientId:
    "582870381419-ks689jiqpd5kuvurcbpc50bps6nlvbnk.apps.googleusercontent.com",
  /** Android OAuth client for com.listifys.app + signing SHA-1. */
  androidClientId:
    "582870381419-mkv03be59hu8camecqif5cg7btkaesko.apps.googleusercontent.com",
  packageName: "com.listifys.app",
  /** Release / EAS upload-key SHA-1 (register in Google Cloud Console). */
  releaseSha1: "AD:7F:2F:92:47:C9:0B:BF:DB:CF:76:01:6B:AC:B8:FF:BE:B6:76:14",
  /** Expo / debug dev-client SHA-1 — add this too if testing development builds. */
  debugSha1: "5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25",
} as const;
