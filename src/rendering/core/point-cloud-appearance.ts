import { Color, Texture, Vector3, Vector4 } from 'three';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_MAX_POINT_SIZE,
  DEFAULT_RGB_BRIGHTNESS,
  DEFAULT_RGB_CONTRAST,
  DEFAULT_RGB_GAMMA,
} from '../../constants';
import { DEFAULT_CLASSIFICATION } from '../../materials/classification';
import { ClipMode, IClipBox } from '../../materials/clipping';
import {
  NormalFilteringMode,
  PointCloudMixingMode,
  PointColorType,
  PointOpacityType,
  PointShape,
  PointSizeType,
  TreeType,
} from '../../materials/enums';
import { SPECTRAL } from '../../materials/gradients';
import { IClassification, IGradient } from '../../materials/types';

interface PointCloudAppearanceScalars {
  blendDepthSupplement: number;
  blendHardness: number;
  clipHighlightColorBoost: number;
  clipHighlightColorEnabled: boolean;
  clipMode: ClipMode;
  colorRgba: boolean;
  filterByNormalThreshold: number;
  fog: boolean;
  hqDepthPass: boolean;
  intensityBrightness: number;
  intensityContrast: number;
  intensityGamma: number;
  lights: boolean;
  maxSize: number;
  minSize: number;
  normalFilteringMode: NormalFilteringMode;
  opacity: number;
  opacityAttenuation: number;
  pointCloudID: number;
  pointCloudMixAngle: number;
  pointCloudMixingMode: PointCloudMixingMode;
  pointColorType: PointColorType;
  pointOpacityType: PointOpacityType;
  pointSizeType: PointSizeType;
  renderDepth: boolean;
  rgbBrightness: number;
  rgbContrast: number;
  rgbGamma: number;
  shape: PointShape;
  size: number;
  stripeDistanceX: number;
  stripeDistanceY: number;
  stripeDivisorX: number;
  stripeDivisorY: number;
  transition: number;
  treeType: TreeType;
  useDrawingBufferSize: boolean;
  useEDL: boolean;
  useFilterByNormal: boolean;
  usePointCloudMixing: boolean;
  useTextureBlending: boolean;
  weightClassification: number;
  weightElevation: number;
  weightIntensity: number;
  weightReturnNumber: number;
  weightRGB: number;
  weightSourceID: number;
  weighted: boolean;
}

export interface PointCloudSelectedPoint {
  color: Vector4;
  coordinate: Vector3;
  enabled: boolean;
  highlight: boolean;
  scale: number;
}

export interface PointCloudAppearanceOptions {
  colorRgba?: boolean;
}

export interface PointCloudAppearanceSnapshot {
  backgroundMap: Texture | null;
  boundingBoxSize: [number, number, number];
  classification: IClassification;
  clipBoxes: IClipBox[];
  clipExtent: [number, number, number, number];
  clipHighlightColor: Color;
  color: Color;
  depthMap: Texture | null;
  elevationRange: [number, number];
  gradient: IGradient;
  intensityRange: [number, number];
  selectedPoint: PointCloudSelectedPoint;
}

/** Backend-neutral point-cloud rendering configuration. */
export class PointCloudAppearance {
  private _backgroundMap: Texture | null = null;
  private _boundingBoxSize: [number, number, number] = [0, 0, 0];
  private _classification: IClassification = cloneClassification(DEFAULT_CLASSIFICATION);
  private _clipBoxes: IClipBox[] = [];
  private _clipExtent: [number, number, number, number] = [0, 0, 1, 1];
  private _clipHighlightColor = new Color(0xffffff);
  private _color = new Color(0xffffff);
  private _depthMap: Texture | null = null;
  private _elevationRange: [number, number] = [0, 1];
  private _gradient: IGradient = cloneGradient(SPECTRAL);
  private _intensityRange: [number, number] = [0, 65000];
  private _revision = 0;
  private _selectedPoint: PointCloudSelectedPoint = {
    color: DEFAULT_HIGHLIGHT_COLOR.clone(),
    coordinate: new Vector3(),
    enabled: true,
    highlight: false,
    scale: 2,
  };
  private snapshot: PointCloudAppearanceSnapshot;

