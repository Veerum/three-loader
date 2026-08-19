# F10 — Async GPU picking

| Field      | Value      |
| ---------- | ---------- |
| Model      | Sol        |
| Reasoning  | Extra High |
| Depends on | F08        |

## Outcome

Provide one backend-neutral asynchronous picking API with GPU rendering/readback.

## API

```ts
Potree.pickAsync(
  pointClouds: PointCloudOctree[],
  renderer: PointCloudRenderer,
  camera: Camera,
  ray: Ray,
  params?: Partial<PickAsyncParams>,
): Promise<PickPoint | null>;

pointCloud.pickAsync(
  renderer: PointCloudRenderer,
  camera: Camera,
  ray: Ray,
  params?: Partial<PickAsyncParams>,
): Promise<PickPoint | null>;

Potree.disposePickResources(renderer: PointCloudRenderer): void;
```

Argument order, defaults, pixel/ray interpretation, closest-pixel selection, decoded result
properties, and null behavior match the existing synchronous APIs. WebGL resolves the existing
synchronous result. Existing `pick()` remains WebGL-only and may be deprecated, but is not removed
for the MVP.

`PickAsyncParams` preserves the existing options. Its pre-render hook receives a backend-neutral
context containing base Three.js `Material` and `RenderTarget` views rather than
`PointCloudMaterial`/`WebGLRenderTarget`. The legacy synchronous `pick()` retains the existing
WebGL-specific callback signature.

## Deliverables

- Preserve all existing decoded result properties and add explicit `geometryNode` and
  `localPointIndex` fields so identity is cloud, geometry node, and local point index.
- Add a WebGPU ID pass and asynchronous render-target readback.
- Match visible size, shape, clipping, and normal filtering.
- Preserve the pick-outside-clip option.
- Serialize overlapping requests or allocate safe per-renderer state.
- Store renderer-instance resources in a `WeakMap`.
- Define active ownership as well as reachability: per-cloud picker resources are released by cloud
  disposal; renderer-keyed resources used by static multi-cloud picking are released by
  `Potree.disposePickResources(renderer)`. A `WeakMap` alone is not GPU-resource disposal.
- Restore target, viewport/scissor, clear, and temporary material state on success or failure.
- Replace the current one-byte/255-node identity limit through wider IDs or deterministic batching.
  Do not retain a common API limit merely because the WebGL encoding is narrow.
- Decode returned attributes from geometry-node-owned source geometry, not adapter fallback or
  wrapper attributes.

## Acceptance

- WebGL and WebGPU return equivalent positions, normals, and decoded attributes.
- Multiple clouds, more than 255 visible nodes, and large local indices map correctly.
- Concurrent requests are deterministic.
- Failed readback does not corrupt renderer state or the next frame. Cancellation is not part of the
  MVP unless an explicit `AbortSignal` contract is added before implementation.
- High-DPI and offscreen-target picking pass.

## Verify

Run the shared checks and picking browser matrix on all renderer lanes.

## Start in

- [F01 material/shader/picker inventory](../evidence/f01/material-and-shader-inventory.md#picking-inventory)
- [F01 external-consumer picking audit](../evidence/f01/external-consumer-audit.md#picking-requirements)
- `src/point-cloud-octree-picker.ts`
- `src/point-cloud-octree.ts`
- `src/potree.ts`
- `src/rendering/webgpu/`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
