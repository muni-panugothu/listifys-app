const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();

const debugKeystoreSource = path.join(projectRoot, "signing", "debug.keystore");
const debugKeystoreTarget = path.join(projectRoot, "android", "app", "debug.keystore");

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
