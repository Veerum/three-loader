import {
  Box3,
  BufferGeometry,
  Camera,
  Material,
  Mesh,
  Object3D,
  Ray,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { DEFAULT_MIN_NODE_PIXEL_SIZE, MAX_AMOUNT_OF_SPLATS } from './constants';
import { OctreeGeometry } from './loading2/octree-geometry';
import { PointSizeType } from './materials';
import type { PointCloudMaterial } from './materials/point-cloud-material';
import { PointCloudOctreeNode } from './point-cloud-octree-node';
import { PickParams, PointCloudOctreePicker } from './point-cloud-octree-picker';
import { PointCloudTree } from './point-cloud-tree';
import { PointCloudAppearance } from './rendering/core/point-cloud-appearance';
import { PointCloudRenderAdapter } from './rendering/core/point-cloud-render-adapter';
import {
  getPointCloudRendererFamily,
  PointCloudRenderer,
  PointCloudRendererFamily,
} from './rendering/core/point-cloud-renderer';
import { SplatsMesh } from './splats-mesh';
import {
  IPointCloudGeometryNode,
  IPointCloudTreeNode,
  IPotree,
  PCOGeometry,
  PickPoint,
} from './types';
import { computeTransformedBoundingBox } from './utils/bounds';

const DEBUG_MODE = false;
export class PointCloudOctree extends PointCloudTree {
  potree: IPotree;
  disposed: boolean = false;
  pcoGeometry: PCOGeometry;
  boundingBox: Box3;
  boundingSphere: Sphere;
  readonly appearance: PointCloudAppearance;
  level: number = 0;
  maxLevel: number = Infinity;
  splatsMesh: SplatsMesh | null = null;

  /**
   * The minimum radius of a node's bounding sphere on the screen in order to be displayed.
   */
  minNodePixelSize: number = DEFAULT_MIN_NODE_PIXEL_SIZE;
  root: IPointCloudTreeNode | null = null;
  boundingBoxNodes: Object3D[] = [];
  visibleNodes: PointCloudOctreeNode[] = [];
  visibleGeometry: IPointCloudGeometryNode[] = [];
  numVisiblePoints: number = 0;
  showBoundingBox: boolean = false;

  private visibleBounds: Box3 = new Box3();
  private picker: PointCloudOctreePicker | undefined;
  private renderAdapter: PointCloudRenderAdapter | undefined;
  private renderAsSplats: boolean | null = null;
  private rendererFamily: PointCloudRendererFamily | undefined;
  private loadHarmonics: boolean = false;
  private maxAmountOfSplats: number = MAX_AMOUNT_OF_SPLATS;

  constructor(
    potree: IPotree,
    pcoGeometry: PCOGeometry,
    /** @deprecated Configure appearance instead. Supplying this argument only binds WebGL. */
    material?: PointCloudMaterial,
    loadHarmonics: boolean = false,
    maxAmountOfSplats: number = MAX_AMOUNT_OF_SPLATS,
  ) {
    super();

    this.name = '';
    this.potree = potree;
    this.root = pcoGeometry.root;
    this.pcoGeometry = pcoGeometry;
    this.boundingBox = pcoGeometry.boundingBox;
    this.boundingSphere = this.boundingBox.getBoundingSphere(new Sphere());
    this.loadHarmonics = loadHarmonics;
    this.maxAmountOfSplats = maxAmountOfSplats;
    this.position.copy(pcoGeometry.offset);
    this.updateMatrix();

    this.appearance = new PointCloudAppearance({
      colorRgba: Boolean(material) || pcoGeometry instanceof OctreeGeometry,
    });
    this.initAppearance();

    // The legacy optional-material overload never reliably used the supplied instance. Retaining
    // it binds the cloud to WebGL explicitly while appearance remains the supported configuration.
    if (material) {
      this.rendererFamily = 'webgl';
    }
  }

  get material(): Material | null {
    return this.renderAdapter ? this.renderAdapter.material : null;
  }

  private initAppearance(): void {
    this.updateMatrixWorld(true);

    const { min, max } = computeTransformedBoundingBox(
      this.pcoGeometry.tightBoundingBox || this.getBoundingBoxWorld(),
      this.matrixWorld,
    );

    const bWidth = max.z - min.z;
    this.appearance.updateElevationRange([min.z - 0.2 * bWidth, max.z + 0.2 * bWidth]);
  }

  prepareForRenderer(renderer: PointCloudRenderer): void {
    const family = this.assertRendererCompatible(renderer);

    if (this.renderAdapter) {
      return;
    }

    const candidate = this.potree.renderAdapters.create(family, {
      appearance: this.appearance,
      pointCloud: this,
    });

    try {
      if (candidate.family !== family) {
        throw new Error(
          `Point-cloud render adapter family ${candidate.family} does not match ${family}.`,
        );
      }
      candidate.initialize(renderer);
    } catch (error) {
      candidate.dispose();
      throw error;
    }

    this.renderAdapter = candidate;
    this.rendererFamily = family;
  }

  assertRendererCompatible(renderer: PointCloudRenderer): PointCloudRendererFamily {
    if (this.disposed) {
      throw new Error('Cannot initialize a disposed point cloud.');
    }

    const family = getPointCloudRendererFamily(renderer);
    if (this.rendererFamily && this.rendererFamily !== family) {
      throw new Error(
        `Point cloud is bound to ${this.rendererFamily} and cannot be used with ${family}.`,
      );
    }

    return family;
  }

  updateRenderState(camera: Camera, renderer: PointCloudRenderer): void {
    this.prepareForRenderer(renderer);
    this.renderAdapter!.updateRenderState(camera, renderer);
  }

  updateSceneNode(node: PointCloudOctreeNode): void {
    if (!this.renderAdapter) {
      throw new Error('Point cloud must be prepared before updating scene nodes.');
    }
    this.renderAdapter.updateSceneNode(node);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    if (this.picker) {
      this.picker.dispose();
      this.picker = undefined;
    }

    if (this.renderAdapter) {
      this.renderAdapter.dispose();
      this.renderAdapter = undefined;
    }

    if (this.splatsMesh !== null) {
      this.splatsMesh.dispose();
      this.splatsMesh = null;
    }

    this.pcoGeometry.root.traverse((n) => this.potree.lru.remove(n));
    this.pcoGeometry.dispose();

    this.root = null;
    this.visibleNodes = [];
    this.visibleGeometry = [];
  }

  get pointSizeType(): PointSizeType {
    return this.appearance.pointSizeType;
  }

  set pointSizeType(value: PointSizeType) {
    this.appearance.pointSizeType = value;
  }

  toTreeNode(
    geometryNode: IPointCloudGeometryNode,
    parent?: PointCloudOctreeNode | null,
  ): PointCloudOctreeNode {
    if (!this.renderAdapter) {
      throw new Error('Point cloud must be prepared before creating tree nodes.');
    }

    const node = this.renderAdapter.createTreeNode(geometryNode);

    if (parent) {
      parent.sceneNode.add(node.sceneNode);
      parent.children[geometryNode.index] = node;

      geometryNode.oneTimeDisposeHandlers.push(() => {
        node.disposeSceneNode();
        // Replace the tree node (rendered and in the GPU) with the geometry node.
        parent.children[geometryNode.index] = geometryNode;
      });
    } else {
      this.root = node;
      this.add(node.sceneNode);
      geometryNode.oneTimeDisposeHandlers.push(() => {
        node.disposeSceneNode();
        if (!this.disposed) {
          this.root = geometryNode;
        }
      });
    }

    return node;
  }

  updateSplats(camera: Camera, size: Vector2, callback = () => {}) {
    let mesh = this.children[0] as Mesh;
    if (!mesh) return;

    //Parse the nodes to see if they contain splats information.
    if (this.renderAsSplats === null || !this.renderAsSplats) {
      this.renderAsSplats = false;
      mesh.traverse((el) => {
        let m = el as Mesh;
        let g = m.geometry as BufferGeometry;
        if (g.hasAttribute('COVARIANCE0')) this.renderAsSplats = true;
      });

      //Initialise the splats mesh if the nodes contain splats information
      if (this.renderAsSplats && this.splatsMesh === null) {
        this.splatsMesh = new SplatsMesh(DEBUG_MODE, this.maxAmountOfSplats, this.loadHarmonics);
        this.add(this.splatsMesh);
      }
    }

    if (this.splatsMesh !== null) {
      if (this.renderAsSplats && this.splatsMesh.splatsEnabled) {
        let runSort = this.splatsMesh.update(mesh, camera, size, callback);
        if (this.splatsMesh.splatsEnabled && this.progress > 0.99 && runSort)
          this.splatsMesh.sortSplats(camera, callback);
      }
    }
  }

  updateVisibleBounds() {
    const bounds = this.visibleBounds;
    bounds.min.set(Infinity, Infinity, Infinity);
    bounds.max.set(-Infinity, -Infinity, -Infinity);

    for (const node of this.visibleNodes) {
      if (node.isLeafNode) {
        bounds.expandByPoint(node.boundingBox.min);
        bounds.expandByPoint(node.boundingBox.max);
      }
    }
  }

  updateBoundingBoxes(): void {
    if (!this.showBoundingBox || !this.parent) {
      return;
    }

    let bbRoot: any = this.parent.getObjectByName('bbroot');
    if (!bbRoot) {
      bbRoot = new Object3D();
      bbRoot.name = 'bbroot';
      this.parent.add(bbRoot);
    }

    const visibleBoxes: (Object3D | null)[] = [];
    for (const node of this.visibleNodes) {
      if (node.boundingBoxNode !== undefined && node.isLeafNode) {
        visibleBoxes.push(node.boundingBoxNode);
      }
    }

    bbRoot.children = visibleBoxes;
  }

  updateMatrixWorld(force: boolean): void {
    if (this.matrixAutoUpdate === true) {
      this.updateMatrix();
    }

    if (this.matrixWorldNeedsUpdate === true || force === true) {
      if (!this.parent) {
        this.matrixWorld.copy(this.matrix);
      } else {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }

      this.matrixWorldNeedsUpdate = false;

      force = true;
    }
  }

  hideDescendants(object: Object3D): void {
    const toHide: Object3D[] = [];
    addVisibleChildren(object);

    while (toHide.length > 0) {
      const objToHide = toHide.shift()!;
      objToHide.visible = false;
      addVisibleChildren(objToHide);
    }

    function addVisibleChildren(obj: Object3D) {
      for (const child of obj.children) {
        if (child.visible) {
          toHide.push(child);
        }
      }
    }
  }

  moveToOrigin(): void {
    this.position.set(0, 0, 0); // Reset, then the matrix will be updated in getBoundingBoxWorld()
    this.position.set(0, 0, 0).sub(this.getBoundingBoxWorld().getCenter(new Vector3()));
  }

  moveToGroundPlane(): void {
    this.position.y += -this.getBoundingBoxWorld().min.y;
  }

  getBoundingBoxWorld(): Box3 {
    this.updateMatrixWorld(true);
    return computeTransformedBoundingBox(this.boundingBox, this.matrixWorld);
  }

  getVisibleExtent() {
    return this.visibleBounds.applyMatrix4(this.matrixWorld);
  }

  pick(
    renderer: WebGLRenderer,
    camera: Camera,
    ray: Ray,
    params: Partial<PickParams> = {},
  ): PickPoint | null {
    if (this.disposed) {
      return null;
    }
    this.prepareForRenderer(renderer);
    this.picker = this.picker || new PointCloudOctreePicker();
    return this.picker.pick(renderer, camera, ray, [this], params);
  }

  get progress() {
    return this.visibleGeometry.length === 0
      ? 0
      : this.visibleNodes.length / this.visibleGeometry.length;
  }

  get maxAmountOfSplatsToRender() {
    return this.maxAmountOfSplats;
  }
}
