const { withAppBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Signs local release builds with a real release keystore instead of the
// debug one. Reads apps/mobile/release-keystore.properties (gitignored,
// contains secrets) and injects its values as a dedicated signingConfig.
// Falls back to the debug signingConfig untouched if that file is missing
// (e.g. on a fresh clone, or on EAS which manages its own keystore).
const MARKER = 'release-signing';

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes(MARKER)) {
      return config;
    }

    const propsPath = path.join(config.modRequest.projectRoot, 'release-keystore.properties');
    if (!fs.existsSync(propsPath)) {
      return config;
    }

    const props = Object.fromEntries(
      fs
        .readFileSync(propsPath, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const index = line.indexOf('=');
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );

    const signingConfigMarker = 'signingConfigs {';
    const signingInsertAt = contents.indexOf(signingConfigMarker);
    if (signingInsertAt === -1) {
      throw new Error('withReleaseSigning: could not find `signingConfigs {` in android/app/build.gradle');
    }
    const signingInjection = `
        // ${MARKER}: see plugins/withReleaseSigning.js
        release {
            storeFile file("../../${props.storeFile}")
            storePassword "${props.storePassword}"
            keyAlias "${props.keyAlias}"
            keyPassword "${props.keyPassword}"
        }
`;
    let newContents =
      contents.slice(0, signingInsertAt + signingConfigMarker.length) +
      signingInjection +
      contents.slice(signingInsertAt + signingConfigMarker.length);

    newContents = newContents.replace(
      /(release\s*\{\s*\n\s*\/\/ Caution![^]*?signingConfig )signingConfigs\.debug/,
      '$1signingConfigs.release',
    );

    config.modResults.contents = newContents;
    return config;
  });
}

module.exports = withReleaseSigning;
