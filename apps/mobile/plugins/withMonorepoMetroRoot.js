const { withAppBuildGradle } = require('expo/config-plugins');

// In this npm-workspaces monorepo, android/ lives at apps/mobile/android, one
// level deeper than a plain (non-monorepo) RN project. The generated
// `react {}` block already computes a correct `projectRoot` Groovy variable
// (apps/mobile) for the entryFile lookup, but never passes it as `root` to
// the react-native-gradle-plugin itself. Without it, the plugin's own default
// root detection resolves incorrectly for the Gradle-invoked one-shot
// `createBundle<Variant>JsAndAssets` task (unlike `expo start`, which is
// always launched with apps/mobile as cwd and unaffected by this), causing
// "Unable to resolve module ./index.ts from <monorepo root>" during release
// builds.
const MARKER = 'monorepo-metro-root';

function withMonorepoMetroRoot(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes(MARKER)) {
      return config;
    }

    const marker = 'react {';
    const insertAt = contents.indexOf(marker);
    if (insertAt === -1) {
      throw new Error('withMonorepoMetroRoot: could not find `react {` in android/app/build.gradle');
    }

    const injection = `
    // ${MARKER}: see plugins/withMonorepoMetroRoot.js
    root = file(projectRoot)
`;

    const insertPoint = insertAt + marker.length;
    config.modResults.contents = contents.slice(0, insertPoint) + injection + contents.slice(insertPoint);
    return config;
  });
}

module.exports = withMonorepoMetroRoot;
