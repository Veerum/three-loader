# F02 legacy material-to-appearance migration

`PointCloudOctree.appearance` is the supported backend-neutral configuration surface. The native
`PointCloudOctree.material` getter exists for inspection only; it is `null` until renderer
preparation, retains one identity for the cloud, and returns to `null` after disposal.

Scalar appearance properties use setters and increment the appearance revision. Compound values
are retained by reference; replace them with the named update method, or call
`appearance.invalidate()` after deliberately mutating a retained value.

## Public property migration

| Legacy `PointCloudMaterial` surface | `PointCloudAppearance` migration |
| --- | --- |
| `size`, `minSize`, `maxSize`, `treeType`, `colorRgba` | Same-named scalar properties. `colorRgba` is initialized from the decoded layout. |
| `pointSizeType`, `pointColorType`, `shape`, `pointOpacityType` | Same-named scalar properties. `PointCloudOctree.pointSizeType` remains as a forwarding compatibility property. |
| `opacity`, `opacityAttenuation`, `transition` | Same-named scalar properties. |
| `rgbGamma`, `rgbBrightness`, `rgbContrast` | Same-named scalar properties. |
| `intensityGamma`, `intensityBrightness`, `intensityContrast` | Same-named scalar properties. |
| `intensityRange` | `updateIntensityRange([min, max])`. |
| `heightMin`, `heightMax`, `elevationRange` | `updateElevationRange([min, max])`. Initial values remain derived from the transformed cloud bounds. |
| `color` / `uColor` | `updateColor(color)`. |
| `gradient` | `updateGradient(gradient)`. |
| `classification` | `updateClassification(classification)`. |
| `weightRGB`, `weightIntensity`, `weightElevation`, `weightClassification`, `weightReturnNumber`, `weightSourceID` | Same-named scalar properties. |
| `clipMode` | Same-named scalar property. |
| `clipBoxes`, `setClipBoxes()` | `updateClipBoxes(clipBoxes)`. Clip-box count and GPU data are derived by the adapter. |
| `clipExtent` | `updateClipExtent(extent)`. |
| `clipHighlightColor` | `updateClipHighlightColor(color)`. |
| `clipHighlightColorBoost`, `clipHighlightColorEnabled` | Same-named scalar properties. |
| `highlightPoint`, `highlightedPointCoordinate`, `highlightedPointColor`, `enablePointHighlighting`, `highlightedPointScale` | `updateSelectedPoint({ highlight, coordinate, color, enabled, scale })`. |
| `useFilterByNormal`, `filterByNormalThreshold`, `normalFilteringMode` | Same-named scalar properties. |
| `weighted`, `useEDL`, `hqDepthPass` | Same-named scalar properties. They preserve the WebGL configuration surface pending F09's multi-pass decision. |
| `blendDepthSupplement`, `blendHardness` uniform entries | Same-named scalar properties, pending F09 with the weighted/HQ-depth path. |
| `depthMap` | `updateDepthMap(texture)`, pending F09. |
| `useTextureBlending` | Same-named scalar property, pending F09. |
| `backgroundMap` | `updateBackgroundMap(texture)`, pending F09. |
| `usePointCloudMixing`, `pointCloudID`, `pointCloudMixingMode`, `pointCloudMixAngle`, `stripeDistanceX`, `stripeDistanceY`, `stripeDivisorX`, `stripeDivisorY` | Same-named scalar properties, pending F09. |
| `renderDepth` | Same-named scalar property. |
| `bbSize` | `updateBoundingBoxSize(size)`. |
| `useDrawingBufferSize`, `lights`, `fog` | Same-named scalar properties. |

## Derived and native-only surface

| Legacy surface | F02 treatment |
| --- | --- |
| `useClipBox`, `numClipBoxes`, `clipBoxCount` | Derived from `appearance.clipBoxes`; direct toggling is removed. This also removes the old `useClipBox`/count inconsistency. |
| `clipBoxesTexture`, `classificationLUT`, gradient texture, `visibleNodesTexture`, `visibleNodeTextureOffsets` | Adapter-owned derived GPU resources; no appearance property exposes their packing. |
| `fov`, `screenWidth`, `screenHeight`, `spacing`, `octreeSize` | Adapter-computed render state. |
| `level`, `isLeafNode`, `pcIndex`, `vnStart`, `visibleNodes` | Adapter-computed per-frame or per-node state. |
| `diffuse`, `toModel`, `blendHardness`'s commented shader calculations | `diffuse` and `toModel` remain native-only because the point-cloud shaders do not use them; `blendHardness` remains typed because it is part of the weighted path audited in F09. |
| `uniforms`, `attributes`, `getUniform()`, `setUniform()` | Native inspection only. Supported configuration uses the typed appearance members above. |
| `clearVisibleNodeTextureOffsets()`, `updateMaterial()`, `makeOnBeforeRender()` | WebGL-adapter implementation details. |
| `updateShaderSource()` / `applyDefines()` | `appearance.invalidate()` after retained compound mutation; scalar and update methods invalidate automatically. Shader/pipeline refresh is adapter-owned. |
| `dispose()` | Cloud/adapter-owned. Consumers dispose the cloud rather than its native material. |
| `setPointCloudMixingMode()` / `getPointCloudMixingMode()` | Read/write `appearance.pointCloudMixingMode`. |

## Constructor and native material

The optional `PointCloudOctree(..., material)` parameter is deprecated. F01 proved that the old
conditional discarded every truthy supplied material and constructed a new RGBA material. F02
continues to ignore the supplied instance so it does not invent a dependency on that quirk, but the
presence of the argument explicitly binds the cloud to the WebGL family. New code omits the argument
and configures `appearance` before the first `updatePointClouds()`.

Replacing `pco.material`, disposing it directly, copying its uniform map, or using native mutations
as the supported configuration path is no longer supported. Those audited viewer integrations are
consumer migrations and do not define the WebGPU material contract.
