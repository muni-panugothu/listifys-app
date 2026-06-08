/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const appJson = require("./app.json");

require("dotenv").config({ path: path.join(__dirname, ".env") });

/** Must match Google Cloud project 582870381419 OAuth clients + google-services.json */
const GOOGLE_OAUTH_FALLBACK = {
  webClientId:
    "582870381419-ks689jiqpd5kuvurcbpc50bps6nlvbnk.apps.googleusercontent.com",
  androidClientId:
    "582870381419-mkv03be59hu8camecqif5cg7btkaesko.apps.googleusercontent.com",
  packageName: "com.listifys.app",
};

const webClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
  GOOGLE_OAUTH_FALLBACK.webClientId;
const androidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ||
  GOOGLE_OAUTH_FALLBACK.androidClientId;
const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || null;

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    googleOAuth: {
      webClientId,
      androidClientId,
      iosClientId,
      packageName: GOOGLE_OAUTH_FALLBACK.packageName,
    },
  },
  plugins: (appJson.expo.plugins || []).map((plugin) => {
    if (plugin === "@react-native-google-signin/google-signin") {
      const iosClientNumeric = iosClientId?.replace(
        ".apps.googleusercontent.com",
        "",
      );
      return [
        "@react-native-google-signin/google-signin",
        iosClientNumeric
          ? { iosUrlScheme: `com.googleusercontent.apps.${iosClientNumeric}` }
          : {},
      ];
    }
    return plugin;
  }),
};
