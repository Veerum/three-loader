import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Matrix4, Object3D, Points, Vector3 } from 'three';

// The built browser package only needs canvas gradients for these material/ownership tests.
globalThis.document = {
  baseURI: 'http://localhost/',
  createElement: () => ({
    getContext: (kind) =>
      kind === '2d'
        ? { rect() {}, fill() {}, createLinearGradient: () => ({ addColorStop() {} }) }
        : null,
  }),
};
const { PointCloudMaterial, PointCloudSelection, PointCloudSelectionMask, PointColorType } =
  await import('../build/index.mjs').catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
const region = (id, color, x = 0) => ({
  id,
  color,
  inverse: new Matrix4().makeTranslation(-x, 0, 0),
});

test('selection validates and copies transforms, preserves overlap priority and color', () => {
  const first = region('first', 'black');
  const selection = new PointCloudSelection([first, region('second', 'red')]);
  first.inverse.makeTranslation(10, 0, 0);
  assert.equal(selection.match(new Vector3()).id, 'first');
  assert.equal(selection.match(new Vector3()).color.getHex(), 0);
  selection.getRegions()[0].inverse.makeTranslation(20, 0, 0);
  assert.equal(selection.match(new Vector3()).id, 'first');
  assert.equal(selection.match(new Vector3(1, 0, 0)), undefined);
  assert.throws(() => new PointCloudSelection([first, first]));
  assert.throws(
    () => new PointCloudSelection([{ ...first, inverse: new Matrix4().makeScale(0, 1, 1) }]),
  );
  assert.throws(
    () => new PointCloudSelection(Array.from({ length: 33 }, (_, i) => region(String(i), 'red'))),
  );
});

test('native material keeps hooks and uniform identities stable across replace, clear and shader rebuild', () => {
  const material = new PointCloudMaterial();
  const hook = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  const boxes = material.uniforms.selectionBoxes;
  const colors = material.uniforms.selectionColors;
  const version = material.version;
  material.setSelection(new PointCloudSelection([region('red', 'red')]));
  material.setSelection(new PointCloudSelection([region('blue', 'blue', 2)]));
  assert.equal(material.uniforms.selectionColors, colors);
  assert.equal(material.uniforms.selectionBoxes, boxes);
  assert.equal(colors.value[0].getHex(), 0x0000ff);
  assert.equal(boxes.value[0].elements[12], -2);
  assert.equal(material.version, version);
  for (const type of [PointColorType.RGB, PointColorType.DEPTH, PointColorType.POINT_INDEX]) {
    material.pointColorType = type;
    material.updateShaderSource();
    assert.equal(material.uniforms.selectionCount.value, 1);
    assert.equal(material.onBeforeCompile, hook);
    assert.equal(material.customProgramCacheKey, key);
  }
  material.setSelection();
  assert.equal(material.uniforms.selectionCount.value, 0);
  material.dispose();
});

test('mask owns its selection, borrows geometry, forwards LOD callbacks and prunes hidden/disposed models', () => {
  const source = new PointCloudMaterial();
  source.setSelection(new PointCloudSelection([region('source', 'red')]));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
  const node = new Points(geometry, source);
  node.matrixWorld.makeTranslation(5, 0, 0);
  const cloud = Object.assign(new Object3D(), {
    material: source,
    disposed: false,
    visibleNodes: [{ sceneNode: node }],
  });
  const parent = new Object3D();
  parent.add(cloud);
  let current = cloud;
  const mask = new PointCloudSelectionMask(
    () => current,
    new PointCloudSelection([region('mask', 'black')]),
  );
  mask.sync();
  const pass = mask.children[0];
  assert.equal(pass.geometry, geometry);
  assert.ok(pass.matrixWorld.equals(node.matrixWorld));
  assert.equal(pass.material.uniforms.selectionColors.value[0].getHex(), 0);
  assert.equal(pass.material.uniforms.selectionMask.value, true);
  assert.equal(source.uniforms.selectionMask.value, false);
  let calls = 0;
  node.onBeforeRender = (...args) => {
    calls++;
    assert.equal(args[4], source);
  };
  pass.onBeforeRender({}, {}, {}, geometry, pass.material, {});
  assert.equal(calls, 1);
  assert.equal(pass.material.uniformsNeedUpdate, true);
  parent.visible = false;
  mask.sync();
  assert.equal(mask.children.length, 0);
  parent.visible = true;
  mask.sync();
  assert.equal(mask.children.length, 1);
  cloud.disposed = true;
  mask.sync();
  assert.equal(mask.children.length, 0);
  cloud.disposed = false;
  mask.sync();
  current = null;
  mask.sync();
  assert.equal(mask.children.length, 0);
  let disposedMaterial = 0,
    disposedGeometry = 0,
    disposedSource = 0;
  pass.material.addEventListener('dispose', () => disposedMaterial++);
  geometry.addEventListener('dispose', () => disposedGeometry++);
  source.addEventListener('dispose', () => disposedSource++);
  mask.dispose();
  mask.dispose();
  mask.sync();
  assert.equal(disposedMaterial, 1);
  assert.equal(disposedGeometry, 0);
  assert.equal(disposedSource, 0);
  source.dispose();
  geometry.dispose();
});
