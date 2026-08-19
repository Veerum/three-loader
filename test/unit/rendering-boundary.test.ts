import { describe, expect, jest, test } from '@jest/globals';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Camera,
  Material,
  Matrix4,
  Object3D,
  Vector2,
  Vector3,
} from 'three';
import { OctreeGeometryNode } from '../../src/loading2/octree-geometry-node';
import { OctreeGeometry } from '../../src/loading2/octree-geometry';
import { PointCloudOctreeGeometryNode } from '../../src/point-cloud-octree-geometry-node';
import { PointCloudOctreeGeometry } from '../../src/point-cloud-octree-geometry';
import { PointCloudOctreeNode } from '../../src/point-cloud-octree-node';
import { PointCloudOctree } from '../../src/point-cloud-octree';
import {
  PointCloudRenderAdapter,
  PointCloudRenderAdapterContext,
  PointCloudRenderAdapterRegistry,
} from '../../src/rendering/core/point-cloud-render-adapter';
import {
  PointCloudRenderer,
  PointCloudRendererFamily,
} from '../../src/rendering/core/point-cloud-renderer';
import { IPointCloudGeometryNode, IPotree } from '../../src/types';
import { LRU } from '../../src/utils/lru';

jest.mock('../../src/materials', () => {
  const { Material: ThreeMaterial } = jest.requireActual<typeof import('three')>('three');
  class TestPointCloudMaterial extends ThreeMaterial {
    static makeOnBeforeRender() {
      return () => undefined;
    }
  }
  return {
    ClipMode: { CLIP_INSIDE: 5, CLIP_OUTSIDE: 1, DISABLED: 0 },
    PointCloudMaterial: TestPointCloudMaterial,
    PointColorType: { POINT_INDEX: 7 },
    PointSizeType: { ADAPTIVE: 2, ATTENUATED: 1, FIXED: 0 },
  };
});

jest.mock('../../src/materials/point-cloud-material', () => {
  const { Material: ThreeMaterial } = jest.requireActual<typeof import('three')>('three');
  return {
    PointCloudMaterial: class TestPointCloudMaterial extends ThreeMaterial {
      static makeOnBeforeRender() {
        return () => undefined;
      }
    },
  };
});

class TestAdapter implements PointCloudRenderAdapter {
  readonly material = new Material();
  disposed = false;
  initialized = false;
  readonly sceneNodes = new Map<IPointCloudGeometryNode, Object3D>();

  constructor(
    readonly family: PointCloudRendererFamily,
    private readonly context: PointCloudRenderAdapterContext,
    private readonly failInitialization = false,
  ) {}

  initialize(_renderer: PointCloudRenderer): void {
    if (this.failInitialization) {
      throw new Error('expected initialization failure');
    }
    this.initialized = true;
  }

  createTreeNode(geometryNode: IPointCloudGeometryNode): PointCloudOctreeNode {
    const sceneNode = new Object3D();
    sceneNode.position.copy(geometryNode.boundingBox.min);
    this.sceneNodes.set(geometryNode, sceneNode);
    return new PointCloudOctreeNode(geometryNode, sceneNode, () => {
      this.disposeSceneNode(geometryNode);
    });
  }

  disposeSceneNode(geometryNode: IPointCloudGeometryNode): void {
    const sceneNode = this.sceneNodes.get(geometryNode);
    if (sceneNode) {
      sceneNode.removeFromParent();
      this.sceneNodes.delete(geometryNode);
    }
  }

  updateSceneNode(node: PointCloudOctreeNode): void {
    node.sceneNode.visible = true;
    node.sceneNode.updateMatrix();
    node.sceneNode.matrixWorld.multiplyMatrices(
      this.context.pointCloud.matrixWorld,
      node.sceneNode.matrix,
    );
  }

  updateRenderState(_camera: Camera, _renderer: PointCloudRenderer): void {}

  dispose(): void {
    if (this.disposed) {
      return;
    }
    for (const geometryNode of Array.from(this.sceneNodes.keys())) {
      this.disposeSceneNode(geometryNode);
    }
    this.material.dispose();
    this.disposed = true;
    this.initialized = false;
  }
}

function renderer(family: PointCloudRendererFamily): PointCloudRenderer {
  return {
    isWebGLRenderer: family === 'webgl',
    isWebGPURenderer: family === 'webgpu',
    getPixelRatio: () => 1,
    getSize: (target: Vector2) => target.set(160, 160),
  };
}

