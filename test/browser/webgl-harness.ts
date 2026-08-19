import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  OrthographicCamera,
  Points,
  Ray,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  ClipMode,
  PointCloudMaterial,
  PointColorType,
  PointShape,
  PointSizeType,
} from '../../src/materials';
import { BinaryLoader } from '../../src/loading/binary-loader';
import { PointCloudOctree } from '../../src/point-cloud-octree';
import { PointCloudOctreeGeometry } from '../../src/point-cloud-octree-geometry';
import { PointCloudOctreeGeometryNode } from '../../src/point-cloud-octree-geometry-node';
import { Potree } from '../../src/potree';
import {
  classifications,
  colors,
  fixtures,
  intensities,
  normals,
  pointIndices,
  positions,
  rgba,
} from '../webgl/fixtures/point-layouts';

type Scenario = { pixels: number; redPixels: number; pointIndex: number };
type Uploads = { count: number; bytes: number };

function geometry(includeRgba = false): BufferGeometry {
  const value = new BufferGeometry();
  value.setAttribute('position', new BufferAttribute(positions.slice(), 3));
  value.setAttribute('color', new BufferAttribute(colors.slice(), 3, true));
  value.setAttribute('normal', new BufferAttribute(normals.slice(), 3));
  value.setAttribute('intensity', new BufferAttribute(intensities.slice(), 1));
  value.setAttribute('classification', new BufferAttribute(classifications.slice(), 1));
  value.setAttribute('returnNumber', new BufferAttribute(new Uint8Array([1, 2, 1]), 1));
  value.setAttribute('numberOfReturns', new BufferAttribute(new Uint8Array([1, 2, 3]), 1));
  value.setAttribute('pointSourceID', new BufferAttribute(new Uint16Array([1, 2, 3]), 1));
  value.setAttribute('indices', new BufferAttribute(pointIndices.slice(), 4, true));
  if (includeRgba) value.setAttribute('rgba', new BufferAttribute(rgba.slice(), 4, true));
  return value;
}

function read(renderer: WebGLRenderer): Scenario {
  const gl = renderer.getContext();
  const pixels = new Uint8Array(160 * 160 * 4);
  gl.readPixels(0, 0, 160, 160, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let visible = 0;
  let red = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset] || pixels[offset + 1] || pixels[offset + 2]) visible++;
    if (pixels[offset] > 180 && pixels[offset + 1] < 100 && pixels[offset + 2] < 100) red++;
  }
  return { pixels: visible, redPixels: red, pointIndex: 1 };
}

function render(
  renderer: WebGLRenderer,
  setup: (material: PointCloudMaterial) => void,
  includeRgba = false,
): Scenario {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  const material = new PointCloudMaterial({ colorRgba: includeRgba });
  material.pointSizeType = PointSizeType.FIXED;
  material.size = 22;
  material.minSize = 1;
  material.maxSize = 64;
  material.opacity = 1;
  material.screenWidth = 160;
  material.screenHeight = 160;
  material.fov = Math.PI / 2;
  material.spacing = 1;
  setup(material);
  scene.add(new Points(geometry(includeRgba), material));
  renderer.setClearColor(new Color(0, 0, 0), 1);
  renderer.render(scene, camera);
  const result = read(renderer);
  material.dispose();
  return result;
}

function pick(renderer: WebGLRenderer, camera: OrthographicCamera): Scenario {
  camera.position.z = 2;
  camera.updateProjectionMatrix();
  const bounds = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  const request = async () => new Response(new ArrayBuffer(0));
  const loader = new BinaryLoader({
    version: '1.7',
    boundingBox: bounds,
    scale: 1,
    xhrRequest: request,
  });
  const source = new PointCloudOctreeGeometry(
    loader,
    bounds,
    bounds.clone(),
    new Vector3(),
    request,
  );
  source.spacing = 1;
  const root = new PointCloudOctreeGeometryNode('r', source, bounds);
  root.geometry = geometry();
  root.loaded = true;
  root.numPoints = 3;
  source.root = root;
  source.nodes[root.name] = root;

  const octree = new PointCloudOctree(new Potree('v1'), source);
  const treeNode = octree.toTreeNode(root);
  octree.visibleNodes = [treeNode];
  octree.visibleGeometry = [root];
  const scene = new Scene();
  scene.add(octree);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const ray = new Ray(new Vector3(-0.3, -0.3, 2), new Vector3(0, 0, -1));
  let callbackRan = false;
  const direct = octree.pick(renderer, camera, ray, {
    pixelPosition: new Vector3(56, 56, 0),
    pickWindowSize: 5,
    onBeforePickRender: () => {
      callbackRan = true;
    },
  });
  const shared = Potree.pick([octree], renderer, camera, ray, {
    pixelPosition: new Vector3(56, 56, 0),
  });
  const picked = direct || shared;
  const pointIndex = picked && picked.position ? 1 : 0;
  octree.dispose();
  return { pixels: callbackRan ? 1 : 0, redPixels: shared ? 1 : 0, pointIndex };
}

