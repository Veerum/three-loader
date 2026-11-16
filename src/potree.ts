import {
  Box3,
  Camera,
  Frustum,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Ray,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  DEFAULT_POINT_BUDGET,
  MAX_LOADS_TO_GPU,
  MAX_NUM_NODES_LOADING,
  MAX_AMOUNT_OF_SPLATS,
  PERSPECTIVE_CAMERA,
  MEMORY_SCALE,
} from './constants';
import { FEATURES } from './features';
import { BinaryLoader, GetUrlFn, loadPOC } from './loading';
import { loadOctree } from './loading2/load-octree';
import { ClipMode } from './materials';
import { PointCloudOctree } from './point-cloud-octree';
import { PointCloudOctreeNode } from './point-cloud-octree-node';
import { PickParams, PointCloudOctreePicker } from './point-cloud-octree-picker';
import { isGeometryNode, isTreeNode } from './type-predicates';
import {
  IPointCloudGeometryNode,
  IPointCloudTreeNode,
  IPotree,
  IVisibilityUpdateResult,
  PCOGeometry,
  PickPoint,
} from './types';
import { BinaryHeap } from './utils/binary-heap';
import { Box3Helper } from './utils/box3-helper';
import { LRU } from './utils/lru';
import { LasLazLoader } from './loading/laslaz/las-laz-loader';
import { LAZLoader } from './loading/laslaz/LAZLoader';

/** Cameras share traversal, point budget, requests and LRU. Height is in drawing-buffer pixels. */
export interface PointCloudView {
  camera: Camera;
  height: number;
}

export interface PointCloudSelection {
  views: readonly PointCloudView[];
  /** Optional world-space loading constraint; does not alter render clipping. */
  focusBox?: Box3;
}

export class QueueItem {
  constructor(
    public pointCloudIndex: number,
    public weight: number,
    public node: IPointCloudTreeNode,
    public parent?: IPointCloudTreeNode | null,
  ) {}
}

type GeometryLoader = (
  url: string,
  getUrl: GetUrlFn,
  xhrRequest: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  loadHarmonics: boolean,
) => Promise<PCOGeometry>;

const GEOMETRY_LOADERS = {
  v1: loadPOC,
  v2: loadOctree,
} satisfies Record<string, GeometryLoader>;

export type PotreeVersion = keyof typeof GEOMETRY_LOADERS;

export class Potree implements IPotree {
  private static picker: PointCloudOctreePicker | undefined;
  private _pointBudget: number = DEFAULT_POINT_BUDGET;
  private _rendererSize: Vector2 = new Vector2();

  maxNumNodesLoading: number = MAX_NUM_NODES_LOADING;
  memoryScale: number = MEMORY_SCALE;
  features = FEATURES;
  lru = new LRU(this._pointBudget);

  private readonly loadGeometry: GeometryLoader;

  constructor(version: PotreeVersion = 'v1') {
    this.loadGeometry = GEOMETRY_LOADERS[version];
  }

  loadPointCloud(
    url: string,
    getUrl: GetUrlFn,
    xhrRequest = (input: RequestInfo, init?: RequestInit) => fetch(input, init),
    loadHarmonics: boolean = false,
    maxAmountOfSplats: number = MAX_AMOUNT_OF_SPLATS,
  ): Promise<PointCloudOctree> {
    return this.loadGeometry(url, getUrl, xhrRequest, loadHarmonics).then(
      (geometry) =>
        new PointCloudOctree(this, geometry, undefined, loadHarmonics, maxAmountOfSplats),
    );
  }