  private readonly values: PointCloudAppearanceScalars;

  constructor(options: PointCloudAppearanceOptions = {}) {
    this.values = {
      blendDepthSupplement: 0,
      blendHardness: 2,
      clipHighlightColorBoost: 1,
      clipHighlightColorEnabled: false,
      clipMode: ClipMode.DISABLED,
      colorRgba: options.colorRgba === true,
      filterByNormalThreshold: 0,
      fog: false,
      hqDepthPass: false,
      intensityBrightness: 0,
      intensityContrast: 0,
      intensityGamma: 1,
      lights: false,
      maxSize: DEFAULT_MAX_POINT_SIZE,
      minSize: 2,
      normalFilteringMode: NormalFilteringMode.ABSOLUTE_NORMAL_FILTERING_MODE,
      opacity: 1,
      opacityAttenuation: 1,
      pointCloudID: 2,
      pointCloudMixAngle: 31,
      pointCloudMixingMode: PointCloudMixingMode.CHECKBOARD,
      pointColorType: PointColorType.RGB,
      pointOpacityType: PointOpacityType.FIXED,
      pointSizeType: PointSizeType.ADAPTIVE,
      renderDepth: false,
      rgbBrightness: DEFAULT_RGB_BRIGHTNESS,
      rgbContrast: DEFAULT_RGB_CONTRAST,
      rgbGamma: DEFAULT_RGB_GAMMA,
      shape: PointShape.SQUARE,
      size: 1,
      stripeDistanceX: 5,
      stripeDistanceY: 5,
      stripeDivisorX: 2,
      stripeDivisorY: 2,
      transition: 0.5,
      treeType: TreeType.OCTREE,
      useDrawingBufferSize: false,
      useEDL: false,
      useFilterByNormal: false,
      usePointCloudMixing: false,
      useTextureBlending: false,
      weightClassification: 0,
      weightElevation: 0,
      weightIntensity: 0,
      weightReturnNumber: 0,
      weightRGB: 1,
      weightSourceID: 0,
      weighted: false,
    };
    this.snapshot = this.makeSnapshot();
  }

  get revision(): number {
    return this._revision;
  }

  get backgroundMap(): Texture | null {
    return this._backgroundMap;
  }

  get boundingBoxSize(): [number, number, number] {
    return this._boundingBoxSize;
  }

  get classification(): IClassification {
    return this._classification;
  }

  get clipBoxes(): ReadonlyArray<IClipBox> {
    return this._clipBoxes;
  }

  get clipExtent(): [number, number, number, number] {
    return this._clipExtent;
  }

  get clipHighlightColor(): Color {
    return this._clipHighlightColor;
  }

  get color(): Color {
    return this._color;
  }

  get depthMap(): Texture | null {
    return this._depthMap;
  }

  get elevationRange(): [number, number] {
    return this._elevationRange;
  }

  get gradient(): IGradient {
    return this._gradient;
  }

  get intensityRange(): [number, number] {
    return this._intensityRange;
  }

  get selectedPoint(): Readonly<PointCloudSelectedPoint> {
    return this._selectedPoint;
  }

  /** @internal Adapter snapshot of explicitly committed compound values. */
  getSnapshot(): Readonly<PointCloudAppearanceSnapshot> {
    return this.snapshot;
  }

  invalidate(): void {
    this.snapshot = this.makeSnapshot();
    this.markChanged();
  }

  updateBackgroundMap(value: Texture | null): void {
    this._backgroundMap = value;
    this.snapshot.backgroundMap = value;
    this.markChanged();
  }

  updateBoundingBoxSize(value: [number, number, number]): void {
    this._boundingBoxSize = value;
    this.snapshot.boundingBoxSize = [...value];
    this.markChanged();
  }

  updateClassification(value: IClassification): void {
    this._classification = value;
    this.snapshot.classification = cloneClassification(value);
    this.markChanged();
  }

