# F09 — Conditional rendering audit

| Field      | Value    |
| ---------- | -------- |
| Model      | Sol      |
| Reasoning  | High     |
| Depends on | F01, F08 |

## Outcome

Resolve conditional shader branches without introducing a multi-pass framework.

## Candidates

F01 must supply evidence for every row; do not treat this as an exhaustive inventory if F01 finds an
additional externally controlled branch.

| Candidate                                    | Initial classification                          | F01 evidence / final decision |
| -------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| Weighted rendering and its depth-map inputs  | Pending; likely multi-pass                      |                               |
| Background texture blending                  | Pending                                         |                               |
| Point-cloud checkerboard/stripe mixing       | Pending                                         |                               |
| `renderDepth`                                | Pending                                         |                               |
| `TreeType.KDTREE`                            | Pending; loaders in scope are octrees           |                               |
| `useDrawingBufferSize`                       | Pending; likely renderer-state normalization    |                               |
| `colorRgba`                                  | Pending; likely internal attribute-layout state |                               |
| `useClipBox`/clip-box count shader selection | Pending; likely internal clipping state         |                               |
| EDL and HQ-depth flags                       | Excluded by project scope                       |                               |

## Decision rule

Use F01's external-consumer evidence and record each decision in this file:

- Port production-used behavior only when it is single-pass and fits the established appearance or
  narrowly scoped render-input boundary.
- Defer behavior requiring a new multi-pass framework, even if a dormant shader branch exists.
- Exclude unused behavior and behavior coupled to excluded HQ/EDL paths.

Do not expose host-specific textures, targets, or backend types through common APIs.

## Acceptance

- Every candidate has an evidenced **include**, **exclude**, or **defer: multi-pass** decision.
- Included behavior has parity tests and a documented host contract.
- Excluded/deferred behavior is absent from the common appearance API.
- No multi-pass orchestration is added.

## Verify

Run the shared checks and browser tests for included behavior.

## Start in

- [F01 completion record and linked external-consumer audit](01-characterize-webgl.md#completion-record)
- `src/materials/point-cloud-material.ts`
- `src/materials/shaders/pointcloud.vert`
- `src/materials/shaders/pointcloud.frag`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
