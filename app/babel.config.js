module.exports = (api) => {
  api.cache(true);
  return {
    // Expo bindet das Worklets-Plugin sonst selbst ein, aber ohne Bundle Mode
    presets: [['babel-preset-expo', { worklets: false }]],
    plugins: [
      [
        'react-native-worklets/plugin',
        // Bundle Mode: die Erkennung läuft als gewöhnlicher Modulcode in der Worklet-Runtime
        { bundleMode: true, strictGlobal: true, importForwarding: { relativePaths: ['src/foto.ts'] } },
      ],
    ],
  };
};
