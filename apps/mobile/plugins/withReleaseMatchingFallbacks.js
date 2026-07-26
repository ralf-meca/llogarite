const { withAppBuildGradle } = require('expo/config-plugins');

// Some autolinked native modules only publish a "debug" variant of their own
// project (no explicit "release" build type), which makes Gradle's
// :app:bundleRelease/:app:assembleRelease dependency resolution fail with
// "No matching variant... No variants exist" for those modules. The fix is
// to let :app's release build type fall back to a module's debug variant
// when no release variant exists. Same rationale as withWindowsNinjaFix.js
// for living in a config plugin instead of a hand-edit of build.gradle.
const MARKER = 'release-matching-fallbacks';

function withReleaseMatchingFallbacks(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes(MARKER)) {
      return config;
    }

    const marker = 'buildTypes {';
    const insertAt = contents.indexOf(marker);
    if (insertAt === -1) {
      throw new Error('withReleaseMatchingFallbacks: could not find `buildTypes {` in android/app/build.gradle');
    }

    const injection = `
        // ${MARKER}: see plugins/withReleaseMatchingFallbacks.js
        release {
            matchingFallbacks = ['release', 'debug']
        }
`;

    const insertPoint = insertAt + marker.length;
    config.modResults.contents = contents.slice(0, insertPoint) + injection + contents.slice(insertPoint);
    return config;
  });
}

module.exports = withReleaseMatchingFallbacks;
