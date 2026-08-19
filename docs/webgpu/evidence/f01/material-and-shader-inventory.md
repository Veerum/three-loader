# F01 material, picker, and shader inventory

Evidence source: `src/materials/point-cloud-material.ts`, `src/materials/shaders/pointcloud.vert`,
`src/materials/shaders/pointcloud.frag`, `src/point-cloud-octree.ts`, and
`src/point-cloud-octree-picker.ts` at F01 start commit `67d9ff3`.

## Public PointCloudMaterial surface

| Surface | Result |
| --- | --- |
| Constructor parameters: `size`, `minSize`, `maxSize`, `treeType`, `colorRgba` | Observed in constructor; `colorRgba` is selected from V2 geometry in `PointCloudOctree`. |
| General fields: `useDrawingBufferSize`, `lights`, `fog`, `colorRgba`, `numClipBoxes`, `clipBoxes`, `clipBoxesTexture`, `visibleNodesTexture`, `visibleNodeTextureOffsets`, `uniforms`, `attributes` | Observed. `useDrawingBufferSize` changes screen uniforms; node visibility texture supports adaptive size and LOD. The public uniform map is externally iterated by `veerum-viewer`. |
| Uniform-backed properties: `bbSize`, `clipHighlightColor`, `clipHighlightColorBoost`, `clipHighlightColorEnabled`, `clipExtent`, `depthMap`, `fov`, `heightMax`, `heightMin`, `intensityBrightness`, `intensityContrast`, `intensityGamma`, `intensityRange`, `maxSize`, `minSize`, `octreeSize`, `opacity`, `rgbBrightness`, `rgbContrast`, `rgbGamma`, `screenHeight`, `screenWidth`, `size`, `spacing`, `transition`, `color`, `weightClassification`, `weightElevation`, `weightIntensity`, `weightReturnNumber`, `weightRGB`, `weightSourceID`, `opacityAttenuation`, `filterByNormalThreshold`, `highlightedPointCoordinate`, `highlightedPointColor`, `enablePointHighlighting`, `highlightedPointScale`, `normalFilteringMode`, `backgroundMap`, `pointCloudID`, `pointCloudMixingMode`, `stripeDistanceX`, `stripeDistanceY`, `stripeDivisorX`, `stripeDivisorY`, `pointCloudMixAngle`, `renderDepth` | Observed in material/shaders. Browser smoke covers sizing, RGB/RGBA, representative height/intensity/classification modes, opacity, normal filtering, clipping, and point highlighting. |
| Shader-rebuild properties: `useClipBox`, `weighted`, `pointColorType`, `pointSizeType`, `clipMode`, `useEDL`, `shape`, `treeType`, `pointOpacityType`, `useFilterByNormal`, `useTextureBlending`, `usePointCloudMixing`, `highlightPoint`, `hqDepthPass` | Observed. Their define behavior is inventoried below, including the `useClipBox` quirk. |
| Accessors: `gradient`, `classification`, `elevationRange` | Observed. They rebuild or update the corresponding lookup textures/ranges. |
| Methods: `dispose`, `clearVisibleNodeTextureOffsets`, `updateShaderSource`, `applyDefines`, `setPointCloudMixingMode`, `getPointCloudMixingMode`, `setClipBoxes`, `getUniform`, `setUniform`, `updateMaterial`, static `makeOnBeforeRender` | Observed. `updateMaterial` updates camera, screen, spacing and visible-node state. |

The complete public uniform-map keys, including keys without decorated convenience properties, are:
`bbSize`, `blendDepthSupplement`, `blendHardness`, `classificationLUT`, `clipBoxCount`,
`clipBoxesTexture`, `clipHighlightColor`, `clipHighlightColorBoost`, `clipHighlightColorEnabled`,
`clipExtent`, `depthMap`, `diffuse`, `fov`, `gradient`, `heightMax`, `heightMin`,
`intensityBrightness`, `intensityContrast`, `intensityGamma`, `intensityRange`, `isLeafNode`, `level`,
`maxSize`, `minSize`, `octreeSize`, `opacity`, `pcIndex`, `rgbBrightness`, `rgbContrast`, `rgbGamma`,
`screenHeight`, `screenWidth`, `size`, `spacing`, `toModel`, `transition`, `uColor`, `visibleNodes`,
`vnStart`, all six `w*` composite weights, `opacityAttenuation`, `filterByNormalThreshold`, all four
point-highlight values, `backgroundMap`, `normalFilteringMode`, all eight point-cloud-mixing values,
and `renderDepth`. `toModel` and `diffuse` are not referenced by the current point-cloud shaders;
`blendHardness` is declared but only present in commented calculations. These are observed public
map entries, not inferred supported behavior.

