/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const appJson = require("./app.json");

require("dotenv").config({ path: path.join(__dirname, ".env") });

/** Must match Google Cloud project listifys-499209 OAuth clients + google-services.json */
const GOOGLE_OAUTH_FALLBACK = {
  webClientId:
    "250525074952-6e1spofl9ro4jo2369c965s8a0463l5a.apps.googleusercontent.com",
  androidClientId:
    "250525074952-32uouodmqkfvl2u7nh2a61ugo16caqqs.apps.googleusercontent.com",
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
      const clientIdForScheme = iosClientId || webClientId;
      const clientNumeric = clientIdForScheme?.replace(
        /\.apps\.googleusercontent\.com$/,
        "",
      );
      return [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: `com.googleusercontent.apps.${clientNumeric}`,
        },
      ];
    }
    return plugin;
  }),
};
