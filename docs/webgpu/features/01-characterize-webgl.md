# F01 — Characterize current WebGL behavior

| Field     | Value |
| --------- | ----- |
| Model     | Terra |
| Reasoning | High  |

## Outcome

Create the executable example, test harness, and deterministic scenarios that later features use to
preserve observed production behavior. Do not establish the authoritative performance baseline yet.

## Deliverables

- Add a Playwright browser render harness; the current Jest test is only a smoke test.
- Add deterministic repository-local fixtures for V1 BIN, V1 LAS/LAZ, V2 DEFAULT, V2 BROTLI, V2
  non-splat GLTF, and V2 GLTF splats, with fixed cameras, viewports, and expected images/results.
  Tests must not depend on production URLs or timing-sensitive network loading. Where two encodings
  produce an identical decoded layout, record that equivalence and reuse behavioral expectations
  rather than duplicating the full matrix.
- Cover sizing, RGB/RGBA, representative color modes, shapes, clipping, filtering, opacity,
  highlighting, and picking.
- With the developer, audit external consumers for direct `pco.material` reads/writes, custom
  material construction, picking hooks, and conditional shader features.
- Inventory every public `PointCloudMaterial` property, shader define/uniform branch,
  `PointCloudOctree.pointSizeType`, both pick entry points, and `PickParams` callbacks. Give each an
  observed/used/unused/unknown result for F02/F09.
- Build a repeatable benchmark scenario and instrumentation for frame/update time, draw calls,
  points/nodes, allocations/uploads, memory estimates, and picking latency. F01 validates the
  harness in smoke mode; F03 records the authoritative WebGL measurements after the upgrade.
- Add repeatable `test:browser` and `benchmark:webgl` package scripts with a documented smoke mode.

## Constraints

- Do not refactor production rendering.
- EDL and HQ depth are not parity requirements.
- Keep CI fixtures small; keep large benchmark data outside routine CI if needed.
- Ask the developer for fixtures, consumer revisions, and expected behavior when they are not in the
  repository. Record unknowns instead of inferring production usage.

## Acceptance

- A visible rendering or picking regression fails a named test.
- Every required behavior maps to a fixture and expected result.
- Every loader/encoding row is either covered directly or linked to recorded decoded-layout
  equivalence; existing WebGL splat behavior has its own characterization.
- The external audit identifies appearance migration needs and gives every F09 candidate an evidenced
  used/unused/multi-pass result.
- The audit records the actual optional-material constructor behavior and names the exact external
  repositories/revisions searched.
- The benchmark scenario runs deterministically and emits the environment metadata F03/F12 need;
  no F01 result is treated as the release baseline.

## Verify

Run the shared checks plus:

```sh
npm run test:browser
npm run benchmark:webgl -- --smoke
```

## Start in

- `src/works.test.ts`
- `src/materials/point-cloud-material.ts`
- `src/materials/shaders/pointcloud.vert`
- `src/materials/shaders/pointcloud.frag`
- `src/point-cloud-octree-picker.ts`
- `src/point-cloud-octree.ts`
- `src/loading/binary-loader.ts`
- `src/loading/laslaz/las-laz-loader.ts`
- `src/loading2/decoder.ts`
- `src/loading2/octree-loader.ts`
- `example/`

## Completion record

- Commit/status: Began from clean `67d9ff372955effe003d031f657a9ee71ba5acb1` on `JL-webgpu`;
  F01 is complete in the uncommitted working tree. No commit was created.
- Delivered paths: Playwright configuration/harness/spec under `test/browser/`, decoder matrix test
  under `test/unit/`, shared fixtures under `test/webgl/fixtures/`, benchmark runner under
  `test/benchmark/`, package scripts/dependency lock updates, and F01 evidence under
  `docs/webgpu/evidence/f01/`.
- Decisions for later features: `veerum-viewer` is usage evidence only, never a WebGPU validation
  dependency; its native-material replacement/uniform-copy integrations require migration to
  appearance; its weighted/HQ-depth renderer is active multi-pass WebGL behavior but remains outside
  WebGPU parity. These constraints are promoted to the overview's Fixed decisions.
- Verification: `npm test -- --runInBand` (2 suites, 5 tests), `npm run lint` (pass with existing
  source warnings), `npm run build` (pass with existing bundle-size warnings), `npm run test:browser`
  (2 tests), and `npm run benchmark:webgl -- --smoke` (1 smoke test) all pass on 2026-08-18.
- Evidence: [loader matrix](../evidence/f01/loader-matrix.md),
  [material/shader/picker inventory](../evidence/f01/material-and-shader-inventory.md),
  [consumer audit](../evidence/f01/external-consumer-audit.md), and
  [benchmark harness](../evidence/f01/benchmark-harness.md).

## Working record

- Started from clean worktree at `67d9ff372955effe003d031f657a9ee71ba5acb1` on `JL-webgpu`.
- Dependency baseline is `package-lock.json` (lockfile v3); it pins Three.js `0.170.0`.
- Dependencies were installed from that lockfile with `npm ci --ignore-scripts
  --install-strategy=nested`; the pre-existing `node_modules` tree was not used as the baseline.
- Read-only external audit covers `veerum-viewer` revision
  `ccb23117c16e73e8e07610f0def851c3c07e5566`, whose recorded submodule gitlink is
  `bc452193b6f91f2d9299505b75d31ff4ebfd3577`. The viewer was not built or tested.
- Deterministic wire/decoder fixtures, fixed-camera WebGL behavior and picking, the splat-mesh route,
  full inventories, and actual smoke instrumentation are implemented. The authoritative performance
  baseline remains explicitly deferred to F03.
- Every acceptance criterion is satisfied; F01 is Complete with no external-input blocker.