`useClipBox` is a public shader-rebuild property, but `applyDefines()` actually selects
`use_clip_box` from `numClipBoxes > 0`; assigning `useClipBox` alone does not enable clipping. This
current quirk is characterization evidence, not a recommendation for the backend-neutral API.

## Define/uniform branches and F09 result

| Branch | Repository result | External result |
| --- | --- | --- |
| Size (`fixed`, `attenuated`, `adaptive`) | Observed; fixed smoke-covered, other two source-covered | Fixed and adaptive used; attenuated unused |
| RGB/RGBA and RGB adjustments | Observed; RGB/RGBA smoke-covered | Used |
| Color modes (`RGB`, `COLOR`, `DEPTH`, `HEIGHT`, `INTENSITY`, gradient, `LOD`, index, classification, return, source, normal, phong, RGB-height, composite) | Representative RGB/height/intensity/classification smoke-covered; all branches inventoried | Depth is multi-pass; height, intensity-gradient, LOD, and composite are used; remaining modes have no direct consumer selection |
| Shapes (square/circle/paraboloid) | Smoke-covered | Circle used; square and paraboloid unused |
| Clip modes and highlight | Clip-outside and highlight smoke-covered; all modes source-inventoried | Disabled, inside, outside, and highlight-inside used; horizontal/vertical unused |
| Normal filtering and opacity | Smoke-covered | Fixed opacity used; normal filtering and attenuated opacity unused |
| `weighted_splats` and its depth-map inputs | Source-inventoried; excluded from F01 parity | Used only in a viewer-owned multi-pass WebGL renderer |
| `use_edl`, `hq_depth_pass` | Source-inventoried; excluded from F01 parity | Material EDL unused; HQ depth used only in the viewer-owned multi-pass WebGL renderer |
| `use_texture_blending`, `use_point_cloud_mixing` | No repository call site | Unused |
| `renderDepth` | Uniform and shader branch observed | No audited-consumer use found |
| `TreeType.KDTREE` | Define branch observed; F01 fixtures/loaders are octrees | No audited-consumer selection found |
| `useDrawingBufferSize` | Source-observed drawing-buffer screen-uniform path | No audited-consumer use found |
| `colorRgba` | Both define settings are smoke-covered; the flag selects GLSL `rgba` instead of `color` | Set by `PointCloudOctree` for V2 and propagated by the viewer's HD pass |
| `useClipBox` / clip-box count | Clip-box count is smoke-covered; `numClipBoxes > 0`, not the direct property, selects `use_clip_box` | Clip boxes are used; no direct `useClipBox` assignment found |

Detailed evidence and migration implications are recorded in `external-consumer-audit.md`.

## PointCloudOctree sizing proxy

`PointCloudOctree.pointSizeType` is a public getter/setter that directly reads and writes
`this.material.pointSizeType`; it has no independent state. The audited viewer uses this proxy, and
the browser suite exercises fixed, attenuated, and adaptive shader sizing with named assertions.

## Picking inventory

`PointCloudOctree.pick(renderer, camera, ray, params)` delegates to its cached
`PointCloudOctreePicker`; `Potree.pick(pointClouds, renderer, camera, ray, params)` delegates to a
shared static picker. `PickParams` has `pickWindowSize`, `pickOutsideClipRegion`, `pixelPosition`,
and `onBeforePickRender(material, renterTarget)`. The callback can mutate the pick material and
render target immediately before render. The F01 browser harness exercises both public pick entry
points with a real in-memory octree. The audited consumer uses only the synchronous octree entry,
passes no `PickParams`, and consumes only `position`.
