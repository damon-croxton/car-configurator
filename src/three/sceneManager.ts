import * as THREE from 'three';
import type { CarConfig } from '../config/types';
import { getCameraPreset, getEnvironment } from '../data/schema';
import { CameraRig } from './cameraRig';
import { CarModel } from './carModel';
import { ContactShadow } from './contactShadow';
import { EnvironmentManager } from './environmentManager';
import { MaterialLibrary } from './materialLibrary';
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
  usingFallbackModel: boolean;
}

export interface SceneManagerOptions {
  onLoadingChange?: (state: LoadingState) => void;
  onStats?: (stats: SceneStats) => void;
}

/**
 * Top-level owner of the WebGL side of the app. React never touches Three
 * directly — it calls `setConfig`, `goToCamera` and `capture`, and everything
 * else (loading, disposal, resize, quality scaling) lives here.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly loadingManager = new THREE.LoadingManager();

  private readonly rig: CameraRig;
  private readonly materials = new MaterialLibrary();
  private readonly car: CarModel;
  private readonly environment: EnvironmentManager;
  private readonly shadow: ContactShadow;
  private readonly post: PostProcessing;
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();

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
    this.car = new CarModel(this.materials, this.loadingManager);
    this.scene.add(this.car.group);

    this.environment = new EnvironmentManager(
      this.renderer,
      this.scene,
      this.materials,
      this.loadingManager,
    );
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

  /** First-time boot: build the car and light the scene. */
  async initialise(config: CarConfig): Promise<void> {
    this.config = config;
    this.options.onLoadingChange?.({ progress: 0.08, label: 'Building chassis', done: false });

    await this.car.load(config.generation);
    this.options.onLoadingChange?.({ progress: 0.45, label: 'Applying materials', done: false });

    this.materials.applyConfig(config);
    this.car.applyConfig(config);

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
      await this.car.load(next.generation);
    }

    this.materials.applyConfig(next);
    this.car.applyConfig(next);

    if (!previous || previous.environment !== next.environment || previous.groundReflection !== next.groundReflection) {
      await this.environment.apply(getEnvironment(next.environment), next.groundReflection);
      // Environment intensity resets material env scaling; re-push colours.
      this.materials.applyConfig(next);
    }

    this.applyRenderSettings(next);

    if (next.cameraPreset !== this.lastCameraPreset) {
      this.lastCameraPreset = next.cameraPreset;
      this.rig.goTo(getCameraPreset(next.cameraPreset));
    }

    this.shadow.invalidate();
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

    if (this.config?.wheelSpin) {
      this.car.spinWheels(delta, 9);
    }
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
        usingFallbackModel: this.car.usingFallback,
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
    this.materials.dispose();
    this.rig.dispose();

    this.renderer.domElement.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

function describeAsset(url: string): string {
  const file = url.split('/').pop() ?? url;
  if (file.endsWith('.hdr')) return `Environment · ${file}`;
  if (file.endsWith('.glb') || file.endsWith('.gltf')) return `Model · ${file}`;
  return file;
}
