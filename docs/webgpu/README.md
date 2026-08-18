# WebGPU point-cloud rendering

## Fresh-context workflow

For one feature, read only:

1. This README for shared decisions and sequencing.
2. The relevant file in [`features/`](features/).
3. The source entry points named by that feature.

Merged code and tests are the source of truth. Do not reread completed feature documents unless the
current feature links to a recorded decision. Resolve missing product details with the developer;
do not guess production usage.

At feature start, confirm dependencies are complete, inspect `git status`, and follow moved symbols
from the **Start in** paths. The plan was audited against commit `bc45219`; use `package-lock.json`,
not an existing `node_modules/` tree, to establish the dependency baseline.

When a feature starts or finishes, update its status in the table below. On completion, run its
feature-specific verification and these shared checks:

```sh
npm test -- --runInBand
npm run lint
npm run build
```

Record durable feature-specific decisions in that feature file. Promote decisions that constrain
later work into **Fixed decisions** below. Do not mark a feature complete with a known regression.
Fill in that feature's compact **Completion record** and link large screenshots, consumer audits,
behavior matrices, or benchmarks under `docs/webgpu/evidence/`; do not paste logs into plan files.

## Current status

- Updated: 2026-08-18
- Architecture: decided
- Implementation: not started
- Current feature: [F01 — Characterize current WebGL behavior](features/01-characterize-webgl.md)
- WebGPU release policy: keep private through F12; prepare the public release in F13
- Development policy: each feature lands on an internal feature branch. Intermediate internal API
  breaks are allowed; do not add temporary compatibility layers that will be removed before F13.

Status values: **Ready**, **Queued** (waiting on dependencies), **In progress**, **Complete**, and
**Deferred**.

## Goal and scope

Add point-cloud rendering through Three.js `WebGPURenderer` while preserving the existing loaders,
octree selection, point budget, LRU, and observed WebGL behavior.

In scope:

- Potree V1 BIN and LAS/LAZ, plus V2 DEFAULT, BROTLI, and non-splat GLTF point clouds.
- TSL-based wide points using the primitive/material path proven and pinned in F03.
- Current sizing, coloring, clipping, filtering, opacity, highlighting, and picking behavior.
- Existing `WebGLRenderer`, native WebGPU, and `WebGPURenderer`'s WebGL2 fallback.
- Performance validation and a `rendering/core`, `rendering/webgl`, `rendering/webgpu` layout.

Excluded from parity:

- EDL, HQ depth, and their blur/normalize paths; the current implementations are incomplete.
- Gaussian splats; they are a separate, deferred migration.
- New GPU-driven features such as compute culling or indirect drawing before F12 proves a need.
- A new multi-pass rendering framework.

F09 audits weighted rendering, texture blending, point-cloud mixing, and externally driven shader
flags. Production-used single-pass behavior may be ported; multi-pass behavior is deferred.

## Architecture

```text
Loaders / workers -> decoded BufferGeometry -> octree visibility / LRU
                                                   |
                                                   v
                                      PointCloudRenderAdapter
                                         /               \
                              WebGL: Points       WebGPU: TSL wide points
```

Shared code owns decoded data and octree behavior. A private per-cloud render adapter, selected
during the first `updatePointClouds()`, owns native rendering behavior.

### Fixed decisions

- `pco.appearance` is the stable backend-neutral configuration API. All supported behavior goes
  through appearance. Compound changes are observed only through explicit update methods or an
  explicit `appearance.invalidate()` call; mutating a referenced object alone is not tracked.
- `pco.material` is the native `Material | null`; it is created on first update and retains stable
  identity until disposal. Consumers may inspect it but must not replace, dispose, or use it as the
  supported appearance API.
- One public native material exists per cloud, never per node. Internal renderer pipeline caching is
  allowed and does not change the public material identity.
- A cloud binds to the first renderer family it sees, not a renderer instance. Crossing between
  `WebGLRenderer` and `WebGPURenderer` requires recreating the cloud.
- `WebGPURenderer` remains one family whether it uses WebGPU or its WebGL2 fallback.
- Renderer-family detection is structural (`isWebGLRenderer`/`isWebGPURenderer`). An unknown
  renderer fails before binding or mutating a cloud.
- `PointCloudOctreeNode.sceneNode` is `Object3D`: a lifecycle/visibility handle, not a primitive,
  geometry, material, or draw-count contract.
- Loaders remain renderer-agnostic. Backend attribute accessors normalize V1/V2 layouts.
- WebGPU code starts in `src/rendering/webgpu/`; no intermediate `src/webgpu/` location is used.
- TSL point attributes and visible-node hierarchy data use WebGPU-local accessors. Their GPU packing
  is private and replaceable.
- Point identity is `(point cloud, geometry node, local point index)`; async picking adds explicit
  geometry-node and local-index fields without removing existing decoded result properties.
- `pickAsync()` is the common picking API; WebGL wraps its synchronous implementation.
- A splat-bearing cloud supplied to `WebGPURenderer` is skipped without throwing and logs one clear
  `console.error` per cloud. Existing WebGL splat behavior remains unchanged.
