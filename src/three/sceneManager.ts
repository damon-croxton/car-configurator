import * as THREE from 'three';
import type { CarConfig } from '../config/types';
import {
  getCameraPreset,
  getEnvironment,
  getGeneration,
  getInteriorTrim,
  getPaintColor,
  getPaintFinish,
  getRoofFabric,
  getWheelFinish,
} from '../data/schema';
import { activeMods, forcedModIds } from '../data/mods';
import { CameraRig } from './cameraRig';
import { CarModel, type IslandDebugResult, type ModelSpec, type PaintSpec } from './carModel';
import { ContactShadow } from './contactShadow';
import { EnvironmentManager } from './environmentManager';
import { PostProcessing } from './postProcessing';

export interface LoadingState {
  progress: number;
  label: string;
  done: boolean;
}

export interface SceneStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  usingHdriEnvironment: boolean;
}

export interface SceneManagerOptions {
  onLoadingChange?: (state: LoadingState) => void;
  onStats?: (stats: SceneStats) => void;
}

/**
 * Top-level owner of the WebGL side of the app. React never touches Three
 * directly — it calls `setConfig`, `goToCamera` and `capture`, and everything
 * else (loading, disposal, resize, quality scaling) lives here.
 *
 * `setConfig` drives the camera, the environment, the render settings, and the
 * handful of things the model can express without being cut up: body colour,
 * rim finish, wheel size, ride height, camber and track. Roof, aero and
 * interior options remain inert by design.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly loadingManager = new THREE.LoadingManager();

  private readonly rig: CameraRig;
  private readonly car: CarModel;
  private readonly environment: EnvironmentManager;
  private readonly shadow: ContactShadow;
  private readonly post: PostProcessing;
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private config: CarConfig | null = null;
  private animationHandle = 0;
  private disposed = false;
  private frames = 0;
  private fpsAccumulator = 0;
  private lastCameraPreset = '';
  private firstFrame = true;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: SceneManagerOptions = {},
  ) {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      // Required so the snapshot tool can read the frame back reliably.
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.targetPixelRatio());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    // Accumulate stats across every pass instead of only the last one.
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.rig = new CameraRig(this.renderer.domElement, width / height);
    this.car = new CarModel(this.loadingManager);
    this.scene.add(this.car.group);

    this.environment = new EnvironmentManager(this.renderer, this.scene, this.loadingManager);
    this.environment.setShadowQuality(this.shadowMapSize());

    this.shadow = new ContactShadow(this.renderer);
    this.scene.add(this.shadow.group);

    this.post = new PostProcessing(this.renderer, this.scene, this.rig.camera, width, height);

    this.wireLoadingManager();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /* ---------------------------------------------------------------- */
  /* Loading                                                           */
  /* ---------------------------------------------------------------- */

  private wireLoadingManager(): void {
    const emit = (progress: number, label: string, done: boolean) =>
      this.options.onLoadingChange?.({ progress, label, done });

    this.loadingManager.onStart = (url) => emit(0.02, describeAsset(url), false);
    this.loadingManager.onProgress = (url, loaded, total) =>
      emit(total > 0 ? loaded / total : 0.5, describeAsset(url), false);
    this.loadingManager.onLoad = () => emit(1, 'Ready', true);
    this.loadingManager.onError = (url) => emit(1, `Skipped ${describeAsset(url)}`, true);
  }

  /** First-time boot: load the car and light the scene. */
  async initialise(config: CarConfig): Promise<void> {
    this.config = config;
    this.options.onLoadingChange?.({ progress: 0.08, label: 'Loading model', done: false });

    await this.car.load(modelSpecFor(config.generation));
    this.applyCarConfig(config);
    await this.car.setMods(activeMods(config.generation, config, forcedModIds()), config.generation);

    // Dev-only handle on the live scene. `CONFORM_POSTMORTEM.md` records that
    // the ability to inspect the real thing was worth more than any amount of
    // reasoning about what it should contain — this is the cheap version of it.
    // `import.meta.env` is Vite's, and this tsconfig does not pull in
    // vite/client, so read it structurally rather than widen the global types.
    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as unknown as Record<string, unknown>).__mx5 = this;
    }

    this.options.onLoadingChange?.({ progress: 0.7, label: 'Lighting environment', done: false });
    await this.environment.apply(getEnvironment(config.environment), config.groundReflection);

    this.applyRenderSettings(config);
    this.rig.snapTo(getCameraPreset(config.cameraPreset));
    this.lastCameraPreset = config.cameraPreset;
    this.shadow.invalidate();

    this.options.onLoadingChange?.({ progress: 1, label: 'Ready', done: true });
  }

  /* ---------------------------------------------------------------- */
  /* Configuration                                                     */
  /* ---------------------------------------------------------------- */

  async setConfig(next: CarConfig): Promise<void> {
    const previous = this.config;
    this.config = next;

    if (!previous || previous.generation !== next.generation) {
      this.options.onLoadingChange?.({ progress: 0.1, label: 'Loading model', done: false });
      await this.car.load(modelSpecFor(next.generation));
      this.options.onLoadingChange?.({ progress: 1, label: 'Ready', done: true });
    }

    this.applyCarConfig(next);

    // Mods come after the rest of the car config: fitting one re-buckets the
    // materials and re-applies paint, so it has to see the final colours.
    await this.car.setMods(activeMods(next.generation, next, forcedModIds()), next.generation);

    if (!previous || previous.environment !== next.environment || previous.groundReflection !== next.groundReflection) {
      await this.environment.apply(getEnvironment(next.environment), next.groundReflection);
    }

    this.applyRenderSettings(next);

    if (next.cameraPreset !== this.lastCameraPreset) {
      this.lastCameraPreset = next.cameraPreset;
      this.rig.goTo(getCameraPreset(next.cameraPreset));
    }

    this.shadow.invalidate();
  }

  /** Everything the config is allowed to change about the car itself. */
  private applyCarConfig(config: CarConfig): void {
    const paintSpec = paintSpecFor(config);
    this.car.setPaint(paintSpec);

    const rawFinish = getWheelFinish(config.wheelFinish);
    // "Body Colour Match" has no fixed hex of its own — it borrows whatever
    // the body is wearing right now, already computed above for setPaint.
    const finish = rawFinish.matchBody
      ? {
          ...rawFinish,
          hex: paintSpec.hex,
          metalness: paintSpec.metalness,
          roughness: paintSpec.roughness,
          clearcoat: paintSpec.clearcoat,
        }
      : rawFinish;
    this.car.setWheelFinish(finish);

    this.car.setRoofFabric(getRoofFabric(config.roofFabric).hex);
    this.car.setRoofUp(config.roofState === 'up');

    const trim = getInteriorTrim(config.interiorTrim);
    this.car.setInterior({
      seatHex: trim.seatHex,
      trimHex: trim.trimHex,
      roughness: trim.roughness,
    });

    this.car.setStance({
      wheelDiameter: config.wheelDiameter,
      rideHeight: config.rideHeight,
      camber: config.camber,
      trackOffset: config.trackOffset,
    });

    this.car.setWheelBrakes(config.wheelBrakes);
    this.car.setTyreWidth(config.tyreWidth);
    this.car.setTyreSidewall(config.tyreSidewall);
    this.car.setTyreVisible(config.tyreVisible);
  }

  private applyRenderSettings(config: CarConfig): void {
    const environment = getEnvironment(config.environment);
    this.renderer.toneMappingExposure = environment.exposure * config.exposure;
    this.post.setBloom(config.bloom, config.environment === 'urban_night' ? 0.55 : 0.35);
    this.post.setSsao(config.ssao);
    this.shadow.group.visible = config.contactShadow;
    this.shadow.setOpacity(environment.shadowOpacity);
    this.rig.setAutoRotate(config.turntable);
  }

  /**
   * Debug view: colour the cabin loose parts that sit inside the roof volume,
   * so a human can say which are roof lining and which are cabin trim.
   * Returns one entry per candidate for the on-screen legend.
   */
  showIslandDebug(enabled: boolean): IslandDebugResult {
    const reports = this.car.showIslandDebug(enabled);
    this.shadow.invalidate();
    return reports;
  }

  /** Emphasise one debug island and fade the rest. Null clears the emphasis. */
  highlightIsland(index: number | null): void {
    this.car.highlightIsland(index);
  }

  /**
   * Which debug island is under this point? Coordinates are CSS pixels
   * relative to the canvas; returns the island index or null for a miss.
   */
  pickIsland(x: number, y: number): number | null {
    const meshes = this.car.islandMeshes;
    if (meshes.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    return meshes.indexOf(hits[0].object as THREE.Mesh);
  }

  /** Set which cabin loose parts (and what height cut) count as roof lining. */
  setRoofLining(keys: string[], cutY: number | null): void {
    this.car.setRoofLining(keys, cutY);
    this.shadow.invalidate();
  }

  /** Height range of the soft top, for the lining cut slider. */
  roofCutRange(): { min: number; max: number; value: number | null } | null {
    return this.car.roofCutRange();
  }

  goToCamera(presetId: string): void {
    this.lastCameraPreset = presetId;
    this.rig.goTo(getCameraPreset(presetId));
  }

  /* ---------------------------------------------------------------- */
  /* Frame loop                                                        */
  /* ---------------------------------------------------------------- */

  private animate = (): void => {
    if (this.disposed) return;
    this.animationHandle = requestAnimationFrame(this.animate);

    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.renderer.info.reset();

    this.rig.update();

    if (this.config?.contactShadow) {
      this.environment.setBackdropVisible(false);
      this.shadow.render(this.scene);
      this.environment.setBackdropVisible(true);
    }

    this.post.render();

    // Bake the shadow once more on the very first frame: materials and the
    // environment settle asynchronously, so the initial bake can be stale.
    if (this.firstFrame) {
      this.firstFrame = false;
      this.shadow.invalidate();
    }

    this.frames++;
    this.fpsAccumulator += delta;
    if (this.fpsAccumulator >= 0.5) {
      this.options.onStats?.({
        fps: Math.round(this.frames / this.fpsAccumulator),
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        usingHdriEnvironment: this.environment.usingHdriEnvironment,
      });
      this.frames = 0;
      this.fpsAccumulator = 0;
    }
  };

  /* ---------------------------------------------------------------- */
  /* Sizing & quality                                                  */
  /* ---------------------------------------------------------------- */

  private targetPixelRatio(): number {
    // Cap DPR so 3x phones do not render 9x the pixels.
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  private shadowMapSize(): number {
    const dpr = window.devicePixelRatio || 1;
    const wide = window.innerWidth >= 1280;
    if (dpr >= 2 && wide) return 2048;
    if (wide) return 1536;
    return 1024;
  }

  private handleResize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const pixelRatio = this.targetPixelRatio();

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.rig.setAspect(width / height);
    this.post.setSize(width, height, pixelRatio);
    this.environment.setShadowQuality(this.shadowMapSize());
    this.shadow.invalidate();
  }

  /* ---------------------------------------------------------------- */
  /* Snapshot                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Render a high-resolution frame and return it as a PNG data URL. The DOM
   * overlay is never part of the canvas, so the result is UI-free by
   * construction.
   */
  capture(scaleFactor = 2): string {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const previousPixelRatio = this.renderer.getPixelRatio();

    // Cap the export so a 4K viewport does not blow past WebGL limits.
    const maxDimension = this.renderer.capabilities.maxTextureSize;
    const scale = Math.min(scaleFactor, maxDimension / Math.max(width, height));

    this.renderer.setPixelRatio(scale);
    this.post.setSize(width, height, scale);
    this.rig.update();
    this.post.render();

    const dataUrl = this.renderer.domElement.toDataURL('image/png');

    this.renderer.setPixelRatio(previousPixelRatio);
    this.post.setSize(width, height, previousPixelRatio);
    this.renderer.setSize(width, height);
    this.shadow.invalidate();

    return dataUrl;
  }

  /* ---------------------------------------------------------------- */

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationHandle);
    this.resizeObserver.disconnect();

    this.post.dispose();
    this.shadow.dispose();
    this.environment.dispose();
    this.car.dispose();
    this.rig.dispose();

    this.renderer.domElement.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Fold the paint colour, its finish and the two sliders into one description.
 *
 * The finish comes from the colour unless the user has overridden it, which is
 * what `paintFinishOverride` is for — an empty string means "whatever this
 * colour ships with".
 *
 * Flake is the part with no direct material equivalent: three.js has no flake
 * term, so it is approximated the way it actually reads, by pushing the surface
 * more metallic, a little sharper and hotter against the environment. The
 * colour's own `flakeHex` drives the sheen tint, which is what gives Soul Red
 * its warm secondary glow rather than a grey one.
 */
