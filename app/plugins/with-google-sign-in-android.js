const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

/**
 * Google Sign-In on Android reads `default_web_client_id` from resources when
 * using Google Cloud Console OAuth (not Firebase Auth). FCM-only google-services.json
 * does not include OAuth clients, so we inject the Web client ID here.
 */
function withGoogleSignInAndroid(config, { webClientId } = {}) {
  if (!webClientId) return config;

  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const valuesDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "values",
      );
      fs.mkdirSync(valuesDir, { recursive: true });

      const outPath = path.join(valuesDir, "google_signin_config.xml");
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="default_web_client_id" translatable="false">${webClientId}</string>
</resources>
`;
      fs.writeFileSync(outPath, xml, "utf8");
      return cfg;
    },
  ]);
}

module.exports = withGoogleSignInAndroid;
