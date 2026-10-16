// Turns on R8 for release builds: code shrinking and obfuscation, which Google Play asks for.
// Resource shrinking stays off, because React Native loads bundled images by resource name.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'android.enableMinifyInReleaseBuilds';

module.exports = (config) =>
  withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    config.modResults.push({ type: 'property', key: KEY, value: 'true' });
    return config;
  });
