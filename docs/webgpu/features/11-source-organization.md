# F11 — Rendering source organization

| Field      | Value    |
| ---------- | -------- |
| Model      | Terra    |
| Reasoning  | Medium   |
| Depends on | F09, F10 |

## Outcome

Move stable common/WebGL rendering code into explicit folders without moving loaders or re-moving
WebGPU code already created in its final location.

## Target

```text
src/rendering/
  core/
    point-cloud-appearance.ts
    point-cloud-render-adapter.ts
    point-cloud-renderer.ts
    classification.ts
    clipping.ts
    gradients/
    picker.ts
  webgl/
    webgl-point-cloud-render-adapter.ts
    material.ts
    picker.ts
    shaders/
    index.ts
  webgpu/
    material.ts
    render-adapter.ts
    picker.ts
    tsl/
```

`point-cloud-appearance.ts`, `point-cloud-render-adapter.ts`, and `point-cloud-renderer.ts` under
`core/`, and `webgl-point-cloud-render-adapter.ts` and `index.ts` under `webgl/`, are the names F02
already shipped; F11 keeps them as-is rather than renaming. `classification.ts`, `clipping.ts`,
`gradients/`, and `picker.ts` are created by the features that own that behavior (F06, F08, F10) and
only need to land in these locations, not be renamed by F11.

Loaders stay in `src/loading/`, `src/loading2/`, and `src/workers/`.
Backend-neutral enums, gradients, classification data, clip-box types, appearance state, and picking
contracts belong in `core`. Only GLSL materials/shaders and WebGL picker/adapter implementation
belong in `webgl`; only node materials/TSL and WebGPU picker/adapter implementation belong in
`webgpu`.

## Dependency rule

```text
webgl -> core <- webgpu
```

Only the internal factory/composition module may import both backends. Core declarations expose no
backend-specific material, renderer target, GPU resource, or TSL type.

## Constraints

- F04 already uses `src/rendering/webgpu/`; do not create or migrate through `src/webgpu/`.
- Keep moves mechanical and preserve package exports.
- Keep WebGPU private until F12 passes.
- Add a named `check:deps` command (or equivalently named architectural test) that fails when
  `core` imports a backend, one backend imports the other, or loaders/workers import renderer code.
  The existing production build remains the circular-import gate.

## Acceptance

- Import direction is statically verifiable.
- Loaders/workers contain no renderer imports.
- WebGL/WebGPU tests pass after moves.
- Generated declarations expose only intended common types.

## Verify

Run the shared checks and browser suite plus:

```sh
npm run check:deps
```

## Start in

- `src/index.ts`
- `src/materials/`
- `src/point-cloud-octree-picker.ts`
- `src/rendering/`
- `webpack.config.prod.js`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
