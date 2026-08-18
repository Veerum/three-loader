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

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
