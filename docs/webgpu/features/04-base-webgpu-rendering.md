# F04 — Base WebGPU rendering

| Field      | Value      |
| ---------- | ---------- |
| Model      | Sol        |
| Reasoning  | Extra High |
| Depends on | F03        |

## Outcome

Render opaque V1 and V2 point clouds with `WebGPURenderer` using instanced camera-facing points.

## Deliverables

- Add the adapter and TSL code under `src/rendering/webgpu/`.
- Recognize `WebGPURenderer` and create the WebGPU adapter.
- Register the adapter through the private ESM WebGPU entry scaffolded by F03; importing the package
  root alone must not pull WebGPU/TSL into CommonJS.
- Use the exact wide-point primitive/material pair recorded by F03 from the official
  `webgpu_instance_points` example. It must expand points to camera-facing quads without allocating
  a material per node; do not substitute a primitive or material name from another Three.js release.
- Share one stable native material across all nodes in a cloud.
- Preserve node transforms, local offsets, visibility, point budget, and LRU behavior.
- Reject splat-bearing clouds without throwing: skip the cloud and emit one actionable
  `console.error` per cloud.

Create a WebGPU-local semantic accessor:

```ts
position();
color();
normal();
intensity();
classification();
returnNumber();
numberOfReturns();
pointSourceId();
pointIndex();
```

The accessor preserves component type/normalization and uses this minimum alias contract. Extend it
only with fixture-evidenced aliases; do not change loaders to suit a backend:

| Semantic          | V1 geometry                               | V2 geometry                                                                   | Missing value                |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| position          | `position`                                | `position` for point clouds                                                   | Error for non-splats         |
| color             | `color` (RGB BIN, RGBA LAS)               | `rgba`                                                                        | Deterministic fallback color |
| normal            | `normal`                                  | `normal` decoded from `NORMAL`                                                | `(0, 0, 0)`                  |
| intensity         | `intensity` when decoded                  | `intensity`, `INTENSITY`                                                      | `0`                          |
| classification    | `classification`                          | `classification`, `CLASSIFICATION`                                            | `0`                          |
| return number     | `returnNumber` in LAS; absent from BIN    | `return number`, `returnNumber`, `RETURN_NUMBER`                              | `0`                          |
| number of returns | `numberOfReturns` in LAS; absent from BIN | `number of returns`, `numberOfReturns`, `NUMBER_OF_RETURNS`                   | `0`                          |
| point source ID   | `pointSourceID` in LAS; absent from BIN   | `point source id`, `source id`, `pointSourceID`, `pointSourceId`, `SOURCE_ID` | `0`                          |
| local point index | packed `indices`                          | packed `indices` decoded from `INDICES`, or generated index                   | Exact local integer          |

Decode packed normalized index bytes as the exact local integer; do not treat them as one normalized
float. Detect `centers`/`COVARIANCE0` splat semantics before enforcing required `position`. On first
splat detection, remove partially created WebGPU point handles, skip future point conversion for
that cloud, and log once.

Initial behavior: RGB/RGBA/constant color, fixed and perspective-attenuated size, square/circle
masks, and opaque depth testing/writing.

## Ownership

- Wrapper attributes/geometries borrow typed arrays and are adapter-owned.
- Source `BufferGeometry` remains geometry-node-owned.
- Node eviction disposes wrappers before source geometry and cannot corrupt a later reload.

## Acceptance

- The F01 loader/encoding fixture matrix renders through native WebGPU and `WebGPURenderer`'s WebGL2
  fallback, except the V2 GLTF splat fixture, which exercises the required rejection path.
- No loader or worker branches on renderer family.
- Multiple nodes share one native material and no per-node materials are allocated.
- Eviction/reload, cloud disposal, and repeated initialization pass without leaked or detached arrays.
- Splat rejection is non-throwing, logged once, and does not affect other clouds or WebGL splats.
- Accessor unit tests cover every table row, missing attributes, V1 BIN/LAS differences, V2 metadata
  spellings, normalization, packed local indices, generated indices, and splat detection ordering.

## Verify

Run the shared checks and browser suite on native WebGPU, fallback, and WebGL baselines.

## Start in

- [F01 loader/encoding matrix](../evidence/f01/loader-matrix.md)
- [F03 recorded APIs and ESM-entry decision](03-threejs-upgrade.md#recorded-decisions)
- `src/rendering/core/`
- `src/point-cloud-octree.ts`
- `src/point-cloud-octree-node.ts`
- `src/loading2/decoder.ts` (the accessor table above encodes the attribute names needed from every
  other loader; consult a specific loader only if a fixture disagrees with the table)
- `src/splats-mesh.ts`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
