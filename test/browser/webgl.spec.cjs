const { test, expect } = require('@playwright/test');

async function results(page) {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  return page.evaluate(() => window.__F01__.run());
}

test('F01 WebGL rendering fixtures preserve named visual behavior', async ({ page }) => {
  const report = await results(page);
  expect(report.webgl2).toBe(true);
  expect(report.fixtures.map((fixture) => fixture.name)).toEqual([
    'v1-bin', 'v1-las', 'v1-laz', 'v2-default', 'v2-brotli', 'v2-gltf-points', 'v2-gltf-splats',
  ]);
  expect(report.fixtureResults.filter((fixture) => fixture.result).every((fixture) => fixture.result.pixels > 0)).toBe(true);
  expect(report.splatRoute).toBe(true);
  expect(report.scenarios.rgb.pixels).toBeGreaterThan(0);
  expect(report.scenarios.rgba.pixels).toBeGreaterThan(0);
  expect(report.scenarios.fixedSmall.pixels).toBeLessThan(report.scenarios.fixedLarge.pixels);
  expect(report.scenarios.attenuated.pixels).toBeGreaterThan(0);
  expect(report.scenarios.adaptive.pixels).toBeGreaterThan(0);
  expect(report.scenarios.circle.pixels).toBeLessThan(report.scenarios.square.pixels);
  expect(report.scenarios.clipped.pixels).toBeLessThan(report.scenarios.square.pixels);
  expect(report.scenarios.filtered.pixels).toBe(0);
  expect(report.scenarios.highlighted.redPixels).toBeGreaterThan(0);
  expect(report.scenarios.picking.pixels).toBe(1);
  expect(report.scenarios.picking.redPixels).toBe(1);
  expect(report.scenarios.picking.pointIndex).toBe(1);
});

test('F01 WebGL benchmark smoke emits repeatable instrumentation', async ({ page }, testInfo) => {
  const report = await results(page);
  const benchmark = await page.evaluate(() => window.__F01__.benchmark({ frames: 3 }));
  expect(benchmark.frames).toBe(3);
  expect(benchmark.drawCalls).toBeGreaterThan(0);
  expect(benchmark.points).toBe(report.pointCount);
  expect(benchmark.uploads.initial.count).toBeGreaterThan(0);
  expect(benchmark.pickingSucceeded).toBe(true);
  expect(benchmark.pickingLatencyMs).toBeGreaterThanOrEqual(0);
  expect(benchmark.environment.webglVersion).toContain('WebGL');
  await testInfo.attach('webgl-benchmark-smoke.json', {
    body: JSON.stringify(benchmark, null, 2), contentType: 'application/json',
  });
  console.log(`F01_WEBGL_BENCHMARK_SMOKE=${JSON.stringify(benchmark)}`);
});
