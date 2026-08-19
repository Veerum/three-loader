# F01 external-consumer audit: veerum-viewer

## Scope and provenance

- Consumer repository: `git@github.com:Veerum/veerum-viewer.git`
- Audited consumer revision: `ccb23117c16e73e8e07610f0def851c3c07e5566` (`JL-webgpu`)
- Revision's recorded `three-loader` gitlink: `bc452193b6f91f2d9299505b75d31ff4ebfd3577`
- Audited working submodule revision: `67d9ff372955effe003d031f657a9ee71ba5acb1`, with the
  uncommitted F01 changes described by this evidence
- Audit method: read-only source and test inspection. The consumer build and tests were deliberately
  not used for F01 evaluation or validation because `veerum-viewer` does not support WebGPU.

The consumer repository was clean except for the expected modified submodule entry. Generated docs,
dependencies, build output, and the `three-loader` directory itself were excluded from usage search.
The audit searched every tracked `@three-loader` reference. Detailed behavior was traced through
`src/objects/PointCloudModel.ts`, `src/controllers/scene/PointCloudsController.ts`,
`src/renderers/HDPointsRenderer.ts`, `src/objects/cross-section/CrossSectionExtractor.ts`, related
cross-section/clipping/helpers, public exports, examples, and their tests. Build integration was
traced through the root/demo/example Vite and TypeScript configurations, `package.json`, and
`.circleci` configuration.

## Build and module integration

- `three-loader` is a git submodule and is built before `veerum-viewer` in `full-build` and CircleCI.
- Vite aliases `@three-loader` to `three-loader/build/`; TypeScript aliases it to
  `three-loader/build/index.d.ts`. The example and demo-viewer repeat those aliases.
- The consumer uses the built root entry, not source deep imports. It expects an ESM-compatible root
  and declaration file.
- Both repositories declare Three.js `^0.170.0`; Vite explicitly deduplicates `three`. Types and
  runtime objects passed across the boundary must retain one shared Three.js identity.
- `ClipMode`, `PointSizeType`, `PointShape`, and `IClipBox` are re-exported by the public
  `@veerum/viewer` package, so their names and values affect downstream viewer consumers.

## Imported three-loader surface

Runtime imports:

- `ClipMode`, `PointColorType`, `PointShape`, `PointSizeType`
- `PointCloudMaterial`, `PointCloudOctree`, `Potree`
- `V1_LOADER`, `V2_LOADER`

Type imports:

- `IClipBox`, `IGradient`, `IPointCloudGeometryNode`, `IVisibilityUpdateResult`
- `PCOGeometry`, `PotreeVersion`

## Loading and geometry requirements

- V1 is selected for `cloud.js`, V2 for `metadata.json`, and V2 is the fallback for an unknown file
  name. Callers can explicitly override with `PotreeVersion`.
- `V1_LOADER` and `V2_LOADER` are invoked as `(fileName, getUrl, xhrRequest)`. `getUrl` may return a
  string or promise. `xhrRequest` must accept `RequestInfo`/`RequestInit`, preserve range headers,
  and work with consumer-added authorization headers and fetch priority.
- The returned `PCOGeometry` is passed directly to `new PointCloudOctree(potree, geometry)`.
- Geometry bounds require `tightBoundingBox` when present, otherwise `boundingBox`, plus `offset`.
- The consumer reads and writes `pcoGeometry.maxNumNodesLoading`.
- Cross-section extraction directly traverses `pcoGeometry.root` and geometry-node `children`,
  `level`, `boundingBox`, `boundingSphere`, `loaded`, `loading`, `failed`, `geometry`, and `load()`.
- Loaded node geometry must keep its `BufferGeometry` attributes and typed arrays available for CPU
  extraction. The consumer copies every attribute except `indices`, preserving item size,
  normalization, and array constructor. V2 `rgba` is renamed to `color` for extracted WebGL points.
- Cross sections call `potree.lru.touch(node)` to prevent eviction while extracting.

These geometry uses constrain F02's ownership boundary: backend scene handles may change, but source
geometry, typed arrays, node traversal, and loader behavior cannot be invalidated by rendering.

## Potree and octree lifecycle requirements

- The consumer constructs `new Potree()` and uses `pointBudget`, `maxNumNodesLoading`, static
  `Potree.maxLoaderWorkers`, `lru.touch`, and `updatePointClouds(octrees, camera, WebGLRenderer)`.
- It consumes the full `IVisibilityUpdateResult` shape and reports `numVisiblePoints`; it also reads
  octree `numVisiblePoints` and `progress` for loading progress.
- It writes `PointCloudOctree.minNodePixelSize`, reads `visibleNodes`, and calls `dispose()`.
- `PointCloudOctree` remains an `Object3D` that can be added to a scene and traversed.

## Material and rendering requirements

The standard WebGL path directly reads and writes the native `pco.material`:

- defaults: `rgbGamma = 2.2`, adaptive size, composite color, circle shape;
- visuals: `pointColorType`, `gradient`, `intensityRange`, `size`, `shape`, and the octree
  `pointSizeType` proxy;
- uniforms via `setUniform`: `rgbGamma`, `rgbBrightness`, `rgbContrast`, and `opacity`;
- clipping: `clipMode`, `setClipBoxes`, `clipHighlightColor`, `clipHighlightColorBoost`, and
  `clipHighlightColorEnabled`;
- explicit `updateShaderSource()` after compound visual changes.

The consumer also implements `setMaterial(material)` by replacing `pco.material`, traversing the
octree, and assigning that material to every Three.js `Points` descendant. This is active WebGL
behavior, but conflicts with the planned stable native-material identity. It is an appearance API
migration requirement, not a WebGPU behavior to reproduce.

