module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 uses react-native-worklets plugin instead of its own
      'react-native-worklets/plugin',
    ],
  }
}
