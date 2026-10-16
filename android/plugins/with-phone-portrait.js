// Phones stay in portrait; tablets and foldables (600 dp and wider) rotate freely.
// Android 16 ignores orientation locks on large screens and Google Play flags them in the manifest,
// so instead of android:screenOrientation the lock is set at launch, on phones only.
const { withMainActivity } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

module.exports = (config) =>
  withMainActivity(config, (config) => {
    let src = config.modResults.contents;
    src = mergeContents({
      tag: 'zalumo-phone-portrait-import',
      src,
      newSrc: 'import android.content.pm.ActivityInfo',
      anchor: /^import android\.os\.Bundle$/m,
      offset: 1,
      comment: '//',
    }).contents;
    src = mergeContents({
      tag: 'zalumo-phone-portrait',
      src,
      newSrc: '    if (resources.configuration.smallestScreenWidthDp < 600) requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT',
      anchor: /^\s*super\.onCreate\(/m,
      offset: 0,
      comment: '//',
    }).contents;
    config.modResults.contents = src;
    return config;
  });
