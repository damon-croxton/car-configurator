import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import { DisposalBin } from './disposal';

/**
 * Baked-on-demand contact shadow.
 *
 * The car is rendered from below into an offscreen target with a depth
 * material, blurred twice, and shown on a plane under the car. It gives a soft,
 * grounded shadow with none of the shimmering of a real-time shadow map — and
 * because it only re-renders when the configuration changes, it costs nothing
 * per frame.
 */
export class ContactShadow {
  readonly group = new THREE.Group();

  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly blurTarget: THREE.WebGLRenderTarget;
  private readonly camera: THREE.OrthographicCamera;
  private readonly plane: THREE.Mesh;
  private readonly blurPlane: THREE.Mesh;
  private readonly depthMaterial: THREE.MeshDepthMaterial;
  private readonly horizontalBlur: THREE.ShaderMaterial;
  private readonly verticalBlur: THREE.ShaderMaterial;
  private readonly bin = new DisposalBin();
  private dirty = true;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    options: { width?: number; depth?: number; height?: number; resolution?: number } = {},
  ) {
    const width = options.width ?? 3.2;
    const depth = options.depth ?? 5.4;
    const height = options.height ?? 1.6;
    const resolution = options.resolution ?? 512;

    this.group.name = 'ContactShadow';

    this.renderTarget = this.bin.add(
      new THREE.WebGLRenderTarget(resolution, resolution, { depthBuffer: true }),
    );
    this.renderTarget.texture.generateMipmaps = false;

    this.blurTarget = this.bin.add(new THREE.WebGLRenderTarget(resolution, resolution, { depthBuffer: false }));
    this.blurTarget.texture.generateMipmaps = false;

    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, height);
    this.camera.rotation.x = Math.PI / 2;
    this.group.add(this.camera);

    // The plane faces -Y so that the upward-looking shadow camera sees its
    // front face during the depth and blur passes. The visible plane is then
    // flipped with a negative Y scale, which also corrects the texture's
    // vertical orientation.
    const planeGeometry = this.bin.add(new THREE.PlaneGeometry(width, depth));
    planeGeometry.rotateX(Math.PI / 2);

    // The depth pass writes black with the shadow strength in alpha, so plain
    // alpha blending darkens whatever is underneath.
    const planeMaterial = this.bin.add(
      new THREE.MeshBasicMaterial({
        map: this.renderTarget.texture,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );

    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.plane.renderOrder = 1;
    this.plane.scale.y = -1;
    this.plane.position.y = 0.004;
    this.group.add(this.plane);

    this.blurPlane = new THREE.Mesh(planeGeometry);
    this.blurPlane.visible = false;
    this.group.add(this.blurPlane);

    // Depth written as luminance so the blur passes can treat it as an image.
    this.depthMaterial = this.bin.add(new THREE.MeshDepthMaterial());
    this.depthMaterial.userData.darkness = { value: 1.6 };
    this.depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = this.depthMaterial.userData.darkness;
      shader.fragmentShader = /* glsl */ `
        uniform float darkness;
        ${shader.fragmentShader.replace(
          'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
          'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );',
        )}
      `;
    };
    this.depthMaterial.depthTest = false;
    this.depthMaterial.depthWrite = false;

    this.horizontalBlur = this.bin.add(new THREE.ShaderMaterial(HorizontalBlurShader));
    this.horizontalBlur.depthTest = false;
    this.verticalBlur = this.bin.add(new THREE.ShaderMaterial(VerticalBlurShader));
    this.verticalBlur.depthTest = false;
  }

  setOpacity(opacity: number): void {
    (this.plane.material as THREE.MeshBasicMaterial).opacity = opacity;
  }

  setDarkness(darkness: number): void {
    this.depthMaterial.userData.darkness.value = darkness;
  }

  /** Mark the shadow stale; it re-bakes on the next `render` call. */
  invalidate(): void {
    this.dirty = true;
  }

  /**
   * Re-bake if needed. `scene` is rendered with the depth override, so the
   * caller must hide anything that should not cast (ground, grid, backdrop).
   */
  render(scene: THREE.Scene, force = false): void {
    if (!this.dirty && !force) return;
    this.dirty = false;

    const previousBackground = scene.background;
    const previousOverride = scene.overrideMaterial;
    const previousTarget = this.renderer.getRenderTarget();
    const previousFog = scene.fog;
    const previousClear = new THREE.Color();
    this.renderer.getClearColor(previousClear);
    const previousClearAlpha = this.renderer.getClearAlpha();

    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = this.depthMaterial;
    this.plane.visible = false;
    this.renderer.setClearColor(0x000000, 0);

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(scene, this.camera);

    scene.overrideMaterial = previousOverride;

    this.blur(4);
    this.blur(0.6);

    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(previousClear, previousClearAlpha);
    scene.background = previousBackground;
    scene.fog = previousFog;
    this.plane.visible = true;
  }

  private blur(amount: number): void {
    this.blurPlane.visible = true;

    this.blurPlane.material = this.horizontalBlur;
    this.horizontalBlur.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.horizontalBlur.uniforms.h.value = (amount * 1) / 256;
    this.renderer.setRenderTarget(this.blurTarget);
    this.renderer.render(this.blurPlane, this.camera);

    this.blurPlane.material = this.verticalBlur;
    this.verticalBlur.uniforms.tDiffuse.value = this.blurTarget.texture;
    this.verticalBlur.uniforms.v.value = (amount * 1) / 256;
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.blurPlane, this.camera);

    this.blurPlane.visible = false;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.bin.flush();
  }
}
