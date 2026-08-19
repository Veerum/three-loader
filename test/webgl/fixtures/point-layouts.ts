/** Deterministic, repository-local decoded layouts used by F01 browser and loader tests. */
export interface F01Fixture {
  name: string;
  loader: string;
  encoding: string;
  layout: 'rgb' | 'rgba' | 'splats';
  equivalentTo?: string;
  expected: string;
}

export const fixtures: F01Fixture[] = [
  { name: 'v1-bin', loader: 'V1', encoding: 'BIN', layout: 'rgb', expected: 'Points RGB layout' },
  { name: 'v1-las', loader: 'V1', encoding: 'LAS', layout: 'rgba', expected: 'Points RGBA layout' },
  {
    name: 'v1-laz',
    loader: 'V1',
    encoding: 'LAZ',
    layout: 'rgba',
    equivalentTo: 'v1-las',
    expected: 'Points RGBA layout',
  },
  {
    name: 'v2-default',
    loader: 'V2',
    encoding: 'DEFAULT',
    layout: 'rgba',
    expected: 'Points RGBA layout',
  },
  {
    name: 'v2-brotli',
    loader: 'V2',
    encoding: 'BROTLI',
    layout: 'rgba',
    equivalentTo: 'v2-default',
    expected: 'Points RGBA layout',
  },
  {
    name: 'v2-gltf-points',
    loader: 'V2',
    encoding: 'GLTF',
    layout: 'rgba',
    equivalentTo: 'v2-default',
    expected: 'Points RGBA layout',
  },
  {
    name: 'v2-gltf-splats',
    loader: 'V2',
    encoding: 'GLTF splats',
    layout: 'splats',
    expected: 'WebGL splat mesh route',
  },
];

export const positions = new Float32Array([-0.3, -0.3, 0, 0.3, -0.3, 0, 0, 0.6, 0]);
export const colors = new Uint8Array([255, 32, 32, 32, 255, 32, 32, 32, 255]);
export const rgba = new Uint8Array([255, 32, 32, 255, 32, 255, 32, 192, 32, 32, 255, 128]);
export const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
export const intensities = new Float32Array([0, 32_500, 65_000]);
export const classifications = new Uint8Array([2, 5, 9]);
export const pointIndices = new Uint8Array([0, 0, 0, 1, 1, 0, 0, 2, 0, 0, 3, 0]);
