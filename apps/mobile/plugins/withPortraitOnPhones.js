const { withMainActivity } = require('expo/config-plugins');

// Keeps the app in portrait on phones without declaring it in the manifest.
//
// From Android 16 the system ignores a manifest orientation lock on large
// screens (600dp and wider), and Play Console reports the lock as something to
// remove. So app.json no longer sets one, and the activity asks for portrait
// itself, at runtime, only while the screen is phone-sized - the approach the
// Android large-screen guidance describes. A tablet or an unfolded foldable is
// left free to rotate, which the system would do regardless.
//
// The check is repeated when the configuration changes, because the activity
// handles those itself rather than being recreated: a foldable opening or
// closing crosses the 600dp line while the app is running.
//
// android/ is generated, so this has to be injected from a plugin; MainActivity
// edited by hand would be rewritten by the next clean prebuild.
const MARKER = 'portrait-on-phones';
const LARGE_SCREEN_MIN_WIDTH_DP = 600;

const IMPORTS = ['import android.content.pm.ActivityInfo', 'import android.content.res.Configuration'];

const ON_CREATE_CALL = `    // ${MARKER}: see plugins/withPortraitOnPhones.js
    applyOrientationPolicy(resources.configuration)
`;

const METHODS = `
  // ${MARKER}: see plugins/withPortraitOnPhones.js
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyOrientationPolicy(newConfig)
  }

  private fun applyOrientationPolicy(configuration: Configuration) {
    requestedOrientation =
      if (configuration.smallestScreenWidthDp < ${LARGE_SCREEN_MIN_WIDTH_DP}) {
        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
      } else {
        ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
      }
  }
`;

function insertBefore(contents, anchor, addition, what) {
  const index = contents.indexOf(anchor);
  if (index === -1) {
    throw new Error(`withPortraitOnPhones: could not find ${what} in MainActivity`);
  }
  return contents.slice(0, index) + addition + contents.slice(index);
}

module.exports = (config) =>
  withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withPortraitOnPhones: expected a Kotlin MainActivity');
    }
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) {
      return config;
    }

    for (const line of IMPORTS) {
      if (!contents.includes(line)) {
        contents = insertBefore(contents, 'import android.os.Bundle', `${line}\n`, 'the imports');
      }
    }
    // Before super.onCreate, so the very first frame is already the right way up.
    contents = insertBefore(contents, '    super.onCreate(', ON_CREATE_CALL, 'super.onCreate');
    // The class's closing brace is the last one in the file.
    const classEnd = contents.lastIndexOf('}');
    contents = contents.slice(0, classEnd) + METHODS + contents.slice(classEnd);

    config.modResults.contents = contents;
    return config;
  });
