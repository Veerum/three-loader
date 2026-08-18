# F05 — Adaptive point sizing

| Field      | Value      |
| ---------- | ---------- |
| Model      | Sol        |
| Reasoning  | Extra High |
| Depends on | F04        |

## Outcome

Match the default adaptive sizing behavior and complete the WebGPU MVP.

## Deliverables

- Keep visible-node hierarchy construction point-cloud-scoped.
- Sort a copy when building hierarchy data; never reorder `pointCloud.visibleNodes`, whose stable
  order participates in per-object state and picking identity.
- Put level, hierarchy start, leaf state, spacing, and density in typed per-object state.
- Bind node metadata through object-scoped TSL references.
- Hide hierarchy packing behind this WebGPU-local accessor:

```ts
childMask(index);
firstChildOffset(index);
densityOffset(index);
```

- Preserve and validate F04's fixed and attenuated formulas, then add adaptive sizing, including
  projection, spacing, model scale, and min/max size.

## Constraints

- The first implementation may reuse RGBA texture encoding, but TSL logic cannot know its packing.
- Do not expose the current 2048-node texture limit as an API contract.

## Acceptance

- Default appearance renders without fallback behavior.
- Fixed, attenuated, and adaptive references match WebGL within documented raster tolerance.
- V1/V2, perspective/orthographic, scaled clouds, and density-present/missing nodes pass.
- Hierarchy updates preserve the externally observed visible-node order and point identity.
- The hierarchy accessor can move to a storage buffer without changing sizing logic.

## Verify

Run the shared checks and sizing browser matrix at deterministic camera distances.

## Start in

- `src/materials/point-cloud-material.ts` (`updateVisibilityTextureData`)
- `src/materials/shaders/pointcloud.vert`
- `src/rendering/webgpu/`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
