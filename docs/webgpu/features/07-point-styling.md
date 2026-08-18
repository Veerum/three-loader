# F07 — Point styling, opacity, filtering, and highlighting

| Field      | Value |
| ---------- | ----- |
| Model      | Sol   |
| Reasoning  | High  |
| Depends on | F06   |

## Outcome

Complete single-pass per-point appearance behavior that does not require clipping.

## Deliverables

- Preserve and validate F04's square/circle baseline; add the paraboloid shape.
- Fixed and distance-attenuated opacity.
- Normal filtering modes and threshold.
- Selected-point coordinate matching, color, and size boost.
- Production-used blending, depth-test, and depth-write semantics from F01.

Circle/paraboloid coordinates come from quad-local coordinates. Paraboloid depth uses TSL depth
output and remains separate from excluded HQ depth. Appearance changes retain the stable public
material; internal pipeline caching is allowed, but never per octree node.

## Acceptance

- Shape silhouettes and paraboloid occlusion match WebGL references.
- Opacity is validated against opaque geometry and overlapping nodes.
- Every normal-filtering mode matches its fixture.
- Highlighting matches the current coordinate/epsilon behavior recorded by F01 and always includes a
  picked point. Duplicate coordinates may highlight together; identity-based highlighting is a
  separate future API change.

## Verify

Run the shared checks and styling browser matrix.

## Start in

- [F01 completion record and linked consumer/behavior evidence](01-characterize-webgl.md#completion-record)
- `src/materials/enums.ts`
- `src/materials/point-cloud-material.ts`
- `src/materials/shaders/pointcloud.vert`
- `src/materials/shaders/pointcloud.frag`
- `src/rendering/webgpu/`
- `src/rendering/core/appearance.ts`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
