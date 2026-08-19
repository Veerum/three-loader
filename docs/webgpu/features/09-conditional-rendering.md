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
| Weighted rendering and its depth-map inputs  | Pending; likely multi-pass                      | Used by `veerum-viewer` only in its HD multi-pass WebGL renderer; F09 decision pending. |
| Background texture blending                  | Pending                                         | No repository or audited-consumer use found; F09 decision pending. |
| Point-cloud checkerboard/stripe mixing       | Pending                                         | No repository or audited-consumer use found; F09 decision pending. |
| `renderDepth`                                | Pending                                         | Present as a material uniform/shader branch; no audited-consumer use found; F09 decision pending. |
| `TreeType.KDTREE`                            | Pending; loaders in scope are octrees           | No audited-consumer selection found; all F01 loader fixtures and in-scope loaders are octrees; F09 decision pending. |
| `useDrawingBufferSize`                       | Pending; likely renderer-state normalization    | Source-observed screen-uniform path for drawing-buffer dimensions; no audited-consumer use found; F09 decision pending. |
| `colorRgba`                                  | Pending; likely internal attribute-layout state | Set by `PointCloudOctree` for V2 and propagated by the viewer's HD pass; it selects the GLSL `rgba` input instead of `color`, and F01 smoke-covers both settings; F09 decision pending. |
| `useClipBox`/clip-box count shader selection | Pending; likely internal clipping state         | Clip-box count is used and smoke-covered; assigning `useClipBox` alone does not select the define because `numClipBoxes > 0` controls it; F09 decision pending. |
| EDL and HQ-depth flags                       | Excluded by project scope                       | Material EDL is unused by the viewer; HQ depth is used only in its HD multi-pass WebGL renderer; F09 decision pending. |

The F01 entries above are evidence only. They do not pre-apply F09's include/exclude/defer decision
rule or change F09's queued status.

## Decision rule

Use F01's external-consumer evidence and record each decision in this file:

- Port production-used behavior only when it is single-pass and fits the established appearance or
  narrowly scoped render-input boundary.
- Defer behavior requiring a new multi-pass framework, even if a dormant shader branch exists.
- Exclude unused behavior and behavior coupled to excluded HQ/EDL paths.

Do not expose host-specific textures, targets, or backend types through common APIs.

## Deliverables

- Audit every `PointCloudAppearance` property that [F02's legacy property migration
  table](../evidence/f02/legacy-property-migration.md) marked "pending F09": `weighted`, `useEDL`,
  `hqDepthPass`, `blendDepthSupplement`, `blendHardness`, `depthMap`, `useTextureBlending`,
  `backgroundMap`, `usePointCloudMixing`, `pointCloudID`, `pointCloudMixingMode`,
  `pointCloudMixAngle`, `stripeDistanceX`, `stripeDistanceY`, `stripeDivisorX`, `stripeDivisorY`.
  F02 added these to appearance provisionally, pending this feature's decision; they are not
  pre-approved inclusions.
- For each audited property, apply the decision rule above and record the outcome in this file's
  candidate table.
- Remove from `PointCloudAppearance` every property whose decision is exclude or defer. Removal is
  required to satisfy this feature's own acceptance criterion below; do not leave excluded/deferred
  properties in the common appearance API on the assumption that a later feature will remove them.

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
