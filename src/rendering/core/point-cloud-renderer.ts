import { Vector2 } from 'three';

export type PointCloudRendererFamily = 'webgl' | 'webgpu';

/**
 * The renderer surface used by renderer-neutral point-cloud updates.
 * Backend adapters may narrow this interface after the family has been classified.
 */
export interface PointCloudRenderer {
  readonly isWebGLRenderer?: boolean;
  readonly isWebGPURenderer?: boolean;

  getPixelRatio(): number;
  getSize(target: Vector2): Vector2;
}

export function getPointCloudRendererFamily(
  renderer: Pick<PointCloudRenderer, 'isWebGLRenderer' | 'isWebGPURenderer'>,
): PointCloudRendererFamily {
  const isWebGLRenderer = renderer.isWebGLRenderer === true;
  const isWebGPURenderer = renderer.isWebGPURenderer === true;

  if (isWebGLRenderer === isWebGPURenderer) {
    throw new Error(
      isWebGLRenderer
        ? 'Ambiguous point-cloud renderer: both renderer-family flags are set.'
        : 'Unsupported point-cloud renderer: expected isWebGLRenderer or isWebGPURenderer.',
    );
  }

  return isWebGLRenderer ? 'webgl' : 'webgpu';
}
