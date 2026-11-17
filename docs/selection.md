# Point-cloud selection

three-loader owns selection shading and the mask render pass. Consumers use public
APIs without patching shader text, uniforms, compile hooks or node callbacks.

```ts
import { PointCloudSelection, PointCloudSelectionMask } from '@pnext/three-loader';

const selection = new PointCloudSelection([
  { id: 'pump', inverse: worldToUnitBox, color: '#21c7f5' },
]);
pointCloud.material.setSelection(selection);
// Clear with pointCloud.material.setSelection().

const mask = new PointCloudSelectionMask(() => pointCloud, selection);
maskScene.add(mask);
// After Potree.updatePointClouds and before each mask draw:
mask.sync();
// Render maskScene into a caller-owned cleared RGBA/depth target.
// When finished:
mask.dispose();
```

Selection is an immutable snapshot of up to 32 boxes; each inverse maps world
coordinates to the inclusive unit box [-0.5, 0.5]. First match wins overlaps.
`match(worldPoint)` returns detached id/color data; `getRegions()` returns detached
regions. Nonfinite/singular/non-affine transforms and duplicate ids are rejected.

`PointCloudMaterial.setSelection()` updates native uniforms without recompilation
or changing `onBeforeCompile` / `customProgramCacheKey`. The standard color pass
mixes region color at 35%. Depth, renderDepth and point-index output are unchanged.
Point shape and clipping remain native shader responsibilities. These behaviors
are implemented in the checked-in pointcloud shaders, not string substitutions.

The mask getter may return null before loading or after disposal. `sync()` borrows
visible node geometry, follows ancestor visibility and prunes stale/disposed nodes.
The helper owns proxy nodes/material only, never source geometry or textures.
It owns the per-node LOD/camera callback forwarding. RGB contains premultiplied
region color and alpha contains occupancy, including for black regions; context
points write depth and zero occupancy. Mask selection is independent of the
source material's selection. To replace it, dispose and create another mask.

The caller owns the target, scene, timing and renderer state restoration. Render
before the normal pipeline, not recursively inside a render callback. Do not add
the mask to the normal color scene. Non-point scene geometry and photo-depth
occlusion are not included. HD/splat selection is unsupported: consumers with
independent HD materials must not infer support from the standard point material.

`npm test` runs the existing Jest smoke test, builds the ESM distribution and runs
selection/material/mask contract tests against that distribution. The viewer's
multi-viewport browser fixture separately verifies actual GPU output, clipping
and depth/pick isolation against this package.
