const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
 
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prefer require (CJS) exports to avoid socket.io-client ESM resolution warnings
config.resolver.unstable_conditionNames = ["require", "import"];

const expoKeepAwakeNoopPath = path.resolve(
	__dirname,
	"shims/expo-keep-awake-noop.ts",
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
	const originModulePath = path.normalize(context.originModulePath ?? "");
	const isExpoDevToolsCaller = originModulePath.includes(
		path.join("node_modules", "expo", "src", "launch", "withDevTools"),
	);

	if (moduleName === "expo-keep-awake" && isExpoDevToolsCaller) {
		return {
			filePath: expoKeepAwakeNoopPath,
			type: "sourceFile",
		};
	}

	return context.resolveRequest(context, moduleName, platform);
};
 
module.exports = withNativewind(config);