  updateClipBoxes(value: IClipBox[]): void {
    this._clipBoxes = value;
    this.snapshot.clipBoxes = value.map(cloneClipBox);
    this.markChanged();
  }

  updateClipExtent(value: [number, number, number, number]): void {
    this._clipExtent = value;
    this.snapshot.clipExtent = [...value];
    this.markChanged();
  }

  updateClipHighlightColor(value: Color): void {
    this._clipHighlightColor = value;
    this.snapshot.clipHighlightColor = value.clone();
    this.markChanged();
  }

  updateColor(value: Color): void {
    this._color = value;
    this.snapshot.color = value.clone();
    this.markChanged();
  }

  updateDepthMap(value: Texture | null): void {
    this._depthMap = value;
    this.snapshot.depthMap = value;
    this.markChanged();
  }

  updateElevationRange(value: [number, number]): void {
    this._elevationRange = value;
    this.snapshot.elevationRange = [...value];
    this.markChanged();
  }

  updateGradient(value: IGradient): void {
    this._gradient = value;
    this.snapshot.gradient = cloneGradient(value);
    this.markChanged();
  }

  updateIntensityRange(value: [number, number]): void {
    this._intensityRange = value;
    this.snapshot.intensityRange = [...value];
    this.markChanged();
  }

  updateSelectedPoint(value: Partial<PointCloudSelectedPoint>): void {
    this._selectedPoint = { ...this._selectedPoint, ...value };
    this.snapshot.selectedPoint = cloneSelectedPoint(this._selectedPoint);
    this.markChanged();
  }

  private getScalar<K extends keyof PointCloudAppearanceScalars>(
    key: K,
  ): PointCloudAppearanceScalars[K] {
    return this.values[key];
  }

  private setScalar<K extends keyof PointCloudAppearanceScalars>(
    key: K,
    value: PointCloudAppearanceScalars[K],
  ): void {
    if (this.values[key] !== value) {
      this.values[key] = value;
      this.markChanged();
    }
  }

  private makeSnapshot(): PointCloudAppearanceSnapshot {
    return {
      backgroundMap: this._backgroundMap,
      boundingBoxSize: [...this._boundingBoxSize],
      classification: cloneClassification(this._classification),
      clipBoxes: this._clipBoxes.map(cloneClipBox),
      clipExtent: [...this._clipExtent],
      clipHighlightColor: this._clipHighlightColor.clone(),
      color: this._color.clone(),
      depthMap: this._depthMap,
      elevationRange: [...this._elevationRange],
      gradient: cloneGradient(this._gradient),
      intensityRange: [...this._intensityRange],
      selectedPoint: cloneSelectedPoint(this._selectedPoint),
    };
  }

  private markChanged(): void {
    this._revision++;
  }

