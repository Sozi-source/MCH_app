const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Block OpenTelemetry modules that use dynamic import() incompatible with Hermes
config.resolver.blockList = [
  /node_modules\/@opentelemetry\/.*/,
];

// Also ban the specific otel import via resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.includes('@opentelemetry') ||
    moduleName.includes('opentelemetry')
  ) {
    return { type: 'empty' };
  }
  // Lottie web dependency — not needed on native, stub it out for web bundler
  if (
    moduleName.includes('@lottiefiles/dotlottie-react') ||
    (moduleName.includes('lottie-react-native') && platform === 'web')
  ) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;