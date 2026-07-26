const { getDefaultConfig } = require('expo/metro-config');

// Anchors Metro's project root to apps/mobile explicitly (SDK 54's
// recommended monorepo setup - see the postinstall patch in package.json
// for the actual entry-file resolution bug this project also hit).
module.exports = getDefaultConfig(__dirname);
