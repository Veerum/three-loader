# F02a — Rendering boundary follow-ups

| Field      | Value |
| ---------- | ----- |
| Model      | Sol   |
| Reasoning  | High  |
| Depends on | F02   |

## Outcome

Resolve the defects found auditing the merged F02 implementation. Two are performance regressions
against pre-F02 WebGL behavior; the rest are coverage and robustness gaps that later features would
otherwise inherit.

F02 was marked Complete with these deferred deliberately so the boundary work could be committed.
Close this feature before F06, which is the first feature to diff WebGPU output against the WebGL
appearance mapping. It is independent of F03 and may land in either order.

Line numbers below are anchors from the F02 commit and shift as fixes land; follow the named symbols.

## Findings

| ID  | Severity | Finding                                                        | Status  |
| --- | -------- | -------------------------------------------------------------- | ------- |
| I1  | High     | Every appearance change forces a shader recompile              | Open    |
| I2  | High     | Gradient texture regenerated and disposed on every change      | Open    |
| I3  | Medium   | The appearance-to-material mapping is effectively untested     | Open    |
| I4  | Medium   | Root eviction can desync `updateSplats()`'s `children[0]`      | Open    |
| I5  | Low      | Unrelated frustum-indexing bug fix rode along in F02           | Open    |
| I6  | Low      | `assertRendererCompatible` is undeclared public surface        | Open    |

## I1 — Shader recompile on every appearance change

`WebGLPointCloudRenderAdapter.applyAppearance()` ends with an unconditional
`material.updateShaderSource()` (`src/rendering/webgl/webgl-point-cloud-render-adapter.ts:183`),
which rebuilds both GLSL sources through `applyDefines()` and sets `needsUpdate = true`
(`src/materials/point-cloud-material.ts:438`), forcing a program recompile on the next render.

`applyAppearance()` is revision-gated, so this fires on any appearance change, including pure-uniform
scalars: `size`, `minSize`, `maxSize`, `intensityBrightness`, the six `weight*` values, `transition`,
`opacityAttenuation`. Before F02 those were plain uniform writes; only `@requiresShaderUpdate()`
properties rebuilt the shader. A consumer dragging a point-size slider now recompiles every frame.

The call is load-bearing and must not simply be deleted: `setClipBoxes()` runs two lines earlier and
mutates `numClipBoxes`, which drives `define('use_clip_box')`
(`src/materials/point-cloud-material.ts:479`).

Fix direction: add a second structural-revision counter to `PointCloudAppearance`, bumped only by
inputs that `applyDefines()` and `updateShaderSource()`'s blending block actually read — `treeType`,
`pointSizeType`, `shape`, `pointColorType`, `clipMode`, `pointOpacityType`, the `rgbGamma`/
`rgbBrightness`/`rgbContrast` trio, `useFilterByNormal`, `useEDL`, `weighted`, `highlightPoint`,
`useTextureBlending`, `usePointCloudMixing`, `opacity`, and `clipBoxes.length` crossing zero. Gate
`updateShaderSource()` on that counter. Re-derive the list from `applyDefines()` rather than trusting
this enumeration.

Acceptance: changing only a pure-uniform scalar performs no shader rebuild; changing any
define-affecting property or crossing the zero-clip-box boundary still does; F01 output unchanged.

## I2 — Gradient texture churn

`applyAppearance()` assigns `material.gradient = snapshot.gradient.slice()`
(`src/rendering/webgl/webgl-point-cloud-render-adapter.ts:136`) — a fresh array every call. F02
removed the setter's reference-equality guard (`src/materials/point-cloud-material.ts:563`),
correctly, because a fresh array made it dead; the consequence is that `generateGradientTexture()`
runs and the previous texture is disposed on every revision bump.

`classification` is the model to follow: its setter deep-compares before calling
`recomputeClassification()` (`src/materials/point-cloud-material.ts:577`, `:601`).

Fix direction: compare gradient contents before regenerating, or track a gradient revision on
appearance and skip the assignment when unchanged. Do not restore the reference-equality guard.

Acceptance: repeated `applyAppearance()` with an unchanged gradient allocates no texture; replacing
the gradient still regenerates and disposes exactly one; no leak across repeated replacement.

## I3 — Untested appearance-to-material mapping

The F02 unit tests drive a `TestAdapter` stub, not `WebGLPointCloudRenderAdapter`; the F02 browser
case exercises only `size` and `color`. Roughly 58 of the ~60 assignments in `applyAppearance()`
(`src/rendering/webgl/webgl-point-cloud-render-adapter.ts:119-183`) have no assertion behind them. A
crossed wire such as `material.weightElevation = appearance.weightIntensity` passes lint, tsc, all
unit tests, and all browser tests.

