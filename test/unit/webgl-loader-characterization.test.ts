import { describe, expect, test } from '@jest/globals';
import { Box3, BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { BrotliDecoder } from '../../src/loading2/brotli-decoder';
import { Decoder } from '../../src/loading2/decoder';
import { GltfDecoder } from '../../src/loading2/gltf-decoder';
import { GltfSplatDecoder } from '../../src/loading2/gltf-splats-decoder';
import { LoadingContext, Metadata } from '../../src/loading2/octree-loader';
import {
  PointAttributeName,
  PointAttributes as V1PointAttributes,
} from '../../src/point-attributes';
import { handleMessage as decodeV1Binary } from '../../src/workers/binary-decoder-worker-internal';
import { readUsingDataView as decodeLasPointRecords } from '../../src/workers/las-decoder-worker-internal';

type PostedMessage = { [key: string]: any };

const bounds = new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1));

function captureWorkerPost(run: () => void): PostedMessage {
  let result: PostedMessage | undefined;
  const original = globalThis.postMessage;
  Object.defineProperty(globalThis, 'postMessage', {
    configurable: true,
    value: (message: PostedMessage) => {
      result = message;
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(globalThis, 'postMessage', { configurable: true, value: original });
  }

  if (!result) {
    throw new Error('decoder did not post a result');
  }
  return result;
}

function metadata(encoding: string, splats = false): Metadata {
  const attributes: any[] = splats
    ? ['position', 'sh_band_0', 'opacity', 'scale', 'rotation'].map((name) => ({
        name,
        description: name,
        size: 4,
        numElements: name === 'opacity' ? 1 : 3,
        type: 'float',
        min: [0, 0, 0],
        max: [1, 1, 1],
        bufferView: { byteLength: 12, byteOffset: 0, uri: `${name}.bin` },
      }))
    : [];

  return {
    version: '2.0',
    name: 'f01-local-fixture',
    description: 'deterministic repository-local decoder fixture',
    points: 3,
    projection: '',
    hierarchy: { firstChunkSize: 22, stepSize: 5, depth: 2 },
    offset: [0, 0, 0],
    scale: [0.01, 0.01, 0.01],
    spacing: 1,
    boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
    encoding,
    attributes,
  };
}

function loadingContext(): LoadingContext {
  return {
    workerPool: {} as any,
    basePath: '/fixtures',
    hierarchyPath: '/fixtures/hierarchy.bin',
    octreePath: '/fixtures/octree.bin',
    gltfColorsPath: '/fixtures/colors.glbin',
    gltfPositionsPath: '/fixtures/positions.glbin',
    harmonicsEnabled: false,
    getUrl: async (url: string) => url,
    xhrRequest: async () => new Response(new Uint8Array(256)),
  };
}

function v2Node(byteSize = 3n): any {
  return {
    name: 'r',
    byteOffset: 0n,
    byteSize,
    numPoints: 3,
    boundingBox: bounds.clone(),
    octreeGeometry: {
      pointAttributes: {},
      scale: [0.01, 0.01, 0.01],
      offset: new Vector3(),
    },
  };
}

function pointWorkerPayload() {
  return {
    density: 1,
    tightBoundingBox: { min: [0, 0, 0], max: [1, 1, 0] },
    attributeBuffers: {
      position: { buffer: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer },
      rgba: { buffer: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]).buffer },
      NORMAL: { buffer: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]).buffer },
      INDICES: { buffer: new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0]).buffer },
      intensity: {
        buffer: new Float32Array([0, 32500, 65000]).buffer,
        attribute: { range: [0, 65000] },
        offset: 0,
        scale: 1,
        preciseBuffer: new Uint16Array([0, 32500, 65000]).buffer,
      },
    },
  };
}

function workerReturning(data: object): Worker {
  const worker: any = {
    onmessage: undefined,
    postMessage: () => {
      queueMicrotask(() => worker.onmessage({ data }));
    },
  };
  return worker;
}

function describeLayout(geometry: BufferGeometry) {
  return Object.entries(geometry.attributes)
    .map(([name, attribute]) => {
      const bufferAttribute = attribute as BufferAttribute;
      return [name, bufferAttribute.itemSize, bufferAttribute.normalized];
    })
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
}

