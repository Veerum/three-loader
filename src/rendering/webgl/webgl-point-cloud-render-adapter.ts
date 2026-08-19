import { Camera, Points, WebGLRenderer } from 'three';
import { PointCloudMaterial } from '../../materials/point-cloud-material';
import { PointCloudOctreeNode } from '../../point-cloud-octree-node';
import type { IPointCloudGeometryNode } from '../../types';
import {
  PointCloudRenderAdapter,
  PointCloudRenderAdapterContext,
} from '../core/point-cloud-render-adapter';
import { PointCloudRenderer } from '../core/point-cloud-renderer';

export class WebGLPointCloudRenderAdapter implements PointCloudRenderAdapter {
  readonly family = 'webgl' as const;
  readonly material: PointCloudMaterial;

  private disposed = false;
  private initialized = false;
  private lastAppearanceRevision = -1;
  private readonly sceneNodes = new Map<IPointCloudGeometryNode, Points>();

  constructor(private readonly context: PointCloudRenderAdapterContext) {
    this.material = new PointCloudMaterial({ colorRgba: context.appearance.colorRgba });
  }

  initialize(_renderer: PointCloudRenderer): void {
    if (this.disposed) {
      throw new Error('Cannot initialize a disposed WebGL point-cloud render adapter.');
    }

    this.applyAppearance();
    this.initialized = true;
  }

  createTreeNode(geometryNode: IPointCloudGeometryNode): PointCloudOctreeNode {
    this.assertInitialized();

    const existing = this.sceneNodes.get(geometryNode);
    if (existing) {
      return existing.userData.pointCloudOctreeNode as PointCloudOctreeNode;
    }

    if (!geometryNode.geometry) {
      throw new Error(
        `Cannot create a scene node for unloaded geometry node ${geometryNode.name}.`,
      );
    }

    const points = new Points(geometryNode.geometry, this.material);
    const pointCloud = this.context.pointCloud;
    const node = new PointCloudOctreeNode(geometryNode, points, () =>
      this.disposeSceneNode(geometryNode),
    );

    points.name = geometryNode.name;
    points.position.copy(geometryNode.boundingBox.min);
    points.frustumCulled = false;
    points.onBeforeRender = PointCloudMaterial.makeOnBeforeRender(pointCloud, node);
    points.userData.pointCloudOctreeNode = node;
    this.sceneNodes.set(geometryNode, points);

    return node;
  }

  updateSceneNode(node: PointCloudOctreeNode): void {
    const sceneNode = node.sceneNode;
    sceneNode.visible = true;
    sceneNode.updateMatrix();
    sceneNode.matrixWorld.multiplyMatrices(this.context.pointCloud.matrixWorld, sceneNode.matrix);
  }

  updateRenderState(camera: Camera, renderer: PointCloudRenderer): void {
    this.assertInitialized();
    this.applyAppearance();
    this.material.updateMaterial(
      this.context.pointCloud,
      this.context.pointCloud.visibleNodes,
      camera,
      renderer as WebGLRenderer,
    );
  }

  disposeSceneNode(geometryNode: IPointCloudGeometryNode): void {
    const points = this.sceneNodes.get(geometryNode);
    if (!points) {
      return;
    }

    points.removeFromParent();
    points.onBeforeRender = () => undefined;
    points.geometry = undefined as any;
    points.material = undefined as any;
    delete points.userData.pointCloudOctreeNode;
    this.sceneNodes.delete(geometryNode);
  }

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

  private applyAppearance(): void {
    const appearance = this.context.appearance;
    if (appearance.revision === this.lastAppearanceRevision) {
      return;
    }

    const material = this.material;
    const snapshot = appearance.getSnapshot();
    const selectedPoint = snapshot.selectedPoint;

    material.backgroundMap = snapshot.backgroundMap || undefined;
    material.bbSize = [...snapshot.boundingBoxSize];
    material.setUniform('blendDepthSupplement', appearance.blendDepthSupplement);
    material.setUniform('blendHardness', appearance.blendHardness);
    material.classification = snapshot.classification;
    material.clipExtent = [...snapshot.clipExtent];
    material.clipHighlightColor.copy(snapshot.clipHighlightColor);
    material.clipHighlightColorBoost = appearance.clipHighlightColorBoost;
    material.clipHighlightColorEnabled = appearance.clipHighlightColorEnabled;
    material.clipMode = appearance.clipMode;
    material.color.copy(snapshot.color);
    material.colorRgba = appearance.colorRgba;
    material.depthMap = snapshot.depthMap || undefined;
    material.elevationRange = [...snapshot.elevationRange];
    material.enablePointHighlighting = selectedPoint.enabled;
    material.filterByNormalThreshold = appearance.filterByNormalThreshold;
    material.fog = appearance.fog;
    material.gradient = snapshot.gradient.slice();
    material.highlightedPointColor.copy(selectedPoint.color);
    material.highlightedPointCoordinate.copy(selectedPoint.coordinate);
    material.highlightedPointScale = selectedPoint.scale;
    material.highlightPoint = selectedPoint.highlight;
    material.hqDepthPass = appearance.hqDepthPass;
    material.intensityBrightness = appearance.intensityBrightness;
    material.intensityContrast = appearance.intensityContrast;
    material.intensityGamma = appearance.intensityGamma;
    material.intensityRange = [...snapshot.intensityRange];
    material.lights = appearance.lights;
    material.maxSize = appearance.maxSize;
    material.minSize = appearance.minSize;
    material.normalFilteringMode = appearance.normalFilteringMode;
    material.opacity = appearance.opacity;
    material.opacityAttenuation = appearance.opacityAttenuation;
    material.pointCloudID = appearance.pointCloudID;
    material.pointCloudMixAngle = appearance.pointCloudMixAngle;
    material.pointCloudMixingMode = appearance.pointCloudMixingMode;
    material.pointColorType = appearance.pointColorType;
    material.pointOpacityType = appearance.pointOpacityType;
    material.pointSizeType = appearance.pointSizeType;
    material.renderDepth = appearance.renderDepth;
    material.rgbBrightness = appearance.rgbBrightness;
    material.rgbContrast = appearance.rgbContrast;
    material.rgbGamma = appearance.rgbGamma;
    material.shape = appearance.shape;
    material.size = appearance.size;
    material.stripeDistanceX = appearance.stripeDistanceX;
    material.stripeDistanceY = appearance.stripeDistanceY;
    material.stripeDivisorX = appearance.stripeDivisorX;
    material.stripeDivisorY = appearance.stripeDivisorY;
    material.transition = appearance.transition;
    material.treeType = appearance.treeType;
    material.useDrawingBufferSize = appearance.useDrawingBufferSize;
    material.useEDL = appearance.useEDL;
    material.useFilterByNormal = appearance.useFilterByNormal;
    material.usePointCloudMixing = appearance.usePointCloudMixing;
    material.useTextureBlending = appearance.useTextureBlending;
    material.weightClassification = appearance.weightClassification;
    material.weightElevation = appearance.weightElevation;
    material.weightIntensity = appearance.weightIntensity;
    material.weightReturnNumber = appearance.weightReturnNumber;
    material.weightRGB = appearance.weightRGB;
    material.weightSourceID = appearance.weightSourceID;
    material.weighted = appearance.weighted;
    material.setClipBoxes(snapshot.clipBoxes.slice());
    material.updateShaderSource();

    this.lastAppearanceRevision = appearance.revision;
  }

  private assertInitialized(): void {
    if (!this.initialized || this.disposed) {
      throw new Error('The WebGL point-cloud render adapter is not initialized.');
    }
  }
}
