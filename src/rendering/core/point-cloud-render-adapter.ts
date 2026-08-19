import { Camera, Material } from 'three';
import type { PointCloudOctree } from '../../point-cloud-octree';
import type { PointCloudOctreeNode } from '../../point-cloud-octree-node';
import type { IPointCloudGeometryNode } from '../../types';
import { PointCloudAppearance } from './point-cloud-appearance';
import { PointCloudRenderer, PointCloudRendererFamily } from './point-cloud-renderer';

export interface PointCloudRenderAdapterContext {
  appearance: PointCloudAppearance;
  pointCloud: PointCloudOctree;
}

export interface PointCloudRenderAdapter {
  readonly family: PointCloudRendererFamily;
  readonly material: Material;

  createTreeNode(geometryNode: IPointCloudGeometryNode): PointCloudOctreeNode;
  dispose(): void;
  disposeSceneNode(geometryNode: IPointCloudGeometryNode): void;
  initialize(renderer: PointCloudRenderer): void;
  updateRenderState(camera: Camera, renderer: PointCloudRenderer): void;
  updateSceneNode(node: PointCloudOctreeNode): void;
}

export type PointCloudRenderAdapterFactory = (
  context: PointCloudRenderAdapterContext,
) => PointCloudRenderAdapter;

export class PointCloudRenderAdapterRegistry {
  private readonly factories = new Map<PointCloudRendererFamily, PointCloudRenderAdapterFactory>();

  register(family: PointCloudRendererFamily, factory: PointCloudRenderAdapterFactory): this {
    if (this.factories.has(family)) {
      throw new Error(`A point-cloud render adapter is already registered for ${family}.`);
    }

    this.factories.set(family, factory);
    return this;
  }

  create(
    family: PointCloudRendererFamily,
    context: PointCloudRenderAdapterContext,
  ): PointCloudRenderAdapter {
    const factory = this.factories.get(family);
    if (!factory) {
      throw new Error(`No point-cloud render adapter is registered for ${family}.`);
    }

    return factory(context);
  }
}
