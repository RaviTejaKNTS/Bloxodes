const path = require("path");

// Resolve babel-preset-expo through expo's own dependency chain so the preset
// lands on the copy that can also see expo-router in this npm workspace.
const babelPresetExpo = require.resolve("babel-preset-expo", {
  paths: [path.dirname(require.resolve("expo/package.json", { paths: [__dirname] }))]
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [babelPresetExpo]
  };
};
