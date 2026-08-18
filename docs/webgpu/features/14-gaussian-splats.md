# F14 — Gaussian splats (deferred)

| Field      | Value                     |
| ---------- | ------------------------- |
| Model      | Sol                       |
| Reasoning  | Extra High                |
| Depends on | F13 and separate approval |

## Scope boundary

Gaussian splats are not part of point-cloud WebGPU support. Until this separate project is approved,
`WebGPURenderer` rejects splat-bearing clouds non-fatally as defined in F04. Do not add covariance,
harmonic, sorting, or splat-ID requirements to the point-cloud adapter.

## Future design inputs

- Packed covariance, position/color, node, and harmonic data.
- Instanced ellipse rendering.
- Sorting correctness and worker/WASM compatibility.
- Optional WebGPU compute sorting.
- Splat-specific ID picking.
- Texture versus storage-buffer layouts.
- Memory budgets and maximum splat counts.

The implementation may reuse renderer-family detection, ownership conventions, and async-picking
patterns, but needs its own adapter and performance gates.

## Start condition

- F13 is complete and point-cloud WebGPU support is stable in production.
- WebGPU splats receive explicit scope, priority, fixtures, and release thresholds.

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