  updatePointClouds(
    pointClouds: PointCloudOctree[],
    camera: Camera,
    renderer: WebGLRenderer,
    callback = () => {},
    selection?: PointCloudSelection,
  ): IVisibilityUpdateResult {
    const views = selection?.views ?? [
      { camera, height: renderer.getSize(this._rendererSize).height * renderer.getPixelRatio() },
    ];
    if (views.some((view) => !Number.isFinite(view.height) || view.height <= 0)) {
      throw new RangeError('Point-cloud view height must be finite and positive.');
    }
    const result = this.updateVisibility(pointClouds, views, selection?.focusBox);

    for (let i = 0; i < pointClouds.length; i++) {
      const pointCloud = pointClouds[i];
      if (pointCloud.disposed) {
        continue;
      }

      pointCloud.material.updateMaterial(pointCloud, pointCloud.visibleNodes, camera, renderer);
      pointCloud.updateVisibleBounds();
      pointCloud.updateBoundingBoxes();

      //For the splats
      renderer.getSize(this._rendererSize);
      pointCloud.updateSplats(camera, this._rendererSize, callback);
    }

    this.lru.freeMemory(this.memoryScale);

    return result;
  }

  static pick(
    pointClouds: PointCloudOctree[],
    renderer: WebGLRenderer,
    camera: Camera,
    ray: Ray,
    params: Partial<PickParams> = {},
  ): PickPoint | null {
    Potree.picker = Potree.picker || new PointCloudOctreePicker();
    return Potree.picker.pick(renderer, camera, ray, pointClouds, params);
  }

  get pointBudget(): number {
    return this._pointBudget;
  }

  set pointBudget(value: number) {
    if (value !== this._pointBudget) {
      this._pointBudget = value;
      this.lru.pointBudget = value;
      this.lru.freeMemory(this.memoryScale);
    }
  }

  static set maxLoaderWorkers(value: number) {
    BinaryLoader.WORKER_POOL.maxWorkers = value;
    LasLazLoader.WORKER_POOL.maxWorkers = value;
    LAZLoader.WORKER_POOL.maxWorkers = value;
  }

  static get maxLoaderWorkers(): number {
    return BinaryLoader.WORKER_POOL.maxWorkers;
  }

  private updateVisibility(
    pointClouds: PointCloudOctree[],
    views: readonly PointCloudView[],
    focusBox?: Box3,
  ): IVisibilityUpdateResult {
    let numVisiblePoints = 0;

    const visibleNodes: PointCloudOctreeNode[] = [];
    const unloadedGeometry: IPointCloudGeometryNode[] = [];

    // calculate object space frustum and cam pos and setup priority queue
    const { frustums, cameraPositions, priorityQueue } = this.updateVisibilityStructures(
      pointClouds,
      views,
    );

    let loadedToGPUThisFrame = 0;
    let exceededMaxLoadsToGPU = false;
    let nodeLoadFailed = false;
    let queueItem: QueueItem | undefined;

    while ((queueItem = priorityQueue.pop()) !== undefined) {
      let node = queueItem.node;

      // A large node must not prevent a smaller node in another view from fitting.
      if (numVisiblePoints + node.numPoints > this.pointBudget) continue;

      const pointCloudIndex = queueItem.pointCloudIndex;
      const pointCloud = pointClouds[pointCloudIndex];

      const maxLevel = pointCloud.maxLevel !== undefined ? pointCloud.maxLevel : Infinity;

      if (
        node.level > maxLevel ||
        !frustums[pointCloudIndex].some((frustum) => frustum.intersectsBox(node.boundingBox)) ||
        (focusBox !== undefined &&
          !focusBox.intersectsBox(node.boundingBox.clone().applyMatrix4(pointCloud.matrixWorld))) ||
        this.shouldClip(pointCloud, node.boundingBox)
      ) {
        continue;
      }

      numVisiblePoints += node.numPoints;
      pointCloud.numVisiblePoints += node.numPoints;

      const parentNode = queueItem.parent;

      if (isGeometryNode(node) && (!parentNode || isTreeNode(parentNode))) {
        if (node.loaded && loadedToGPUThisFrame < MAX_LOADS_TO_GPU) {
          node = pointCloud.toTreeNode(node, parentNode);
          loadedToGPUThisFrame++;
        } else if (!node.failed) {
          if (node.loaded && loadedToGPUThisFrame >= MAX_LOADS_TO_GPU) {
            exceededMaxLoadsToGPU = true;
          }
          unloadedGeometry.push(node);
          pointCloud.visibleGeometry.push(node);
        } else {
          nodeLoadFailed = true;
          continue;
        }
      }

      if (isTreeNode(node)) {
        this.updateTreeNodeVisibility(pointCloud, node, visibleNodes);
        pointCloud.visibleGeometry.push(node.geometryNode);
      }

      this.updateChildVisibility(
        queueItem,
        priorityQueue,
        pointCloud,
        node,
        cameraPositions[pointCloudIndex],
        views,
        frustums[pointCloudIndex],
      );
    } // end priority queue loop

    const numNodesToLoad = Math.min(this.maxNumNodesLoading, unloadedGeometry.length);
    const nodeLoadPromises: Promise<void>[] = [];
    for (let i = 0; i < numNodesToLoad; i++) {
      nodeLoadPromises.push(unloadedGeometry[i].load());
    }

    return {
      visibleNodes: visibleNodes,
      numVisiblePoints: numVisiblePoints,
      exceededMaxLoadsToGPU: exceededMaxLoadsToGPU,
      nodeLoadFailed: nodeLoadFailed,
      nodeLoadPromises: nodeLoadPromises,
    };
  }

