/**
 * react-native.config.js
 * Font asset declaration for react-native-asset linking.
 * After adding fonts to android/app/src/main/assets/fonts/,
 * run: npx react-native-asset  (or the font will be linked via Metro automatically)
 */

module.exports = {
    project: {
        android: {},
        ios: {},
    },
    assets: ['./android/app/src/main/assets/fonts/'],
};
