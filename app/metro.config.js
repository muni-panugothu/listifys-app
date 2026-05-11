const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
 
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prefer require (CJS) exports to avoid socket.io-client ESM resolution warnings
config.resolver.unstable_conditionNames = ["require", "import"];
 
module.exports = withNativewind(config);