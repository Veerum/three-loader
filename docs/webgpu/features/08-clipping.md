# F08 — Clipping parity

| Field      | Value |
| ---------- | ----- |
| Model      | Sol   |
| Reasoning  | High  |
| Depends on | F07   |

## Outcome

Match CPU node rejection and GPU point clipping without coupling octree logic to a native material.

## Deliverables

Implement disabled, clip outside/inside, highlight inside, horizontal/vertical screen clipping, and
highlight color/boost/enable state.

- CPU `shouldClip()` reads `pco.appearance`.
- The adapter owns GPU clip data and its texture/buffer representation.
- TSL uses a backend-local clip accessor, not float-texture packing.
- Clip-box arrays/matrices are updated through appearance methods. If a caller mutates a retained
  matrix directly, it must call `appearance.invalidate()` before the next update.
- Preserve the observed any-box union semantics: clip-outside keeps points inside any box;
  clip-inside removes points inside any box. CPU rejection remains conservative and applies only
  where an entire node is provably invisible.
- Screen clipping uses active-target dimensions and a tested viewport orientation.
- Picking uses the same rules and preserves the explicit outside-clip override.

## Acceptance

- All modes match deterministic WebGL fixtures for transformed clouds and clip boxes.
- CPU rejection never removes a node containing a visible point.
- Multiple clip boxes update without material replacement.
- Screen clipping works on canvas and offscreen targets.

## Verify

Run the shared checks and clipping browser matrix.

## Start in

- `src/potree.ts` (`shouldClip`)
- `src/materials/clipping.ts`
- `src/materials/point-cloud-material.ts`
- `src/materials/shaders/pointcloud.vert`
- `src/rendering/webgpu/`
- `src/rendering/core/point-cloud-appearance.ts`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