function sourceGeometry(): {
  geometry: BufferGeometry;
  node: PointCloudOctreeGeometryNode;
  source: PointCloudOctreeGeometry;
  sourceArray: Float32Array;
} {
  const bounds = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  const sourceArray = new Float32Array([0, 0, 0]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(sourceArray, 3));

  const source = {
    boundingBox: bounds,
    disposed: false,
    dispose(): void {
      this.root.traverse((node: PointCloudOctreeGeometryNode) => node.dispose());
      this.disposed = true;
    },
    offset: new Vector3(),
    root: undefined,
    spacing: 1,
    tightBoundingBox: bounds.clone(),
  } as unknown as PointCloudOctreeGeometry;
  const node = new PointCloudOctreeGeometryNode('r', source, bounds);
  node.geometry = geometry;
  node.loaded = true;
  node.numPoints = 1;
  source.root = node;

  return { geometry, node, source, sourceArray };
}

function registry(
  adapters: TestAdapter[],
  failFirstWebGL = false,
): PointCloudRenderAdapterRegistry {
  let webGLAttempts = 0;
  return new PointCloudRenderAdapterRegistry()
    .register('webgl', (context) => {
      const adapter = new TestAdapter('webgl', context, failFirstWebGL && webGLAttempts++ === 0);
      adapters.push(adapter);
      return adapter;
    })
    .register('webgpu', (context) => {
      const adapter = new TestAdapter('webgpu', context);
      adapters.push(adapter);
      return adapter;
    });
}

function pointCloud(renderAdapters: PointCloudRenderAdapterRegistry): {
  cloud: PointCloudOctree;
  geometry: BufferGeometry;
  node: PointCloudOctreeGeometryNode;
  sourceArray: Float32Array;
} {
  const { geometry, node, source, sourceArray } = sourceGeometry();
  const potree = {
    lru: new LRU(),
    renderAdapters,
  } as IPotree;
  const cloud = new PointCloudOctree(potree, source);
  return { cloud, geometry, node, sourceArray };
}

