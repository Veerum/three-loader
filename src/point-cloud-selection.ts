import { Color, ColorRepresentation, Matrix4, Vector3 } from 'three';

export interface PointCloudSelectionRegion {
  id: string;
  /** World-to-unit-box transform; the box occupies [-0.5, 0.5] on each axis. */
  inverse: Matrix4;
  color: ColorRepresentation;
}

/**
 * Immutable selection shared by highlights, masks and projection input.
 * The first matching region wins when boxes overlap.
 */
export class PointCloudSelection {
  private readonly regions: { id: string; inverse: Matrix4; color: Color }[];

  constructor(regions: readonly PointCloudSelectionRegion[]) {
    if (regions.length > 32) {
      throw new Error('At most 32 selection regions are supported');
    }
    const ids = new Set<string>();
    this.regions = regions.map((region) => {
      const matrix = region.inverse;
      if (
        ids.has(region.id) ||
        !matrix.elements.every(Number.isFinite) ||
        !Number.isFinite(matrix.determinant()) ||
        matrix.determinant() === 0 ||
        matrix.elements[3] !== 0 ||
        matrix.elements[7] !== 0 ||
        matrix.elements[11] !== 0 ||
        matrix.elements[15] !== 1
      ) {
        throw new Error('Selection regions require unique ids and invertible affine transforms');
      }
      ids.add(region.id);
      return {
        id: region.id,
        inverse: matrix.clone(),
        color: new Color(region.color),
      };
    });
  }

  /** Returns a detached match, or undefined for context points. */
  public match(position: Vector3) {
    const local = new Vector3();
    const region = this.regions.find((candidate) => {
      local.copy(position).applyMatrix4(candidate.inverse);
      return Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) <= 0.5;
    });
    return region ? { id: region.id, color: region.color.clone() } : undefined;
  }

  /** Detached region data for material adapters. */
  public getRegions() {
    return this.regions.map((region) => ({
      id: region.id,
      inverse: region.inverse.clone(),
      color: region.color.clone(),
    }));
  }
}