Defaults were hand-checked during the audit and do line up, including the non-obvious case:
appearance's `minSize: 2` matches the `PointCloudMaterial` constructor's
`getValid(parameters.minSize, 2.0)`, not the `DEFAULT_MIN_POINT_SIZE = 1` uniform default. Defaults
matching says nothing about whether each property is wired to its counterpart.

This is the surface F06–F08 diff WebGPU against, so a wrong mapping here surfaces later as a false
WebGPU parity bug.

Fix direction: a table-driven test over the real adapter that sets every appearance property to a
distinct non-default value, runs `applyAppearance()`, and asserts each material target. Cover the
compound update methods and the `setUniform`-only properties (`blendDepthSupplement`,
`blendHardness`) as well as the scalar setters.

Acceptance: every row of the F02 legacy migration table has a named assertion; swapping any two
assignments in `applyAppearance()` fails a test.

## I4 — Root eviction can desync `updateSplats()`

Dropping the `!this.parent` / `this.parent != null` guard from both geometry-node `dispose()`
implementations is the intended F02 ownership fix, but it also makes root reachable by
`LRU.disposeSubtree()` at runtime, and the adapter's `disposeSceneNode()` calls `removeFromParent()`.

`PointCloudOctree.updateSplats()` still does `let mesh = this.children[0] as Mesh`
(`src/point-cloud-octree.ts:247`). With the root scene node detached, `children[0]` becomes the
`SplatsMesh` added at `src/point-cloud-octree.ts:262`, and `SplatsMesh.update()` then reads
`mat.uniforms.octreeSize` and `mat.uniforms.visibleNodes.value.image.data` off the splat material
(`src/splats-mesh.ts:321-329`, `:370`).

Splat-path only, and root is `lru.touch()`ed whenever visible, so it is improbable — but it was
structurally impossible before F02 and is merely unlikely now.

Fix direction: hold an explicit root-scene-node reference (or look it up by name) instead of
indexing `children[0]`.

Acceptance: a test detaches the root scene node with a `SplatsMesh` present and shows `updateSplats()`
does not read the splat material; existing WebGL splat behavior is unchanged.

## I5 — Unrelated bug fix bundled into F02

`src/potree.ts:424` and `:429` switch `frustums.push(...)` / `cameraPositions.push(...)` to indexed
assignment. This is a genuine pre-existing bug fix — the enclosing loop `continue`s past
uninitialized clouds, so `push` misaligned both arrays against the `QueueItem.pointCloudIndex` used
to read them back. It is unrelated to the rendering boundary, landed in a feature whose acceptance is
"F01 output is unchanged", and nothing tests it.

Fix direction: add a regression test with a mixed initialized/uninitialized cloud list so the fix is
recorded as intentional. Do not revert it.

Acceptance: a named test fails against the `push` form and passes against indexed assignment.

## I6 — Undeclared public surface

`PointCloudOctree.assertRendererCompatible` (`src/point-cloud-octree.ts:149`) is public on an
exported class, so it ships in the declarations and becomes de-facto API, but it appears in neither
F02's deliverables nor the legacy migration table. Mark it `@internal` or document it before F13
freezes exports.

Acceptance: the method is either absent from the generated public declarations or listed as
supported API.

## Constraints

- Do not change public appearance semantics; these are implementation and coverage fixes.
- Do not restore any reference-equality guard that a per-call clone makes dead.
- Keep the fixes in `src/rendering/` and `src/materials/`; do not touch loaders or workers.
- `updatePointClouds()` remains transactional per cloud, not across clouds. An adapter
  initialization failure on one cloud may leave earlier clouds initialized; this matches F02's
  documented contract and is not in scope here.

## Acceptance

- Every finding above is **fixed** or has a recorded **won't fix** rationale in the table.
- F01 browser output and the F02 boundary tests remain green.
- No new public API is introduced.

## Verify

Run the shared checks and the F01/F02 browser suite.

## Start in

- [F02 completion record](02-rendering-boundary.md#completion-record)
- [F02 legacy property migration](../evidence/f02/legacy-property-migration.md)
- `src/rendering/webgl/webgl-point-cloud-render-adapter.ts` (`applyAppearance`)
- `src/rendering/core/point-cloud-appearance.ts`
- `src/materials/point-cloud-material.ts` (`updateShaderSource`, `applyDefines`, `set gradient`)
- `src/point-cloud-octree.ts` (`updateSplats`, `assertRendererCompatible`)
- `src/potree.ts`
- `test/unit/rendering-boundary.test.ts`

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