  private updateTreeNodeVisibility(
    pointCloud: PointCloudOctree,
    node: PointCloudOctreeNode,
    visibleNodes: IPointCloudTreeNode[],
  ): void {
    this.lru.touch(node.geometryNode);

    const sceneNode = node.sceneNode;
    sceneNode.visible = true;
    sceneNode.material = pointCloud.material;
    sceneNode.updateMatrix();
    sceneNode.matrixWorld.multiplyMatrices(pointCloud.matrixWorld, sceneNode.matrix);

    visibleNodes.push(node);
    pointCloud.visibleNodes.push(node);

    this.updateBoundingBoxVisibility(pointCloud, node);
  }

  private updateChildVisibility(
    queueItem: QueueItem,
    priorityQueue: BinaryHeap<QueueItem>,
    pointCloud: PointCloudOctree,
    node: IPointCloudTreeNode,
    cameraPositions: Vector3[],
    views: readonly PointCloudView[],
    frustums: Frustum[],
  ): void {
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child === null) {
        continue;
      }

      const sphere = child.boundingSphere;
      let weight = 0;
      // A node is queued once with its greatest projected importance across views.
      for (let viewIndex = 0; viewIndex < views.length; viewIndex++) {
        if (!frustums[viewIndex].intersectsBox(child.boundingBox)) continue;
        const { camera, height } = views[viewIndex];
        const distance = sphere.center.distanceTo(cameraPositions[viewIndex]);
        const worldRadius = sphere.radius * pointCloud.matrixWorld.getMaxScaleOnAxis();
        let screenPixelRadius: number;
        if (camera.type === PERSPECTIVE_CAMERA) {
          const perspective = camera as PerspectiveCamera;
          const slope = Math.tan((perspective.getEffectiveFOV() * Math.PI) / 360);
          screenPixelRadius = (sphere.radius * height) / (2 * slope * Math.max(distance, 1e-10));
        } else {
          const orthographic = camera as OrthographicCamera;
          screenPixelRadius =
            (worldRadius * height * orthographic.zoom) / (orthographic.top - orthographic.bottom);
        }
        if (screenPixelRadius < pointCloud.minNodePixelSize) continue;
        weight = Math.max(
          weight,
          distance < sphere.radius && camera.type === PERSPECTIVE_CAMERA
            ? Number.MAX_VALUE
            : screenPixelRadius + 1 / Math.max(distance, 1e-10),
        );
      }
      if (weight === 0) continue;

