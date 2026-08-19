const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  context: path.resolve(__dirname, '../..'),
  entry: './test/browser/webgl-harness.ts',
  devtool: 'source-map',
  mode: 'development',
  output: { filename: 'webgl-harness.js', path: path.resolve(__dirname, '.build') },
  resolve: { extensions: ['.ts', '.js'], fallback: { fs: false, path: false } },
  module: { rules: [
    { test: /\.worker\.js$/, loader: 'worker-loader', options: { inline: 'no-fallback' } },
    { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' },
    { test: /\.ts$/, loader: 'ts-loader', exclude: /node_modules/ },
    { test: /\.(vert|frag)$/, loader: 'raw-loader' },
  ] },
  plugins: [new HtmlWebpackPlugin({ title: 'F01 WebGL characterization' })],
  devServer: { static: { directory: path.resolve(__dirname, '.build') }, host: '127.0.0.1', port: 4173, client: false },
};
