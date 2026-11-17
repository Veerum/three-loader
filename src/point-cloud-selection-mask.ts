import { NoBlending, Object3D, Points, RawShaderMaterial } from 'three';
import { createSelectionUniforms, updateSelectionUniforms } from './materials/selection-uniforms';
import { PointCloudOctree } from './point-cloud-octree';
import { PointCloudSelection } from './point-cloud-selection';

/** A standard-material, colored occupancy mask for a caller-owned offscreen scene.
 * Render into a cleared RGBA target with depth. RGB is premultiplied region color,
 * alpha is occupancy. Context points write depth with zero occupancy.
 * Call sync after updating point clouds, before rendering the mask scene.
 * HD materials, photo depth occlusion and screen-space halo styling are not supported.
 */
export class PointCloudSelectionMask extends Object3D {
  private readonly material = new RawShaderMaterial({
    uniforms: createSelectionUniforms(true),
    depthTest: true,
    depthWrite: true,
    blending: NoBlending,
  });
  private readonly nodes = new Map<Points, Points>();
  private disposed = false;

  constructor(
    private readonly getPointCloud: () => PointCloudOctree | null,
    selection: PointCloudSelection,
  ) {
    super();
    updateSelectionUniforms(
      this.material.uniforms as ReturnType<typeof createSelectionUniforms>,
      selection,
    );
    this.matrixAutoUpdate = false;
    this.matrixWorldAutoUpdate = false;
  }

  public sync() {
    if (this.disposed) {
      return;
    }
    const octree = this.getPointCloud();
    const source = octree?.material;
    let visible = !!octree?.visible && !octree?.disposed;
    for (let parent = octree?.parent; parent; parent = parent.parent) {
      visible = visible && parent.visible;
    }
    const active = new Set(
      visible
        ? octree?.visibleNodes
            .map((node) => node.sceneNode)
            .filter((node) => node?.visible && node.geometry)
        : [],
    );
    for (const [node, pass] of this.nodes) {
      if (!active.has(node)) {
        this.remove(pass);
        this.nodes.delete(node);
      }
    }
    if (!source) {
      return;
    }
    const material = this.material;
    if (
      material.vertexShader !== source.vertexShader ||
      material.fragmentShader !== source.fragmentShader
    ) {
      material.vertexShader = source.vertexShader;
      material.fragmentShader = source.fragmentShader;
      material.defines = { ...source.defines };
      material.glslVersion = source.glslVersion;
      material.needsUpdate = true;
    }
    for (const [name, uniform] of Object.entries(source.uniforms)) {
      if (
        !['selectionCount', 'selectionBoxes', 'selectionColors', 'selectionMask'].includes(name)
      ) {
        material.uniforms[name] = uniform;
      }
    }
    for (const node of active) {
      let pass = this.nodes.get(node);
      if (!pass) {
        pass = new Points(node.geometry, material);
        pass.matrixAutoUpdate = false;
        pass.matrixWorldAutoUpdate = false;
        pass.frustumCulled = false;
        pass.raycast = () => {};
        this.nodes.set(node, pass);
        this.add(pass);
      }
      pass.geometry = node.geometry;
      pass.layers.mask = node.layers.mask;
      pass.matrixWorld.copy(node.matrixWorld);
      pass.onBeforeRender = (renderer, scene, camera, geometry, _material, group) => {
        // Keep Potree camera/LOD uniforms current without exposing its private callbacks.
        node.onBeforeRender(renderer, scene, camera, geometry, source, group);
        material.uniformsNeedUpdate = true;
      };
    }
  }

  public dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clear();
    this.nodes.clear();
    this.material.dispose();
    this.removeFromParent();
  }
}