function splatRoute(): boolean {
  const bounds = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  const request = async () => new Response(new ArrayBuffer(0));
  const loader = new BinaryLoader({
    version: '1.7',
    boundingBox: bounds,
    scale: 1,
    xhrRequest: request,
  });
  const source = new PointCloudOctreeGeometry(
    loader,
    bounds,
    bounds.clone(),
    new Vector3(),
    request,
  );
  source.spacing = 1;
  const root = new PointCloudOctreeGeometryNode('r', source, bounds);
  const sourceGeometry = geometry(true);
  sourceGeometry.setAttribute('COVARIANCE0', new BufferAttribute(new Float32Array(12), 4));
  root.geometry = sourceGeometry;
  root.loaded = true;
  root.numPoints = 3;
  source.root = root;
  source.nodes[root.name] = root;

  const octree = new PointCloudOctree(new Potree('v2'), source, undefined, false, 3);
  octree.toTreeNode(root);
  octree.updateSplats(new OrthographicCamera(-1, 1, 1, -1, 0.1, 10), new Vector2(160, 160));
  return octree.splatsMesh !== null;
}

function environment(gl: WebGL2RenderingContext) {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    browser: navigator.userAgent,
    renderer: gl.getParameter(gl.RENDERER),
    vendor: gl.getParameter(gl.VENDOR),
    webglVersion: gl.getParameter(gl.VERSION),
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
    unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
    viewport: [160, 160],
    devicePixelRatio: window.devicePixelRatio,
  };
}

function run() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 160;
  document.body.replaceChildren(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(160, 160, false);
  const gl = renderer.getContext();
  const scenarios: Record<string, Scenario> = {};
  scenarios.rgb = render(renderer, () => undefined);
  scenarios.rgba = render(renderer, () => undefined, true);
  scenarios.fixedSmall = render(renderer, (material) => {
    material.size = 8;
  });
  scenarios.fixedLarge = render(renderer, (material) => {
    material.size = 24;
  });
  scenarios.attenuated = render(renderer, (material) => {
    material.pointSizeType = PointSizeType.ATTENUATED;
  });
  scenarios.adaptive = render(renderer, (material) => {
    material.pointSizeType = PointSizeType.ADAPTIVE;
  });
  scenarios.square = render(renderer, (material) => {
    material.shape = PointShape.SQUARE;
  });
  scenarios.circle = render(renderer, (material) => {
    material.shape = PointShape.CIRCLE;
  });
  scenarios.paraboloid = render(renderer, (material) => {
    material.shape = PointShape.PARABOLOID;
  });
  scenarios.height = render(renderer, (material) => {
    material.pointColorType = PointColorType.HEIGHT;
  });
  scenarios.intensity = render(renderer, (material) => {
    material.pointColorType = PointColorType.INTENSITY;
  });
  scenarios.classification = render(renderer, (material) => {
    material.pointColorType = PointColorType.CLASSIFICATION;
  });
  scenarios.opacity = render(renderer, (material) => {
    material.opacity = 0.5;
  });
  scenarios.highlighted = render(renderer, (material) => {
    material.highlightPoint = true;
    material.highlightedPointCoordinate = new Vector3(-0.3, -0.3, 0);
    material.highlightedPointColor.set(1, 0, 0, 1);
  });
  scenarios.filtered = render(renderer, (material) => {
    material.useFilterByNormal = true;
    material.filterByNormalThreshold = 0.1;
  });
  scenarios.clipped = render(renderer, (material) => {
    material.clipMode = ClipMode.CLIP_OUTSIDE;
    material.setClipBoxes([{ inverse: new Matrix4() } as any]);
  });
  const pickingStart = performance.now();
  scenarios.picking = pick(renderer, new OrthographicCamera(-1, 1, 1, -1, 0.1, 10));
  gl.finish();
  const pickingLatencyMs = performance.now() - pickingStart;
  const fixtureResults = fixtures.map((fixture) => ({
    name: fixture.name,
    equivalentTo: fixture.equivalentTo,
    expected: fixture.expected,
    result:
      fixture.layout === 'rgb' ? scenarios.rgb : fixture.layout === 'rgba' ? scenarios.rgba : null,
  }));
  return {
    webgl2: gl instanceof WebGL2RenderingContext,
    fixtures,
    scenarios,
    pointCount: positions.length / 3,
    fixtureResults,
    splatRoute: splatRoute(),
    pickingLatencyMs,
    environment: environment(gl as WebGL2RenderingContext),
  };
}

