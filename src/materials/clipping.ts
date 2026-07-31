import { Box3, Color, Matrix4, Vector3 } from 'three';

export enum ClipMode {
  DISABLED = 0,
  CLIP_OUTSIDE = 1,
  HIGHLIGHT_INSIDE = 2,
  CLIP_HORIZONTALLY = 3,
  CLIP_VERTICALLY = 4,
  CLIP_INSIDE = 5,
}

/**
 * The geometric shape a clip primitive is tested against on the GPU.
 * Must be kept in sync with the shape branch in `pointcloud.vert`.
 */
export enum ClipShape {
  Box = 0,
  Capsule = 1,
}

/**
 * A single primitive the point cloud is clipped/highlighted against.
 *
 * The `box`/`inverse`/`matrix`/`position` fields describe an oriented box and
 * are required for every primitive so that box-only consumers (3D Tiles
 * clipping, CPU OBB tests) keep working; for non-box shapes they should be
 * populated from the shape's axis-aligned bounding box so those consumers
 * degrade gracefully to the bounding box.
 *
 * The optional fields drive the generalized GPU test:
 *  - `shape`  selects the test branch (defaults to Box when omitted).
 *  - `color`  is the per-primitive highlight color; when present it overrides
 *             the global `clipHighlightColor` uniform, enabling different
 *             object types (pipes vs tanks vs cubes) to highlight in different
 *             colors simultaneously.
 *  - `a`/`b`/`radius` describe a capsule (segment + radius) in world space.
 *  - `groupId` identifies the source object (for future CPU classification).
 */
export interface IClipBox {
  box: Box3;
  inverse: Matrix4;
  matrix: Matrix4;
  position: Vector3;
  shape?: ClipShape;
  color?: Color;
  a?: Vector3;
  b?: Vector3;
  radius?: number;
  groupId?: number;
}

/** @deprecated alias kept for readability; identical to {@link IClipBox}. */
export type IClipPrimitive = IClipBox;
