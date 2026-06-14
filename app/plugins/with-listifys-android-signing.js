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
      const googleServicesSource = path.join(projectRoot, "google-services.json");

      if (fs.existsSync(debugSource)) {
        fs.mkdirSync(androidAppDir, { recursive: true });
        fs.copyFileSync(debugSource, path.join(androidAppDir, "debug.keystore"));
      }

      if (fs.existsSync(googleServicesSource)) {
        fs.mkdirSync(androidAppDir, { recursive: true });
        fs.copyFileSync(googleServicesSource, path.join(androidAppDir, "google-services.json"));
      }

      const notificationIconSource = path.join(projectRoot, "assets", "android", "ic_notification.xml");
      const drawableDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "drawable",
      );
      if (fs.existsSync(notificationIconSource)) {
        fs.mkdirSync(drawableDir, { recursive: true });
        fs.copyFileSync(
          notificationIconSource,
          path.join(drawableDir, "ic_notification.xml"),
        );
      }

      return cfg;
    },
  ]);
}

module.exports = withListifysAndroidSigning;