describe('F02 rendering boundary', () => {
  test('appearance is usable before a stable native material is initialized', () => {
    const adapters: TestAdapter[] = [];
    const { cloud } = pointCloud(registry(adapters));
    const firstRenderer = renderer('webgl');
    const secondRenderer = renderer('webgl');

    expect(cloud.material).toBeNull();
    cloud.appearance.size = 7;
    expect(cloud.appearance.size).toBe(7);

    cloud.prepareForRenderer(firstRenderer);
    const material = cloud.material;
    expect(material).toBe(adapters[0].material);
    cloud.prepareForRenderer(firstRenderer);
    cloud.prepareForRenderer(secondRenderer);
    expect(cloud.material).toBe(material);
    expect(adapters).toHaveLength(1);

    expect(() => cloud.prepareForRenderer(renderer('webgpu'))).toThrow(/bound to webgl/);
    expect(cloud.material).toBe(material);
  });

  test('compound values require an update method or explicit invalidation', () => {
    const { cloud } = pointCloud(registry([]));
    const clipBox = {
      box: new Box3(),
      inverse: new Matrix4(),
      matrix: new Matrix4(),
      position: new Vector3(),
    };
    cloud.appearance.updateClipBoxes([clipBox]);
    const committedX = cloud.appearance.getSnapshot().clipBoxes[0].matrix.elements[12];

    clipBox.matrix.makeTranslation(5, 0, 0);
    expect(cloud.appearance.getSnapshot().clipBoxes[0].matrix.elements[12]).toBe(committedX);

    cloud.appearance.invalidate();
    expect(cloud.appearance.getSnapshot().clipBoxes[0].matrix.elements[12]).toBe(5);
  });

  test('unknown renderers fail before binding and initialization failures are retryable', () => {
    const adapters: TestAdapter[] = [];
    const { cloud } = pointCloud(registry(adapters, true));
    const unknownRenderer = {
      getPixelRatio: () => 1,
      getSize: (target: Vector2) => target.set(160, 160),
    };

    expect(() => cloud.prepareForRenderer(unknownRenderer)).toThrow(/Unsupported/);
    expect(cloud.material).toBeNull();
    expect(adapters).toHaveLength(0);

    expect(() => cloud.prepareForRenderer(renderer('webgl'))).toThrow(
      /expected initialization failure/,
    );
    expect(adapters[0].disposed).toBe(true);
    expect(cloud.material).toBeNull();

    cloud.prepareForRenderer(renderer('webgl'));
    expect(adapters).toHaveLength(2);
    expect(cloud.material).toBe(adapters[1].material);
  });

  test('renderer families are classified structurally', () => {
    const adapters: TestAdapter[] = [];
    const renderAdapters = registry(adapters);
    const { cloud } = pointCloud(renderAdapters);
    cloud.prepareForRenderer(renderer('webgpu'));

    expect(adapters[0].family).toBe('webgpu');
    expect(cloud.material).toBe(adapters[0].material);

    const { cloud: ambiguousCloud } = pointCloud(renderAdapters);
    expect(() =>
      ambiguousCloud.prepareForRenderer({
        isWebGLRenderer: true,
        isWebGPURenderer: true,
        getPixelRatio: () => 1,
        getSize: (target: Vector2) => target.set(160, 160),
      }),
    ).toThrow(/Ambiguous/);
    expect(ambiguousCloud.material).toBeNull();
  });

  test('adapter resources detach before source geometry disposal, including the root', () => {
    const adapters: TestAdapter[] = [];
    const { cloud, geometry, node, sourceArray } = pointCloud(registry(adapters));
    cloud.prepareForRenderer(renderer('webgl'));
    const treeNode = cloud.toTreeNode(node);
    let detachedAtSourceDisposal = false;
    geometry.addEventListener('dispose', () => {
      detachedAtSourceDisposal =
        treeNode.sceneNode.parent === null && adapters[0].sceneNodes.size === 0;
    });

    cloud.dispose();
    cloud.dispose();

    expect(detachedAtSourceDisposal).toBe(true);
    expect(sourceArray).toEqual(new Float32Array([0, 0, 0]));
    expect(node.geometry).toBeUndefined();
    expect(cloud.material).toBeNull();
    expect(cloud.root).toBeNull();
    expect(() => cloud.prepareForRenderer(renderer('webgl'))).toThrow(/disposed point cloud/);
  });

  test('LRU eviction detaches a derived node before releasing its source geometry', () => {
    const adapters: TestAdapter[] = [];
    const { cloud, node } = pointCloud(registry(adapters));
    const childBounds = new Box3(new Vector3(-1, -1, -1), new Vector3(0, 0, 0));
    const child = new PointCloudOctreeGeometryNode('r0', node.pcoGeometry, childBounds);
    const childArray = new Float32Array([0, 0, 0]);
    child.geometry = new BufferGeometry();
    child.geometry.setAttribute('position', new BufferAttribute(childArray, 3));
    child.loaded = true;
    child.numPoints = 1;
    node.addChild(child);

    cloud.prepareForRenderer(renderer('webgl'));
    const rootTreeNode = cloud.toTreeNode(node);
    const childTreeNode = cloud.toTreeNode(child, rootTreeNode);
    let detachedAtSourceDisposal = false;
    child.geometry.addEventListener('dispose', () => {
      detachedAtSourceDisposal =
        childTreeNode.sceneNode.parent === null && !adapters[0].sceneNodes.has(child);
    });

    cloud.potree.lru.touch(child);
    cloud.potree.lru.disposeSubtree(child);

    expect(detachedAtSourceDisposal).toBe(true);
    expect(child.geometry).toBeUndefined();
    expect(rootTreeNode.children[0]).toBe(child);
    expect(childArray).toEqual(new Float32Array([0, 0, 0]));
    expect(node.geometry).toBeDefined();
    cloud.dispose();
  });

  test('V2 root disposal runs one-time handlers before source geometry disposal', () => {
    const bounds = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    const source = {} as OctreeGeometry;
    const node = new OctreeGeometryNode('r', source, bounds);
    const sourceArray = new Float32Array([0, 0, 0]);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(sourceArray, 3));
    node.geometry = geometry;
    node.loaded = true;
    let handlerRanBeforeDisposal = false;
    node.oneTimeDisposeHandlers.push(() => {
      handlerRanBeforeDisposal = node.geometry === geometry;
    });

    node.dispose();

    expect(handlerRanBeforeDisposal).toBe(true);
    expect(node.geometry).toBeUndefined();
    expect(sourceArray.byteLength).toBe(12);
  });

  test('disposal before initialization releases a loaded root', () => {
    const adapters: TestAdapter[] = [];
    const renderAdapters = registry(adapters);
    const { cloud, node, sourceArray } = pointCloud(renderAdapters);

    cloud.dispose();

    expect(adapters).toHaveLength(0);
    expect(node.geometry).toBeUndefined();
    expect(sourceArray.byteLength).toBe(12);
    expect(() => cloud.prepareForRenderer(renderer('webgl'))).toThrow(/disposed point cloud/);
  });
});
