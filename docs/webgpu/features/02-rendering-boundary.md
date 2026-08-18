# F02 — Establish the rendering boundary

| Field      | Value      |
| ---------- | ---------- |
| Model      | Sol        |
| Reasoning  | Extra High |
| Depends on | F01        |

## Outcome

Make rendering replaceable without changing WebGL output or the public update flow.

## Deliverables

- Add `PointCloudAppearance` as the only supported behavior/configuration API.
- Add a private per-cloud `PointCloudRenderAdapter` selected from the renderer.
- Define a minimal backend-neutral renderer interface for common APIs. Common code must not import
  `three/webgpu` or TSL.
- Change `sceneNode` from `Points` to `Object3D` and delegate creation/disposal to the adapter.
- Make `pco.material` a readonly getter returning a stable `Material | null`; it becomes `null` after
  cloud disposal.
- Add transactional, idempotent `prepareForRenderer(renderer)` before visibility.
- Route render-state updates through the point cloud/adapter, not `PointCloudMaterial`.
- Bind a cloud to its first renderer family and reject later family mismatch.
- Implement the shared resource-ownership and disposal contract.
- Add the internal adapter-registration/composition seam used by the later ESM-only WebGPU entry;
  WebGL remains available from the package root.

Minimal flow:

```ts
for (const cloud of pointClouds) cloud.prepareForRenderer(renderer);
const result = updateVisibility(pointClouds, camera, renderer);
for (const cloud of pointClouds) cloud.updateRenderState(camera, renderer);
```

## Ownership implementation

- Track adapter-owned per-node resources by geometry-node identity.
- Wrapper attributes may share source typed arrays but must never mutate or dispose them.
- Replace `sceneNode` cleanup that deletes source attributes with adapter cleanup.
- Run V1/V2 one-time disposal handlers before source `BufferGeometry` disposal so adapters detach and
  release wrappers first.
- On cloud disposal: release picker/adapter resources, then every source geometry including the root,
  whose current `parent === null` guard prevents disposal; make repeated disposal a no-op.

## Constraints

- Define the complete typed appearance surface and record a legacy-property migration table.
  Scalars use setters. Colors, gradients, classifications, clip boxes, and selected-point state are
  changed through explicit update methods; callers that intentionally mutate retained compound
  references must call `appearance.invalidate()`.
- Native material inspection is allowed, but supported behavior must not depend on native edits.
- Keep one stable public material per cloud; internal pipeline caching is allowed, per-node materials
  are not.
- Deprecate/remove the optional WebGL material constructor argument after recording its actual F01
  behavior; the current conditional expression does not reliably use the supplied material. A
  retained overload explicitly binds the cloud to WebGL.
- Preserve or deprecate `PointCloudOctree.pointSizeType` by forwarding it to appearance, never to the
  native material.
- Release notes and public migration documentation are handled in F13.

## Acceptance

- F01 output is unchanged.
- A new cloud has usable appearance and `material === null` before its first update.
- First update creates one stable WebGL material; repeated updates do not replace it.
- Two WebGL renderer instances work; a later WebGPU-family renderer is rejected.
- Family classification and retry after initialization failure are tested.
- Unknown renderers fail before binding or partial initialization; disposed clouds are skipped and
  cannot be initialized again.
- LRU eviction and cloud disposal release derived resources without deleting source arrays early.
- Disposal passes before initialization, after initialization, with a loaded root geometry, and when
  repeated; `material === null` afterward.

## Verify

Run the shared checks and F01 browser suite.

## Start in

- [F01 completion record and linked consumer/behavior evidence](01-characterize-webgl.md#completion-record)
- `src/potree.ts`
- `src/point-cloud-octree.ts`
- `src/point-cloud-octree-node.ts`
- `src/point-cloud-octree-geometry-node.ts`
- `src/loading2/octree-geometry-node.ts`
- `src/materials/point-cloud-material.ts`
- `src/types.ts`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
