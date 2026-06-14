const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();

const debugKeystoreSource = path.join(projectRoot, "signing", "debug.keystore");
const debugKeystoreTarget = path.join(projectRoot, "android", "app", "debug.keystore");
const googleServicesSource = path.join(projectRoot, "google-services.json");
const googleServicesTarget = path.join(projectRoot, "android", "app", "google-services.json");
const notificationIconSource = path.join(projectRoot, "assets", "android", "ic_notification.xml");
const notificationIconTarget = path.join(
  projectRoot,
  "android",
  "app",
  "src",
  "main",
  "res",
  "drawable",
  "ic_notification.xml",
);

if (fs.existsSync(notificationIconSource)) {
  const drawableDir = path.dirname(notificationIconTarget);
  if (fs.existsSync(path.join(projectRoot, "android", "app"))) {
    fs.mkdirSync(drawableDir, { recursive: true });
    fs.copyFileSync(notificationIconSource, notificationIconTarget);
    console.log("Synced ic_notification.xml -> android res/drawable");
  }
}

if (fs.existsSync(googleServicesSource)) {
  const androidAppDir = path.dirname(googleServicesTarget);
  if (fs.existsSync(androidAppDir)) {
    fs.copyFileSync(googleServicesSource, googleServicesTarget);
    console.log("Synced google-services.json -> android/app/google-services.json");
  }
}

if (fs.existsSync(debugKeystoreSource)) {
  const androidAppDir = path.dirname(debugKeystoreTarget);
  if (fs.existsSync(androidAppDir)) {
    fs.copyFileSync(debugKeystoreSource, debugKeystoreTarget);
    console.log("Synced signing/debug.keystore -> android/app/debug.keystore");
  }
}

const cleanupTargets = [
  "android/build/generated/autolinking",
  "android/app/.cxx",
  "node_modules/react-native-reanimated/android/.cxx",
  "node_modules/react-native-reanimated/android/build",
  "node_modules/react-native-worklets/android/.cxx",
  "node_modules/react-native-worklets/android/build",
];

for (const relativeTarget of cleanupTargets) {
  const target = path.join(projectRoot, relativeTarget);
  if (fs.existsSync(target)) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`Removed ${relativeTarget}`);
    } catch (error) {
      // Windows can keep CMake artifacts locked briefly; warn and continue.
      console.warn(`Skipped ${relativeTarget}: ${error.message}`);
    }
  }
}

console.log("Android native cache cleanup complete.");
