# F06 — Point color parity

| Field      | Value     |
| ---------- | --------- |
| Model      | Terra     |
| Reasoning  | High      |
| Depends on | F02a, F05 |

## Outcome

Port genuine single-pass `PointColorType` behavior through TSL.

## Deliverables

Preserve and validate F04's RGB/RGBA and constant-color baseline. Add depth, height/elevation,
RGB-height, intensity, intensity gradient, LOD, classification, return number, source ID, normal,
composite, and point-index color through the F04 accessor.

- Preserve gamma, brightness, contrast, ranges, transition, and composite weights.
- Own gradient/classification resources in the adapter and synchronize appearance revisions.
- Define and test deterministic fallback colors for missing optional attributes.
- Treat Phong according to F01; do not invent lighting when current shaders use zero lights.
- Preserve or explicitly record an intentional correction for observed shader behavior: zero
  intensity is gray in intensity-gradient mode, classification alpha zero hides a point, composite
  weight zero hides a point, and depth color writes fragment depth.

## Acceptance

- Every required mode has a WebGL/WebGPU fixture comparison.
- Gradient and classification replacement do not replace `pco.material`.
- Missing attributes cannot cause shader failure.
- Color-space handling is explicit and consistent across renderer families.
- F01 behavior decisions for the listed shader edge cases are represented by named tests.

## Verify

Run the shared checks and color-mode browser matrix.

## Start in

- [F01 completion record and linked behavior evidence](01-characterize-webgl.md#completion-record)
- `src/materials/enums.ts`
- `src/materials/point-cloud-material.ts`
- `src/materials/shaders/pointcloud.vert`
- `src/materials/shaders/pointcloud.frag`
- `src/rendering/webgpu/`
- `src/rendering/core/point-cloud-appearance.ts`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