Cross sections construct and dispose their own `PointCloudMaterial`. They copy every uniform value
from the source by iterating `Object.keys(material.uniforms)`, then set fixed size,
`pointColorType`, `shape`, `gradient`, and call `updateShaderSource()`. The uniform map's existence and
names are therefore an active WebGL integration dependency.

## Picking requirements

- `PointCloudModel.raycast` calls synchronous
  `pointCloudOctree.pick(renderer, camera, ray)` after a bounding-box precheck and consumes only a
  nullable result with `position`.
- Picking is intentionally skipped when the renderer has scissor testing enabled.
- No use was found for static `Potree.pick`, `PointCloudOctreePicker`, `PickParams`,
  `pickWindowSize`, `pickOutsideClipRegion`, `pixelPosition`, or `onBeforePickRender`.

F10 therefore needs the synchronous octree call to remain available for WebGL while the viewer
eventually migrates to `pickAsync()` for WebGPU.

## Clipping type requirements

`IClipBox` is used beyond point-cloud rendering, including tile clipping and cross-section paths.
Consumers construct it with `box`, `matrix`, `inverse`, and `position`; `inverse` is the inverse
world matrix passed to the point-cloud material. `ClipMode.DISABLED`, `CLIP_INSIDE`,
`CLIP_OUTSIDE`, and `HIGHLIGHT_INSIDE` have evidenced source/tests or example usage.

## F09 conditional-rendering audit

| Candidate | Consumer result | Evidence/requirement |
| --- | --- | --- |
| HQ depth (`hqDepthPass`) | Used, multi-pass WebGL | `HDPointsRenderer` creates a depth material, enables HQ depth, renders to a float target, and shares its depth texture with the attribute pass. |
| Weighted rendering (`weighted`) | Used, multi-pass WebGL | The attribute material enables weighted accumulation and is normalized in a fullscreen pass. |
| `PointColorType.DEPTH` | Used, multi-pass WebGL | Selected for the HD depth pass. |
| Texture blending | Unused | No consumer reference to `useTextureBlending` or `backgroundMap`. |
| Point-cloud mixing | Unused | No consumer reference to `usePointCloudMixing` or its mode/stripe uniforms. |
| Material EDL (`useEDL`) | Unused | Viewer EDL is a separate post-processing pass and does not enable the three-loader shader branch. |
| Three-loader HQ blur/normalize materials | Unused | The viewer owns its normalization and post-processing materials. |
| Composite coloring and weights | Used | Composite is the default; the HD attribute pass copies RGB, intensity, elevation, classification, return-number, and source-ID weights. |
| LOD, intensity-gradient, height color | Used, single-pass | Viewer visual modes select these branches. |
| RGB/RGBA selection | Used | V1/V2 rendering and the HD attribute pass propagate `colorRgba`; cross sections normalize V2 `rgba` to `color`. |
| Fixed/adaptive sizing | Used | Main clouds use adaptive; extracted cross sections use fixed. No attenuated-size consumer use found. |
| Circle shape | Used | Default and HD passes. No square/paraboloid consumer selection found. |
| Clip inside/outside/highlight | Used, single-pass | Point-cloud clipping and custom clip-highlight uniforms are active. |
| Horizontal/vertical clip modes | Unused | No consumer selection found. |
| Normal filtering | Unused | No consumer reference to the define or uniforms. |
| Point-coordinate highlighting | Unused | No consumer reference to `highlightPoint` or highlighted-point coordinates. Clip highlighting is a different, used behavior. |
| Attenuated opacity | Unused | Opacity is changed, but `pointOpacityType`/attenuation is not. |
| `renderDepth` | Unused | No consumer reference. |
| GLTF splat rendering | Unknown production usage | The generic V2 loader may receive such data, but no repository source identifies a splat dataset. Do not infer usage from metadata URLs. |

## Optional-material constructor behavior

The consumer always calls `new PointCloudOctree(potree, geometry)` without the optional material.
The current constructor expression is parsed as
`(material || pcoGeometry instanceof OctreeGeometry) ? new PointCloudMaterial({colorRgba: true}) :
new PointCloudMaterial()`: any truthy supplied material is discarded and replaced with a new RGBA
material, even for V1 geometry. Without an optional material, V2 `OctreeGeometry` gets the RGBA
material and V1 gets the RGB material. The consumer does not depend on the supplied-material quirk;
it does, however, replace `pco.material` after construction for the HD multi-pass path.

## Migration requirements for later features

- Preserve loader signatures, URL/request customization, geometry bounds, node traversal, CPU
  attribute access, loading flags, LRU touch, and visibility-result fields as backend-neutral APIs.
- Preserve all listed WebGL material behavior through the migration; add independent three-loader
  characterization where current F01 tests do not yet exercise a used branch.
- Move standard visual and clipping changes to `pco.appearance`; the viewer's direct native-material
  mutation/replacement must be migrated before it can use WebGPU.
- Treat the viewer's HD renderer as evidenced multi-pass WebGL usage for F09. Do not make it a WebGPU
  parity requirement without a product decision.
- Keep cross-section extraction viable through backend-neutral decoded geometry. Its custom WebGL
  material and uniform-copy behavior require a later consumer migration, not a shared WebGPU
  material abstraction.
- Preserve synchronous WebGL picking while providing `pickAsync()` as the renderer-neutral path.
- Validate these requirements in `three-loader` tests. Do not use `veerum-viewer` as the WebGPU test
  harness or release gate.
