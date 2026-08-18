# F03 — Upgrade Three.js

| Field      | Value |
| ---------- | ----- |
| Model      | Terra |
| Reasoning  | High  |
| Depends on | F02   |

## Outcome

Upgrade the lockfile baseline from Three.js r170 to the latest stable minor selected during
implementation and pin a tested WebGPU/TSL baseline. Do not infer the baseline from an existing
`node_modules/` tree.

## Deliverables

- Upgrade Three.js in isolated increments if migration notes require it.
- Pin the development version exactly and choose a deliberately tested peer range.
- Upgrade TypeScript and `@types/three` as required.
- Support `three/webgpu` and `three/tsl` in bundling, externals, and declarations.
- Externalize `three` and every `three/*` subpath.
- Scaffold the private ESM-only WebGPU entry chosen for the MVP; F04 wires its adapter registration.
  Keep the existing CommonJS root WebGL-usable and free of ESM-only WebGPU/TSL requires.
- Add consumer fixtures for root ESM, root CommonJS, and WebGPU ESM. The WebGPU fixture proves that
  values imported through `three` and `three/webgpu` share the same Three.js core identity.
- Add an initialized `WebGPURenderer` smoke test; renderer construction and `init()` remain host-owned.
- Record the exact chosen versions and APIs: current wide-point primitive/material, object-scoped
  update hook, fragment-depth output, render-target readback, renderer initialization, and
  `forceWebGL`. Use the official `webgpu_instance_points` example and do not rely on the removed
  pre-r173 `InstancedPointsNodeMaterial` name.
- Run the full F01 WebGL benchmark on the upgraded stack. Store the authoritative WebGL baseline and
  environment metadata for F12.

## Constraints

- Do not implement point-cloud WebGPU rendering.
- Resolve all WebGL regressions before continuing.
- Do not combine dependency migration with the GLSL-to-TSL port.

## Acceptance

- Build, lint, declarations, tests, and example compile on the pinned versions.
- F01 WebGL results remain valid.
- The browser smoke test initializes `WebGPURenderer` on supported WebGPU and fallback lanes.
- Output preserves external Three.js subpath imports, bundles no Three.js code, emits no
  `require('three/webgpu')`/`require('three/tsl')` from CommonJS, and passes all consumer fixtures.
- The upgraded WebGL benchmark and reproducibility metadata are recorded for F12.

## Verify

Run the shared checks and browser suite; inspect root ESM, root CommonJS, and WebGPU ESM output for
embedded Three.js code or invalid subpath imports.

## Start in

- [F01 completion record and linked harness/benchmark evidence](01-characterize-webgl.md#completion-record)
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `webpack.config.js`
- `webpack.esm.config.js`
- `webpack.config.example.js`
- `example/`
- The private WebGPU entry selected in this feature

## Recorded decisions

- Three.js / TypeScript / `@types/three` versions:
- ESM WebGPU entry and adapter-registration path:
- Wide-point primitive/material and object-update APIs:
- Fragment depth and async readback APIs:
- Consumer-fixture paths:
- WebGL benchmark evidence:

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
