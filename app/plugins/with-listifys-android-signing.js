const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

/**
 * Copies Listifys project keystores into the generated Android project during prebuild.
 * Debug: used by `expo run:android` and local APK installs.
 */
function withListifysAndroidSigning(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const androidAppDir = path.join(cfg.modRequest.platformProjectRoot, "app");
      const debugSource = path.join(projectRoot, "signing", "debug.keystore");

      if (fs.existsSync(debugSource)) {
        fs.mkdirSync(androidAppDir, { recursive: true });
        fs.copyFileSync(debugSource, path.join(androidAppDir, "debug.keystore"));
      }

      return cfg;
    },
  ]);
}

module.exports = withListifysAndroidSigning;
