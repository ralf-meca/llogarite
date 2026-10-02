const { withAndroidStyles } = require('expo/config-plugins');

// Drops android:statusBarColor from the generated app theme. The app is
// edge-to-edge, where Android 15 ignores the attribute altogether, but its
// mere presence is one of the "deprecated APIs or parameters for
// edge-to-edge" Play Console reports against a release. android/ is
// generated, so it has to be removed from a plugin - editing styles.xml by
// hand would be undone by the next prebuild, which writes it back.
//
// This only clears the part of that warning that is ours. The rest comes from
// calls inside React Native, Expo and the ads SDK, and goes when they do.
const ATTRIBUTE = 'android:statusBarColor';

module.exports = (config) =>
  withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style ?? [];
    for (const style of styles) {
      if (Array.isArray(style.item)) {
        style.item = style.item.filter((item) => item.$?.name !== ATTRIBUTE);
      }
    }
    return config;
  });
