const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Lets the development build live on a phone beside the one from the Play Store.
//
// The two are signed with different keys, so Android refuses to put one over the
// other: testing a change used to mean uninstalling the real app, and with it the
// session and anything else it kept. The debug build therefore gets an application
// id of its own - com.rmtech.llogarite.dev - and is called "Llogarite Dev", so both
// can be installed and told apart. Release builds are not touched.
//
// What the dev app cannot do, because each is tied to the real application id by a
// service outside this project: Google sign-in, purchases, and push notifications.
// Signing in by email code works, and so does everything behind it.
const SUFFIX = '.dev';
const NAME = 'Llogarite Dev';
const MARKER = '// dev-variant: see plugins/withDevVariant.js';

module.exports = function withDevVariant(config) {
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes(MARKER)) {
      return mod;
    }
    const debugBlock = /(\n\s*debug\s*\{\n)(\s*)(signingConfig signingConfigs\.debug)/;
    if (!debugBlock.test(mod.modResults.contents)) {
      throw new Error('withDevVariant: the debug build type was not found in app/build.gradle');
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      debugBlock,
      (_match, open, indent, signing) => `${open}${indent}${MARKER}\n${indent}applicationIdSuffix "${SUFFIX}"\n${indent}${signing}`,
    );
    return mod;
  });

  return withDangerousMod(config, [
    'android',
    (mod) => {
      const debugDir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'debug');

      // The name under the icon. Resources of the debug source set override the main ones.
      const valuesDir = path.join(debugDir, 'res', 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(
        path.join(valuesDir, 'strings.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${NAME}</string>\n</resources>\n`,
      );

      // The Google services plugin stops the build unless its file lists the id being
      // built. The debug build gets a copy with the real entry repeated under the dev
      // id - enough to build and start; the services themselves still know only the
      // real one.
      const source = path.join(mod.modRequest.projectRoot, 'google-services.json');
      if (fs.existsSync(source)) {
        const services = JSON.parse(fs.readFileSync(source, 'utf8'));
        const real = (services.client ?? [])[0];
        if (real?.client_info?.android_client_info?.package_name) {
          const dev = JSON.parse(JSON.stringify(real));
          dev.client_info.android_client_info.package_name = `${real.client_info.android_client_info.package_name}${SUFFIX}`;
          services.client = [...services.client, dev];
          fs.writeFileSync(path.join(debugDir, 'google-services.json'), `${JSON.stringify(services, null, 2)}\n`);
        }
      }
      return mod;
    },
  ]);
};
