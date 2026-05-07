const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const cleanupTargets = [
  'android/build/generated/autolinking',
  'android/app/.cxx',
  'node_modules/react-native-reanimated/android/.cxx',
  'node_modules/react-native-reanimated/android/build',
  'node_modules/react-native-worklets/android/.cxx',
  'node_modules/react-native-worklets/android/build',
];

for (const relativeTarget of cleanupTargets) {
  const target = path.join(projectRoot, relativeTarget);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`Removed ${relativeTarget}`);
  }
}

console.log('Android native cache cleanup complete.');
