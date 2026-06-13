/**
 * Google Cloud Console OAuth IDs (project Listifys / 582870381419).
 * Google Sign-In uses these via GoogleSignin.configure() — NOT Firebase.
 * google-services.json is Firebase/FCM only (project listifysapp).
 */
export const GOOGLE_OAUTH_CONFIG = {
  /** Web application client — required as webClientId on Android for idToken. */
  webClientId:
    "582870381419-m26s615uhqhcf6scj9rrov3s5qm8nb7n.apps.googleusercontent.com",
  /** Android OAuth client for com.listifys.app + signing SHA-1. */
  androidClientId:
    "582870381419-mkv03be59hu8camecqif5cg7btkaesko.apps.googleusercontent.com",
  packageName: "com.listifys.app",
  /** Release keystore SHA-1 (`app/signing/release.keystore`). */
  releaseSha1: "33:F2:F5:19:E2:E0:DE:92:77:F9:0A:2C:62:C5:67:C0:CD:D8:12:79",
  /** Debug keystore SHA-1 (`app/signing/debug.keystore`) for `expo run:android`. */
  debugSha1: "C7:6E:C1:CB:3F:6B:0D:F8:B2:DC:DF:E3:78:0D:04:A0:48:72:D3:5F",
} as const;
