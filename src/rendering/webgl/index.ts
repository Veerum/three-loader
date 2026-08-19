import { PointCloudRenderAdapterRegistry } from '../core/point-cloud-render-adapter';
import { WebGLPointCloudRenderAdapter } from './webgl-point-cloud-render-adapter';

export function createWebGLPointCloudRenderAdapterRegistry(): PointCloudRenderAdapterRegistry {
  return new PointCloudRenderAdapterRegistry().register(
    'webgl',
    (context) => new WebGLPointCloudRenderAdapter(context),
  );
}