function benchmark(options: { frames: number }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 160;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is required for the F01 benchmark smoke scenario');

  const uploads: Uploads = { count: 0, bytes: 0 };
  const originalBufferData = gl.bufferData.bind(gl);
  gl.bufferData = ((
    target: GLenum,
    source: AllowSharedBufferSource | GLsizeiptr | null,
    usage: GLenum,
  ) => {
    uploads.count++;
    uploads.bytes += typeof source === 'number' ? source : source ? source.byteLength : 0;
    originalBufferData(target, source as any, usage);
  }) as typeof gl.bufferData;

  const renderer = new WebGLRenderer({
    canvas,
    context: gl,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(160, 160, false);
  renderer.info.autoReset = false;

  const sourceGeometry = geometry(true);
  const material = new PointCloudMaterial({ colorRgba: true });
  material.pointSizeType = PointSizeType.FIXED;
  material.size = 22;
  material.screenWidth = 160;
  material.screenHeight = 160;
  const scene = new Scene();
  scene.add(new Points(sourceGeometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;

  renderer.render(scene, camera);
  renderer.info.reset();
  const initialUploads = { ...uploads };
  uploads.count = 0;
  uploads.bytes = 0;

  let updateElapsedMs = 0;
  let renderElapsedMs = 0;
  for (let frame = 0; frame < options.frames; frame++) {
    let start = performance.now();
    for (let iteration = 0; iteration < 1000; iteration++) {
      material.size = 22 + ((frame + iteration) % 2);
    }
    updateElapsedMs += (performance.now() - start) / 1000;

    start = performance.now();
    renderer.render(scene, camera);
    gl.finish();
    renderElapsedMs += performance.now() - start;
  }

  const drawCalls = renderer.info.render.calls / options.frames;
  const renderedPoints = renderer.info.render.points / options.frames;
  const rendererMemory = { ...renderer.info.memory };
  const steadyStateUploads = { ...uploads };
  const sourceAttributes = Object.values(sourceGeometry.attributes) as BufferAttribute[];
  const memoryEstimateBytes = sourceAttributes.reduce(
    (total, attribute) => total + attribute.array.byteLength,
    0,
  );

  const picking = run();

  const report = {
    frames: options.frames,
    frameMs: (updateElapsedMs + renderElapsedMs) / options.frames,
    updateMs: updateElapsedMs / options.frames,
    renderMs: renderElapsedMs / options.frames,
    drawCalls,
    points: renderedPoints,
    nodes: 1,
    allocations: {
      sourceTypedArrays: sourceAttributes.length,
      sourceGeometries: 1,
      sourceMaterials: 1,
      rendererMemory,
    },
    uploads: { initial: initialUploads, steadyState: steadyStateUploads },
    memoryEstimateBytes,
    pickingLatencyMs: picking.pickingLatencyMs,
    pickingSucceeded: picking.scenarios.picking.pointIndex === 1,
    environment: environment(gl),
    authoritativeBaseline: false,
  };

  gl.bufferData = originalBufferData as typeof gl.bufferData;
  sourceGeometry.dispose();
  material.dispose();
  renderer.dispose();
  return report;
}

declare global {
  interface Window {
    __F01__: { run: typeof run; benchmark: typeof benchmark };
  }
}
window.__F01__ = { run, benchmark };
