const { execFileSync } = require('child_process');
const path = require('path');

const extra = process.argv.slice(2);
if (extra.length > 0 && !(extra.length === 1 && extra[0] === '--smoke')) {
  throw new Error('Only --smoke is supported by the F01 benchmark harness.');
}

execFileSync(process.execPath, [
  require.resolve('@playwright/test/cli'), 'test', '--config',
  path.resolve(__dirname, '../browser/playwright.config.cjs'), '--grep', 'WebGL benchmark smoke',
], { stdio: 'inherit' });
