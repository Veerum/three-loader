import { Color, Matrix4 } from 'three';
import { PointCloudSelection } from '../point-cloud-selection';
import { IUniform } from './types';

export function createSelectionUniforms(mask = false): Record<string, IUniform<any>> {
  return {
    selectionCount: { type: 'i', value: 0 },
    selectionBoxes: { type: 'm4v', value: Array.from({ length: 32 }, () => new Matrix4()) },
    selectionColors: { type: 'cv', value: Array.from({ length: 32 }, () => new Color()) },
    selectionMask: { type: 'b', value: mask },
  };
}

export function updateSelectionUniforms(
  uniforms: Record<string, IUniform<any>>,
  selection?: PointCloudSelection,
): void {
  const regions = selection?.getRegions() ?? [];
  uniforms.selectionCount.value = regions.length;
  regions.forEach((region, index) => {
    uniforms.selectionBoxes.value[index].copy(region.inverse);
    uniforms.selectionColors.value[index].copy(region.color);
  });
}
