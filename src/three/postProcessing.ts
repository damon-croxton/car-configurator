import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Optional post stack: bloom for the emissive lights, a subtle SSAO for
 * contact darkening. Both are configurable — when neither is enabled the
 * composer is bypassed entirely and the renderer draws straight to the canvas,
 * which is the cheapest path on low-end hardware.
 */
export class PostProcessing {
  private composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly ssaoPass: SSAOPass;
  private readonly outputPass: OutputPass;

  private bloomEnabled = true;
  private ssaoEnabled = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(renderer.getPixelRatio());

    this.renderPass = new RenderPass(scene, camera);

    this.ssaoPass = new SSAOPass(scene, camera, width, height);
    this.ssaoPass.kernelRadius = 0.28;
    this.ssaoPass.minDistance = 0.0008;
    this.ssaoPass.maxDistance = 0.06;
    this.ssaoPass.enabled = false;

    // Threshold sits just above the tone-mapped white point so only genuinely
    // emissive surfaces (lights, neon) bloom — not every specular highlight.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.45, 1.05);

    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.ssaoPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
  }

  get active(): boolean {
    return this.bloomEnabled || this.ssaoEnabled;
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.renderPass.camera = camera;
    this.ssaoPass.camera = camera;
  }

  setBloom(enabled: boolean, strength = 0.35): void {
    this.bloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
    this.bloomPass.strength = strength;
  }

  setSsao(enabled: boolean): void {
    this.ssaoEnabled = enabled;
    this.ssaoPass.enabled = enabled;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.ssaoPass.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  render(): void {
    if (this.active) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this.bloomPass.dispose();
    this.ssaoPass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
  }
}
