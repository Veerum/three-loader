import { Box3, EventDispatcher, Object3D, Sphere } from 'three';
import { IPointCloudGeometryNode, IPointCloudTreeNode } from './types';

export class PointCloudOctreeNode extends EventDispatcher implements IPointCloudTreeNode {
  geometryNode: IPointCloudGeometryNode;
  sceneNode: Object3D;
  pcIndex: number | undefined = undefined;
  boundingBoxNode: Object3D | null = null;
  readonly children: (IPointCloudTreeNode | null)[];
  readonly loaded = true;
  readonly isTreeNode: boolean = true;
  readonly isGeometryNode: boolean = false;
  private sceneNodeDisposed = false;

  constructor(
    geometryNode: IPointCloudGeometryNode,
    sceneNode: Object3D,
    private readonly disposeSceneNodeHandler: () => void = () => undefined,
  ) {
    super();

    this.geometryNode = geometryNode;
    this.sceneNode = sceneNode;
    this.children = geometryNode.children.slice();
  }

  dispose(): void {
    this.geometryNode.dispose();
  }

  disposeSceneNode(): void {
    if (!this.sceneNodeDisposed) {
      this.disposeSceneNodeHandler();
      this.sceneNodeDisposed = true;
    }
  }

  traverse(cb: (node: IPointCloudTreeNode) => void, includeSelf?: boolean): void {
    this.geometryNode.traverse(cb, includeSelf);
  }

  get id() {
    return this.geometryNode.id;
  }

  get name() {
    return this.geometryNode.name;
  }

  get level(): number {
    return this.geometryNode.level;
  }

  get isLeafNode(): boolean {
    return this.geometryNode.isLeafNode;
  }

  get numPoints(): number {
    return this.geometryNode.numPoints;
  }

  get index() {
    return this.geometryNode.index;
  }

  get boundingSphere(): Sphere {
    return this.geometryNode.boundingSphere;
  }

  get boundingBox(): Box3 {
    return this.geometryNode.boundingBox;
  }

  get spacing() {
    return this.geometryNode.spacing;
  }
}