function paintSpecFor(config: CarConfig): PaintSpec {
  const colour = getPaintColor(config.paint);
  const finish = getPaintFinish(config.paintFinishOverride || colour.finish);
  const flake = finish.flake * config.flakeIntensity;

  return {
    hex: colour.userColor ? config.paintCustomHex : colour.hex,
    flakeHex: colour.flakeHex ?? colour.hex,
    metalness: clamp01(finish.metalness + flake * 0.25),
    roughness: clamp01(Math.max(0.02, finish.roughness - flake * 0.06)),
    // The slider scales the finish rather than replacing it, so a matte wrap
    // stays matte at full clearcoat instead of turning glossy.
    clearcoat: clamp01(finish.clearcoat * config.clearcoat),
    clearcoatRoughness: finish.clearcoatRoughness,
    sheen: finish.sheen,
    iridescence: finish.iridescence,
    envIntensity: finish.envIntensity * (1 + flake * 0.25),
  };
}

/**
 * Everything the renderer needs about a generation's asset, read from the
 * catalogue. A generation with no `assetUrl` has no model yet and is gated
 * behind `available: false` in the UI, so this should never be reached for one.
 */
function modelSpecFor(generationId: string): ModelSpec {
  const generation = getGeneration(generationId);
  if (!generation.assetUrl) {
    throw new Error(`[SceneManager] ${generation.id} has no assetUrl in carData.json`);
  }
  return {
    id: generation.id,
    url: generation.assetUrl,
    length: generation.dimensions.length,
    // The asset ships wearing the generation's stock wheel, so that is the
    // size all wheel scaling is relative to.
    nativeWheelInches: generation.defaultWheelDiameter,
    surfaceModel: generation.surfaceModel ?? generation.id,
    yawDeg: generation.modelYawDeg ?? 0,
  };
}

function describeAsset(url: string): string {
  const file = url.split('/').pop() ?? url;
  if (file.endsWith('.hdr')) return `Environment · ${file}`;
  if (file.endsWith('.glb') || file.endsWith('.gltf')) return `Model · ${file}`;
  return file;
}
