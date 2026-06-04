const {
  withProjectBuildGradle,
  withSettingsGradle,
} = require("expo/config-plugins");

const NOTIFEE_MAVEN =
  'maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }';

function addNotifeeMavenToBuildGradle(contents) {
  if (contents.includes("@notifee/react-native/android/libs")) {
    return contents;
  }
  return contents.replace(
    /maven\s*\{\s*url\s*['"]https:\/\/www\.jitpack\.io['"]\s*\}/,
    `maven { url 'https://www.jitpack.io' }\n    ${NOTIFEE_MAVEN}`
  );
}

function addNotifeeMavenToSettingsGradle(contents) {
  if (contents.includes("@notifee/react-native/android/libs")) {
    return contents;
  }

  const repoBlock = `  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
    ${NOTIFEE_MAVEN}
  }
`;

  if (contents.includes("dependencyResolutionManagement")) {
    return contents.replace(
      /dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{/,
      (match) => `${match}\n    google()\n    mavenCentral()\n    maven { url 'https://www.jitpack.io' }\n    ${NOTIFEE_MAVEN}\n    // `
    );
  }

  return `${contents}
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
${repoBlock}}
`;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withNotifeeMaven(config) {
  config = withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addNotifeeMavenToBuildGradle(cfg.modResults.contents);
    return cfg;
  });

  config = withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = addNotifeeMavenToSettingsGradle(cfg.modResults.contents);
    return cfg;
  });

  return config;
}

module.exports = withNotifeeMaven;
