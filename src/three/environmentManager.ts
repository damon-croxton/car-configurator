import * as THREE from 'three';
// HDRLoader is the current name of three's RGBE (.hdr) loader.
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import type { EnvironmentDef } from '../data/schema';
import { DisposalBin, removeAndDispose } from './disposal';
import type { MaterialLibrary } from './materialLibrary';

/**
 * Image-based lighting + practical lights + ground plane.
 *
 * HDRIs are loaded with three's RGBE loader when the environment declares one and the
 * file is actually present. When it is not (the default for this repo — no
 * binary assets are committed) a matching lighting rig is generated in code and
 * pre-filtered with `PMREMGenerator`, so reflections and IBL still look right.
 */
export class EnvironmentManager {
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly bin = new DisposalBin();

  private envTexture: THREE.Texture | null = null;
  private backgroundTexture: THREE.Texture | null = null;
  private lightRig: THREE.Group | null = null;
  private ground: THREE.Mesh | null = null;
  private grid: THREE.GridHelper | null = null;
  private current: EnvironmentDef | null = null;
  private token = 0;
  /** True when the active IBL came from a real .hdr rather than the code rig. */
  private usingHdri = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly materials: MaterialLibrary,
    private readonly loadingManager: THREE.LoadingManager,
  ) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
  }

  get environmentId(): string | null {
    return this.current?.id ?? null;
  }

  /** False when the IBL is the code-generated rig rather than a real HDRI. */
  get usingHdriEnvironment(): boolean {
    return this.usingHdri;
  }

  /** Swap to a new environment. Concurrent calls resolve to the last one. */
  async apply(def: EnvironmentDef, groundReflection: number): Promise<void> {
    const isSameEnvironment = this.current?.id === def.id;
    this.current = def;

    if (!isSameEnvironment) {
      const requestToken = ++this.token;
      const texture = await this.buildEnvironmentTexture(def);
      if (requestToken !== this.token) {
        texture?.dispose();
        return;
      }

      this.envTexture?.dispose();
      this.envTexture = texture;
      this.scene.environment = texture;
      this.scene.environmentIntensity = def.envIntensity;
      this.materials.setEnvironmentIntensity(def.envIntensity);

      this.applyBackground(def);
      this.applyLights(def);
    }

    this.applyGround(def, groundReflection);
  }

  private async buildEnvironmentTexture(def: EnvironmentDef): Promise<THREE.Texture | null> {
    const hdr = await this.tryLoadHdri(def.hdri);
    if (hdr) {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const target = this.pmrem.fromEquirectangular(hdr);
      hdr.dispose();
      this.usingHdri = true;
      return target.texture;
    }

    const rigScene = this.buildProceduralEnvScene(def);
    const target = this.pmrem.fromScene(rigScene, 0, 0.1, 120);
    removeAndDispose(rigScene);
    this.usingHdri = false;
    return target.texture;
  }

  private async tryLoadHdri(url: string): Promise<THREE.DataTexture | null> {
    if (!url) return null;
    try {
      const probe = await fetch(url, { method: 'HEAD' });
      if (!probe.ok) return null;
      const loader = new HDRLoader(this.loadingManager);
      return await loader.loadAsync(url);
    } catch {
      return null;
    }
  }

  /**
   * Code-generated stand-in for an HDRI: a graded sky dome plus emissive
   * softbox panels positioned from `materialsData.json`. Pre-filtered by
   * PMREM it produces believable studio/sunset/neon reflections.
   */
  private buildProceduralEnvScene(def: EnvironmentDef): THREE.Scene {
    const rig = new THREE.Scene();
    const { skyTop, skyHorizon, skyBottom, panels } = def.procedural;

    const dome = new THREE.SphereGeometry(60, 32, 24);
    const domeMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(skyTop).convertSRGBToLinear() },
        horizonColor: { value: new THREE.Color(skyHorizon).convertSRGBToLinear() },
        bottomColor: { value: new THREE.Color(skyBottom).convertSRGBToLinear() },
      },
      vertexShader: /* glsl */ `
        varying float vHeight;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vHeight = normalize(world.xyz).y;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        varying float vHeight;
        void main() {
          float h = vHeight;
          vec3 color = h > 0.0
            ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
            : mix(horizonColor, bottomColor, pow(clamp(-h, 0.0, 1.0), 0.4));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    rig.add(new THREE.Mesh(dome, domeMaterial));

    for (const panel of panels) {
      const geometry = new THREE.BoxGeometry(panel.size[0], panel.size[1], panel.size[2]);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(panel.color).convertSRGBToLinear().multiplyScalar(panel.intensity),
      });
      const box = new THREE.Mesh(geometry, material);
      box.position.fromArray(panel.position);
      box.rotation.fromArray(panel.rotation as unknown as [number, number, number]);
      rig.add(box);
    }

    return rig;
  }

  private applyBackground(def: EnvironmentDef): void {
    this.backgroundTexture?.dispose();
    this.backgroundTexture = null;

    if (def.backgroundMode === 'environment' && this.envTexture) {
      this.scene.background = this.envTexture;
      this.scene.backgroundBlurriness = def.backgroundBlur;
    } else if (def.backgroundMode === 'gradient') {
      this.backgroundTexture = createGradientTexture(def.backgroundTop, def.backgroundBottom);
      this.scene.background = this.backgroundTexture;
      this.scene.backgroundBlurriness = 0;
    } else {
      this.scene.background = new THREE.Color(def.backgroundBottom);
    }

    this.scene.fog = new THREE.FogExp2(new THREE.Color(def.fogColor).getHex(), def.fogDensity);
  }

  private applyLights(def: EnvironmentDef): void {
    removeAndDispose(this.lightRig);
    const rig = new THREE.Group();
    rig.name = 'EnvironmentLights';

    // With a real HDRI the IBL carries most of the illumination, so the
    // practicals drop back to shaping and shadow-casting duty. Without one they
    // run at full strength because the generated rig alone is too weak.
    const practical = this.usingHdri ? def.practicalScale : 1;

    const key = new THREE.DirectionalLight(def.key.color, def.key.intensity * practical);
    key.position.fromArray(def.key.position);
    key.castShadow = true;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    const extent = 3.6;
    key.shadow.camera.left = -extent;
    key.shadow.camera.right = extent;
    key.shadow.camera.top = extent;
    key.shadow.camera.bottom = -extent;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 24;
    rig.add(key, key.target);

    const fill = new THREE.DirectionalLight(def.fill.color, def.fill.intensity * practical);
    fill.position.fromArray(def.fill.position);
    rig.add(fill);

    const rim = new THREE.DirectionalLight(def.rim.color, def.rim.intensity * practical);
    rim.position.fromArray(def.rim.position);
    rig.add(rim);

    this.scene.add(rig);
    this.lightRig = rig;
  }

  /** Shadow map resolution follows the device pixel ratio, per the perf budget. */
  setShadowQuality(size: number): void {
    this.lightRig?.traverse((child) => {
      const light = child as THREE.DirectionalLight;
      if (light.isDirectionalLight && light.castShadow) {
        light.shadow.mapSize.set(size, size);
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
    });
  }

  private applyGround(def: EnvironmentDef, reflection: number): void {
    if (!this.ground) {
      const geometry = new THREE.PlaneGeometry(80, 80);
      geometry.rotateX(-Math.PI / 2);
      const material = this.bin.add(
        new THREE.MeshStandardMaterial({ name: 'Ground', color: '#0b0d11', roughness: 0.4, metalness: 0.4 }),
      );
      this.ground = new THREE.Mesh(geometry, material);
      this.ground.name = 'Ground';
      this.ground.receiveShadow = true;
      this.ground.position.y = -0.001;
      this.scene.add(this.ground);
    }

    const material = this.ground.material as THREE.MeshStandardMaterial;
    material.color.set(def.groundHex).convertSRGBToLinear();
    // The reflection slider blends between the environment's matte and mirror
    // extremes rather than replacing the ground's own character.
    material.roughness = THREE.MathUtils.lerp(def.groundRoughness, 0.04, reflection);
    material.metalness = THREE.MathUtils.lerp(def.groundMetalness, 0.95, reflection * 0.7);
    material.envMapIntensity = 0.5 + reflection * 1.2;

    removeAndDispose(this.grid);
    const grid = new THREE.GridHelper(60, 60, def.gridHex, def.gridHex);
    grid.name = 'Grid';
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.18;
    grid.position.y = 0.0015;
    this.scene.add(grid);
    this.grid = grid;
  }

  setGridVisible(visible: boolean): void {
    if (this.grid) this.grid.visible = visible;
  }

  /** Hide the backdrop so it does not occlude the contact-shadow depth pass. */
  setBackdropVisible(visible: boolean): void {
    if (this.ground) this.ground.visible = visible;
    if (this.grid) this.grid.visible = visible;
  }

  dispose(): void {
    removeAndDispose(this.lightRig);
    removeAndDispose(this.grid);
    removeAndDispose(this.ground);
    this.envTexture?.dispose();
    this.backgroundTexture?.dispose();
    this.bin.flush();
    this.pmrem.dispose();
    this.scene.environment = null;
    this.scene.background = null;
  }
}

/** Vertical two-stop gradient used as a lightweight scene backdrop. */
function createGradientTexture(top: string, bottom: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
