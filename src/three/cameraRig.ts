import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import type { CameraPresetDef } from '../data/schema';

/**
 * Orbit camera with damping plus tweened preset transitions.
 *
 * The floor clamp (`maxPolarAngle`) keeps the camera above the ground plane so
 * you can never orbit under the car and see through the grid — except for the
 * cockpit preset, which deliberately relaxes the distance limits.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private tween: gsap.core.Timeline | null = null;
  private autoRotateSpeed = 0.6;

  constructor(domElement: HTMLElement, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(36, aspect, 0.08, 200);
    this.camera.position.set(4.6, 1.55, 5.0);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.5;
    this.controls.enablePan = true;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 14;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.035;
    this.controls.target.set(0, 0.62, 0);
    this.controls.update();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = this.autoRotateSpeed;
  }

  setAutoRotateSpeed(speed: number): void {
    this.autoRotateSpeed = speed;
    this.controls.autoRotateSpeed = speed;
  }

  /** Smoothly fly to a preset. Interrupting mid-flight is safe. */
  goTo(preset: CameraPresetDef, duration = 1.15): void {
    this.tween?.kill();

    const target = new THREE.Vector3().fromArray(preset.target);
    const position = new THREE.Vector3().fromArray(preset.position);

    // Widen the limits for the duration of the flight so a tight interior
    // preset can pass through what the previous preset's clamp disallowed.
    this.controls.minDistance = Math.min(this.controls.minDistance, preset.minDistance);
    this.controls.maxDistance = Math.max(this.controls.maxDistance, preset.maxDistance);

    const state = {
      px: this.camera.position.x,
      py: this.camera.position.y,
      pz: this.camera.position.z,
      tx: this.controls.target.x,
      ty: this.controls.target.y,
      tz: this.controls.target.z,
      fov: this.camera.fov,
    };

    this.tween = gsap
      .timeline({
        onUpdate: () => {
          this.camera.position.set(state.px, state.py, state.pz);
          this.controls.target.set(state.tx, state.ty, state.tz);
          this.camera.fov = state.fov;
          this.camera.updateProjectionMatrix();
        },
        onComplete: () => {
          this.controls.minDistance = preset.minDistance;
          this.controls.maxDistance = preset.maxDistance;
          this.tween = null;
        },
      })
      .to(state, {
        px: position.x,
        py: position.y,
        pz: position.z,
        tx: target.x,
        ty: target.y,
        tz: target.z,
        fov: preset.fov,
        duration,
        ease: 'power3.inOut',
      });
  }

  /** Jump instantly — used on first paint and when restoring a shared link. */
  snapTo(preset: CameraPresetDef): void {
    this.tween?.kill();
    this.tween = null;
    this.camera.position.fromArray(preset.position);
    this.controls.target.fromArray(preset.target);
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = preset.minDistance;
    this.controls.maxDistance = preset.maxDistance;
    this.controls.update();
  }

  update(): void {
    this.controls.update();
  }

  dispose(): void {
    this.tween?.kill();
    this.controls.dispose();
  }
}