describe('F01 deterministic loader and encoding matrix', () => {
  test('V1 BIN decodes a repository-local wire record', () => {
    const pointAttributes = new V1PointAttributes([
      'POSITION_CARTESIAN',
      'RGB_PACKED',
      'INTENSITY',
      'CLASSIFICATION',
    ]);
    const source = new ArrayBuffer(pointAttributes.byteSize);
    const view = new DataView(source);
    view.setUint32(0, 10, true);
    view.setUint32(4, 20, true);
    view.setUint32(8, 30, true);
    view.setUint8(12, 255);
    view.setUint8(13, 64);
    view.setUint8(14, 32);
    view.setUint16(15, 1234, true);
    view.setUint8(17, 5);

    const result = captureWorkerPost(() =>
      decodeV1Binary({
        data: { buffer: source, pointAttributes, version: '1.7', offset: [0, 0, 0], scale: 0.1 },
      } as MessageEvent),
    );

    expect(
      Array.from(
        new Float32Array(result.attributeBuffers[PointAttributeName.POSITION_CARTESIAN].buffer),
      ),
    ).toEqual([1, 2, 3]);
    expect(
      Array.from(new Uint8Array(result.attributeBuffers[PointAttributeName.COLOR_PACKED].buffer)),
    ).toEqual([255, 64, 32]);
    expect(
      Array.from(new Float32Array(result.attributeBuffers[PointAttributeName.INTENSITY].buffer)),
    ).toEqual([1234]);
    expect(
      Array.from(new Uint8Array(result.attributeBuffers[PointAttributeName.CLASSIFICATION].buffer)),
    ).toEqual([5]);
  });

  test('V1 LAS decodes the point-record layout shared by LAZ after decompression', () => {
    const source = new ArrayBuffer(26);
    const view = new DataView(source);
    view.setInt32(0, 10, true);
    view.setInt32(4, 20, true);
    view.setInt32(8, 30, true);
    view.setUint16(12, 1234, true);
    view.setUint8(14, 26);
    view.setUint8(15, 5);
    view.setUint16(18, 42, true);
    view.setUint16(20, 65535, true);
    view.setUint16(22, 32768, true);
    view.setUint16(24, 16384, true);

    const result = captureWorkerPost(() =>
      decodeLasPointRecords({
        data: {
          buffer: source,
          numPoints: 1,
          pointSize: 26,
          pointFormatID: 2,
          scale: [0.1, 0.1, 0.1],
          offset: [0, 0, 0],
          mins: [0, 0, 0],
        },
      }),
    );

    expect(Array.from(new Float32Array(result.position))).toEqual([1, 2, 3]);
    expect(Array.from(new Uint8Array(result.color))).toEqual([255, 128, 64, 255]);
    expect(Array.from(new Float32Array(result.intensity))).toEqual([1234]);
    expect(Array.from(new Uint8Array(result.returnNumber))).toEqual([2]);
    expect(Array.from(new Uint8Array(result.numberOfReturns))).toEqual([3]);
    expect(Array.from(new Uint8Array(result.classification))).toEqual([5]);
    expect(Array.from(new Uint16Array(result.pointSourceID))).toEqual([42]);
  });

  test('V2 DEFAULT, BROTLI, and non-splat GLTF expose equivalent decoded layouts', async () => {
    const context = loadingContext();
    const expected = [
      ['indices', 4, true],
      ['intensity', 1, false],
      ['normal', 3, false],
      ['position', 3, false],
      ['rgba', 4, true],
    ];
    const cases = [
      new Decoder(metadata('DEFAULT'), context),
      new BrotliDecoder(metadata('BROTLI'), context),
      new GltfDecoder(metadata('GLTF'), context),
    ];

    for (const decoder of cases) {
      const result = await decoder.decode(v2Node(), workerReturning(pointWorkerPayload()));
      expect(result).toBeDefined();
      expect(describeLayout(result!.geometry)).toEqual(expected);
      expect((result!.geometry.getAttribute('intensity') as any).potree.range).toEqual([0, 65000]);
    }
  });

  test('V2 GLTF splats preserve the distinct decoded WebGL splat layout', async () => {
    const payload = {
      density: 1,
      tightBoundingBox: { min: [0, 0, 0], max: [1, 1, 0] },
      attributeBuffers: {
        position: { buffer: new Float32Array(12).buffer },
        raw_position: { buffer: new Float32Array(12).buffer },
        scale: { buffer: new Float32Array(9).buffer },
        orientation: { buffer: new Float32Array(12).buffer },
        COVARIANCE0: { buffer: new Float32Array(12).buffer },
        COVARIANCE1: { buffer: new Float32Array(6).buffer },
        POS_COLOR: { buffer: new Uint32Array(12).buffer },
      },
    };
    const decoder = new GltfSplatDecoder(metadata('GLTF', true), loadingContext());
    const result = await decoder.decode(v2Node(), workerReturning(payload));

    expect(result).toBeDefined();
    expect(describeLayout(result!.geometry)).toEqual([
      ['centers', 4, false],
      ['COVARIANCE0', 4, false],
      ['COVARIANCE1', 2, false],
      ['orientation', 4, false],
      ['POS_COLOR', 4, false],
      ['raw_position', 4, false],
      ['scale', 3, false],
    ]);
    expect(result!.geometry.drawRange.count).toBe(3);
    expect(result!.geometry.userData).toMatchObject({ maxDepth: 3, totalSplats: 3 });
  });
});
