const path = require('path');
module.exports = {
  entry: {
    fieldlines: "./src/fieldline_new.js",
    dipole: "./src/code.js",
    ffe: "./src/ffe.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  mode: "production",
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