- The MVP exposes WebGPU through an ESM-only entry. The existing CommonJS root remains usable for
  WebGL; whether to drop CommonJS entirely is a post-MVP decision. F03 validates the private entry
  with consumer tests and F13 makes it public.
- Shared enums, appearance data, gradients, classifications, and clipping types live in
  `rendering/core`; backend folders contain backend-specific behavior only.
- F01 builds the deterministic browser/benchmark harness. F03 records the authoritative upgraded
  WebGL baseline, and F12 declares numeric thresholds from that baseline before optimization.

### Renderer lanes

- **WebGL baseline:** `WebGLRenderer` on the exact dependency versions pinned by F03.
- **WebGPU native:** `WebGPURenderer` using a WebGPU backend.
- **WebGPU fallback:** `WebGPURenderer({ forceWebGL: true })`; this remains the WebGPU renderer
  family and is not equivalent to `WebGLRenderer`.

### Initialization path

```text
prepareForRenderer(renderer)
  -> select and initialize adapter transactionally
  -> create native material
  -> bind renderer family
updateVisibility(...)
  -> adapter creates backend scene handles
adapter.update(visibleNodes, camera, renderer, appearance)
```

Before preflight, appearance is usable and `pco.material === null`. Initialization is idempotent and
retryable after failure. `WebGPURenderer.init()` remains host-owned; a disposed cloud cannot be
initialized again.

### Resource ownership and disposal

- A geometry node exclusively owns its decoded `BufferGeometry`, attributes, and typed arrays.
- Backend scene handles borrow source attributes; they never delete, replace, detach, resize, or
  dispose source geometry or arrays.
- An adapter may create wrapper attributes/geometries that share a source typed array. The adapter
  owns those wrapper objects and all derived GPU data.
- Per-node resources are tracked by geometry-node identity, not by array identity or node name.
- On LRU eviction or node disposal: detach the scene handle, dispose adapter-owned wrappers/GPU
  resources, drop adapter references, then dispose source geometry.
- Cloud disposal releases picker and adapter resources before traversing/discarding source geometry,
  including root-node geometry, and is safe before initialization, after initialization, and when
  repeated.

F02 establishes this lifecycle and changes V1/V2 geometry-node disposal callbacks to run before
source geometry is invalidated. No backend may reproduce the current destructive deletion of source
attribute arrays from a scene handle.

## Implementation order

| ID  | Feature                                                             | Status   | Agent            | Depends on             |
| --- | ------------------------------------------------------------------- | -------- | ---------------- | ---------------------- |
| F01 | [Characterize WebGL](features/01-characterize-webgl.md)             | Ready    | Terra — High     | —                      |
| F02 | [Rendering boundary](features/02-rendering-boundary.md)             | Queued   | Sol — Extra High | F01                    |
| F03 | [Upgrade Three.js](features/03-threejs-upgrade.md)                  | Queued   | Terra — High     | F02                    |
| F04 | [Base WebGPU rendering](features/04-base-webgpu-rendering.md)       | Queued   | Sol — Extra High | F03                    |
| F05 | [Adaptive sizing](features/05-adaptive-sizing.md)                   | Queued   | Sol — Extra High | F04                    |
| F06 | [Color parity](features/06-color-parity.md)                         | Queued   | Terra — High     | F05                    |
| F07 | [Point styling and filtering](features/07-point-styling.md)         | Queued   | Sol — High       | F06                    |
| F08 | [Clipping](features/08-clipping.md)                                 | Queued   | Sol — High       | F07                    |
| F09 | [Conditional rendering audit](features/09-conditional-rendering.md) | Queued   | Sol — High       | F01, F08               |
| F10 | [Async picking](features/10-async-picking.md)                       | Queued   | Sol — Extra High | F08                    |
| F11 | [Rendering source organization](features/11-source-organization.md) | Queued   | Terra — Medium   | F09, F10               |
| F12 | [Performance](features/12-performance.md)                           | Queued   | Sol — Extra High | F11                    |
| F13 | [Prepare release](features/13-prepare-release.md)                   | Queued   | Terra — High     | F12                    |
| F14 | [Gaussian splats](features/14-gaussian-splats.md)                   | Deferred | Sol — Extra High | F13, separate approval |

Milestones:

- Boundary complete: F01–F03.
- WebGPU MVP: F04–F05.
- Point-cloud parity: F06–F10.
- Release gate: F11–F12.
- Release prepared: F13.

## Global completion criteria

- WebGL characterization remains green after every feature.
- The F01 loader/encoding fixture matrix passes in-scope behavior through native WebGPU and the
  WebGL2 fallback; V2 GLTF splats follow the documented non-fatal rejection path.
- No loader or worker depends on a renderer family.
- Common APIs and declarations expose no backend-specific material, target, or TSL types.
- Family mismatch, splat rejection, initialization failure, picking failure, and disposal preserve
  valid cloud and renderer state.
- LRU and cloud disposal release derived resources without mutating source ownership.
- Package output keeps Three.js external and contains no duplicate Three.js runtime.
- The CommonJS build emits no `require('three/webgpu')` or `require('three/tsl')`. The WebGPU ESM
  consumer test proves `three` and `three/webgpu` resolve one shared Three.js core identity.
- F12 thresholds pass and F13 records API/release changes in `CHANGELOG.md` before public export.
