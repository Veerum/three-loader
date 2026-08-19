const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'webgl.spec.cjs',
  timeout: 45_000,
  fullyParallel: false,
  use: { browserName: 'chromium', viewport: { width: 320, height: 320 }, deviceScaleFactor: 1 },
  webServer: {
    command: 'npx webpack serve --config webpack.config.cjs --port 4173',
    port: 4173,
    reuseExistingServer: false,
    timeout: 45_000,
  },
});