      priorityQueue.push(new QueueItem(queueItem.pointCloudIndex, weight, child, node));
    }
  }

  private updateBoundingBoxVisibility(
    pointCloud: PointCloudOctree,
    node: PointCloudOctreeNode,
  ): void {
    if (pointCloud.showBoundingBox && !node.boundingBoxNode) {
      const boxHelper = new Box3Helper(node.boundingBox);
      boxHelper.matrixAutoUpdate = false;
      pointCloud.boundingBoxNodes.push(boxHelper);
      node.boundingBoxNode = boxHelper;
      node.boundingBoxNode.matrix.copy(pointCloud.matrixWorld);
    } else if (pointCloud.showBoundingBox && node.boundingBoxNode) {
      node.boundingBoxNode.visible = true;
      node.boundingBoxNode.matrix.copy(pointCloud.matrixWorld);
    } else if (!pointCloud.showBoundingBox && node.boundingBoxNode) {
      node.boundingBoxNode.visible = false;
    }
  }

  private shouldClip(pointCloud: PointCloudOctree, boundingBox: Box3): boolean {
    const material = pointCloud.material;

    if (material.numClipBoxes === 0 || material.clipMode !== ClipMode.CLIP_OUTSIDE) {
      return false;
    }

    const box2 = boundingBox.clone();
    pointCloud.updateMatrixWorld(true);
    box2.applyMatrix4(pointCloud.matrixWorld);

    const clipBoxes = material.clipBoxes;
    for (let i = 0; i < clipBoxes.length; i++) {
      const clipMatrixWorld = clipBoxes[i].matrix;
      const clipBoxWorld = new Box3(
        new Vector3(-0.5, -0.5, -0.5),
        new Vector3(0.5, 0.5, 0.5),
      ).applyMatrix4(clipMatrixWorld);
      if (box2.intersectsBox(clipBoxWorld)) {
        return false;
      }
    }

    return true;
  }

  private updateVisibilityStructures = (() => {
    const frustumMatrix = new Matrix4();
    const inverseWorldMatrix = new Matrix4();
    const cameraMatrix = new Matrix4();

    return (
      pointClouds: PointCloudOctree[],
      views: readonly PointCloudView[],
    ): {
      frustums: Frustum[][];
      cameraPositions: Vector3[][];
      priorityQueue: BinaryHeap<QueueItem>;
    } => {
      const frustums: Frustum[][] = [];
      const cameraPositions: Vector3[][] = [];
      const priorityQueue = new BinaryHeap<QueueItem>((x) => 1 / x.weight);

      for (let i = 0; i < pointClouds.length; i++) {
        const pointCloud = pointClouds[i];

        if (!pointCloud.initialized()) {
          continue;
        }

        pointCloud.numVisiblePoints = 0;
        pointCloud.visibleNodes = [];
        pointCloud.visibleGeometry = [];

        frustums[i] = [];
        cameraPositions[i] = [];
        for (const { camera } of views) {
          camera.updateWorldMatrix(true, false);
          frustumMatrix
            .copy(camera.projectionMatrix)
            .multiply(camera.matrixWorldInverse)
            .multiply(pointCloud.matrixWorld);
          frustums[i].push(new Frustum().setFromProjectionMatrix(frustumMatrix));
          inverseWorldMatrix.copy(pointCloud.matrixWorld).invert();
          cameraMatrix.multiplyMatrices(inverseWorldMatrix, camera.matrixWorld);
          cameraPositions[i].push(new Vector3().setFromMatrixPosition(cameraMatrix));
        }

        if (pointCloud.visible && pointCloud.root !== null) {
          const weight = Number.MAX_VALUE;
          priorityQueue.push(new QueueItem(i, weight, pointCloud.root));
        }

        // Hide any previously visible nodes. We will later show only the needed ones.
        if (isTreeNode(pointCloud.root)) {
          pointCloud.hideDescendants(pointCloud.root.sceneNode);
        }

        for (const boundingBoxNode of pointCloud.boundingBoxNodes) {
          boundingBoxNode.visible = false;
        }
      }

      return { frustums, cameraPositions, priorityQueue };
    };
  })();
}
