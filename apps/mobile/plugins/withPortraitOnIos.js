const { withInfoPlist } = require('expo/config-plugins');

// Keeps the iPhone app in portrait.
//
// app.json's "orientation" is "default" so that Android has no manifest lock
// (see withPortraitOnPhones.js), and on iOS that same setting allows every
// rotation. The screens are laid out for portrait only, so the list of
// orientations is narrowed here, for iOS alone.
module.exports = function withPortraitOnIos(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UISupportedInterfaceOrientations = ['UIInterfaceOrientationPortrait'];
    return cfg;
  });
};