  get blendDepthSupplement() {
    return this.getScalar('blendDepthSupplement');
  }
  set blendDepthSupplement(value: number) {
    this.setScalar('blendDepthSupplement', value);
  }
  get blendHardness() {
    return this.getScalar('blendHardness');
  }
  set blendHardness(value: number) {
    this.setScalar('blendHardness', value);
  }
  get clipHighlightColorBoost() {
    return this.getScalar('clipHighlightColorBoost');
  }
  set clipHighlightColorBoost(value: number) {
    this.setScalar('clipHighlightColorBoost', value);
  }
  get clipHighlightColorEnabled() {
    return this.getScalar('clipHighlightColorEnabled');
  }
  set clipHighlightColorEnabled(value: boolean) {
    this.setScalar('clipHighlightColorEnabled', value);
  }
  get clipMode() {
    return this.getScalar('clipMode');
  }
  set clipMode(value: ClipMode) {
    this.setScalar('clipMode', value);
  }
  get colorRgba() {
    return this.getScalar('colorRgba');
  }
  set colorRgba(value: boolean) {
    this.setScalar('colorRgba', value);
  }
  get filterByNormalThreshold() {
    return this.getScalar('filterByNormalThreshold');
  }
  set filterByNormalThreshold(value: number) {
    this.setScalar('filterByNormalThreshold', value);
  }
  get fog() {
    return this.getScalar('fog');
  }
  set fog(value: boolean) {
    this.setScalar('fog', value);
  }
  get hqDepthPass() {
    return this.getScalar('hqDepthPass');
  }
  set hqDepthPass(value: boolean) {
    this.setScalar('hqDepthPass', value);
  }
  get intensityBrightness() {
    return this.getScalar('intensityBrightness');
  }
  set intensityBrightness(value: number) {
    this.setScalar('intensityBrightness', value);
  }
  get intensityContrast() {
    return this.getScalar('intensityContrast');
  }
  set intensityContrast(value: number) {
    this.setScalar('intensityContrast', value);
  }
  get intensityGamma() {
    return this.getScalar('intensityGamma');
  }
  set intensityGamma(value: number) {
    this.setScalar('intensityGamma', value);
  }
  get lights() {
    return this.getScalar('lights');
  }
  set lights(value: boolean) {
    this.setScalar('lights', value);
  }
  get maxSize() {
    return this.getScalar('maxSize');
  }
  set maxSize(value: number) {
    this.setScalar('maxSize', value);
  }
  get minSize() {
    return this.getScalar('minSize');
  }
  set minSize(value: number) {
    this.setScalar('minSize', value);
  }
  get normalFilteringMode() {
    return this.getScalar('normalFilteringMode');
  }
  set normalFilteringMode(value: NormalFilteringMode) {
    this.setScalar('normalFilteringMode', value);
  }
  get opacity() {
    return this.getScalar('opacity');
  }
  set opacity(value: number) {
    this.setScalar('opacity', value);
  }
  get opacityAttenuation() {
    return this.getScalar('opacityAttenuation');
  }
  set opacityAttenuation(value: number) {
    this.setScalar('opacityAttenuation', value);
  }
  get pointCloudID() {
    return this.getScalar('pointCloudID');
  }
  set pointCloudID(value: number) {
    this.setScalar('pointCloudID', value);
  }
  get pointCloudMixAngle() {
    return this.getScalar('pointCloudMixAngle');
  }
  set pointCloudMixAngle(value: number) {
    this.setScalar('pointCloudMixAngle', value);
  }
  get pointCloudMixingMode() {
    return this.getScalar('pointCloudMixingMode');
  }
  set pointCloudMixingMode(value: PointCloudMixingMode) {
    this.setScalar('pointCloudMixingMode', value);
  }
  get pointColorType() {
    return this.getScalar('pointColorType');
  }
  set pointColorType(value: PointColorType) {
    this.setScalar('pointColorType', value);
  }
  get pointOpacityType() {
    return this.getScalar('pointOpacityType');
  }
  set pointOpacityType(value: PointOpacityType) {
    this.setScalar('pointOpacityType', value);
  }
  get pointSizeType() {
    return this.getScalar('pointSizeType');
  }
  set pointSizeType(value: PointSizeType) {
    this.setScalar('pointSizeType', value);
  }
  get renderDepth() {
    return this.getScalar('renderDepth');
  }
  set renderDepth(value: boolean) {
    this.setScalar('renderDepth', value);
  }
  get rgbBrightness() {
    return this.getScalar('rgbBrightness');
  }
  set rgbBrightness(value: number) {
    this.setScalar('rgbBrightness', value);
  }
  get rgbContrast() {
    return this.getScalar('rgbContrast');
  }
  set rgbContrast(value: number) {
    this.setScalar('rgbContrast', value);
  }
  get rgbGamma() {
    return this.getScalar('rgbGamma');
  }
  set rgbGamma(value: number) {
    this.setScalar('rgbGamma', value);
  }
  get shape() {
    return this.getScalar('shape');
  }
  set shape(value: PointShape) {
    this.setScalar('shape', value);
  }
  get size() {
    return this.getScalar('size');
  }
  set size(value: number) {
    this.setScalar('size', value);
  }
  get stripeDistanceX() {
    return this.getScalar('stripeDistanceX');
  }
  set stripeDistanceX(value: number) {
    this.setScalar('stripeDistanceX', value);
  }
  get stripeDistanceY() {
    return this.getScalar('stripeDistanceY');
  }
  set stripeDistanceY(value: number) {
    this.setScalar('stripeDistanceY', value);
  }
  get stripeDivisorX() {
    return this.getScalar('stripeDivisorX');
  }
  set stripeDivisorX(value: number) {
    this.setScalar('stripeDivisorX', value);
  }
  get stripeDivisorY() {
    return this.getScalar('stripeDivisorY');
  }
  set stripeDivisorY(value: number) {
    this.setScalar('stripeDivisorY', value);
  }
  get transition() {
    return this.getScalar('transition');
  }
  set transition(value: number) {
    this.setScalar('transition', value);
  }
  get treeType() {
    return this.getScalar('treeType');
  }
  set treeType(value: TreeType) {
    this.setScalar('treeType', value);
  }
  get useDrawingBufferSize() {
    return this.getScalar('useDrawingBufferSize');
  }
  set useDrawingBufferSize(value: boolean) {
    this.setScalar('useDrawingBufferSize', value);
  }
  get useEDL() {
    return this.getScalar('useEDL');
  }
  set useEDL(value: boolean) {
    this.setScalar('useEDL', value);
  }
  get useFilterByNormal() {
    return this.getScalar('useFilterByNormal');
  }
  set useFilterByNormal(value: boolean) {
    this.setScalar('useFilterByNormal', value);
  }
  get usePointCloudMixing() {
    return this.getScalar('usePointCloudMixing');
  }
  set usePointCloudMixing(value: boolean) {
    this.setScalar('usePointCloudMixing', value);
  }
  get useTextureBlending() {
    return this.getScalar('useTextureBlending');
  }
  set useTextureBlending(value: boolean) {
    this.setScalar('useTextureBlending', value);
  }
  get weightClassification() {
    return this.getScalar('weightClassification');
  }
  set weightClassification(value: number) {
    this.setScalar('weightClassification', value);
  }
  get weightElevation() {
    return this.getScalar('weightElevation');
  }
  set weightElevation(value: number) {
    this.setScalar('weightElevation', value);
  }
  get weightIntensity() {
    return this.getScalar('weightIntensity');
  }
  set weightIntensity(value: number) {
    this.setScalar('weightIntensity', value);
  }
  get weightReturnNumber() {
    return this.getScalar('weightReturnNumber');
  }
  set weightReturnNumber(value: number) {
    this.setScalar('weightReturnNumber', value);
  }
  get weightRGB() {
    return this.getScalar('weightRGB');
  }
  set weightRGB(value: number) {
    this.setScalar('weightRGB', value);
  }
  get weightSourceID() {
    return this.getScalar('weightSourceID');
  }
  set weightSourceID(value: number) {
    this.setScalar('weightSourceID', value);
  }
  get weighted() {
    return this.getScalar('weighted');
  }
  set weighted(value: boolean) {
    this.setScalar('weighted', value);
  }
}

function cloneClassification(value: IClassification): IClassification {
  const result = {} as IClassification;
  for (const key of Object.keys(value)) {
    result[key] = value[key].clone();
  }
  return result;
}

function cloneClipBox(value: IClipBox): IClipBox {
  return {
    box: value.box.clone(),
    inverse: value.inverse.clone(),
    matrix: value.matrix.clone(),
    position: value.position.clone(),
  };
}

function cloneGradient(value: IGradient): IGradient {
  return value.map(([position, color]) => [position, color.clone()]);
}

function cloneSelectedPoint(value: PointCloudSelectedPoint): PointCloudSelectedPoint {
  return {
    color: value.color.clone(),
    coordinate: value.coordinate.clone(),
    enabled: value.enabled,
    highlight: value.highlight,
    scale: value.scale,
  };
}
