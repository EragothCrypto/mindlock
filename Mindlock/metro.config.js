const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
    watchFolders: [],
    resolver: {
        blockList: [
            // Exclude Android build directories
            /android\/app\/\.cxx\/.*/,
            /android\/\.gradle\/.*/,
            /android\/app\/build\/.*/,
        ],
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
