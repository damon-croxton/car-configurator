import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CameraPreset, CarConfig } from '../types';
import { buildMx5CarMesh } from './Mx5Model3D';

interface RenderViewportProps {
  config: CarConfig;
  selectedCamera: CameraPreset;
  onCameraChange?: (cam: CameraPreset) => void;
  onTakeSnapshot?: () => void;
  setSnapshotCanvasRef?: (canvas: HTMLCanvasElement | null) => void;
}

export const RenderViewport: React.FC<RenderViewportProps> = ({
  config,
  selectedCamera,
  setSnapshotCanvasRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.4, 0));
  const currentCamPos = useRef<THREE.Vector3>(new THREE.Vector3(3.2, 1.4, 3.8));

  const carGroupRef = useRef<THREE.Group | null>(null);
  const wheelsRef = useRef<THREE.Group[]>([]);
  const headlightsRef = useRef<THREE.SpotLight[]>([]);

  const [fps, setFps] = useState(60);

  // Register canvas ref for snapshot capture
  useEffect(() => {
    if (setSnapshotCanvasRef && canvasRef.current) {
      setSnapshotCanvasRef(canvasRef.current);
    }
  }, [setSnapshotCanvasRef]);

  // Set Camera Position from Presets
  useEffect(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;

    let targetPos = new THREE.Vector3(3.2, 1.4, 3.8);
    let targetLook = new THREE.Vector3(0, 0.35, 0);

    switch (selectedCamera) {
      case 'hero_34':
        targetPos = new THREE.Vector3(3.2, 1.3, 3.6);
        targetLook = new THREE.Vector3(0, 0.3, 0);
        break;
      case 'side':
        targetPos = new THREE.Vector3(4.2, 0.9, 0);
        targetLook = new THREE.Vector3(0, 0.3, 0);
        break;
      case 'rear_34':
        targetPos = new THREE.Vector3(3.2, 1.2, -3.6);
        targetLook = new THREE.Vector3(0, 0.3, 0);
        break;
      case 'front':
        targetPos = new THREE.Vector3(0, 0.8, 3.8);
        targetLook = new THREE.Vector3(0, 0.25, 0);
        break;
      case 'top':
        targetPos = new THREE.Vector3(0.1, 4.8, 0.1);
        targetLook = new THREE.Vector3(0, 0, 0);
        break;
      case 'low_stance':
        targetPos = new THREE.Vector3(2.6, 0.4, 2.8);
        targetLook = new THREE.Vector3(0, 0.2, 0);
        break;
      case 'cockpit':
        targetPos = new THREE.Vector3(-0.3, 1.1, 0.2);
        targetLook = new THREE.Vector3(-0.2, 0.6, -0.8);
        break;
    }

    currentCamPos.current.copy(targetPos);
    cameraTarget.current.copy(targetLook);
    cam.position.copy(targetPos);
    cam.lookAt(targetLook);
  }, [selectedCamera]);

  // Init Three.js Scene Environment
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(3.2, 1.3, 3.6);
    camera.lookAt(0, 0.3, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antenna: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
      alpha: true,
    } as THREE.WebGLRendererParameters);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = config.studioExposure;

    container.appendChild(renderer.domElement);
    canvasRef.current = renderer.domElement;
    rendererRef.current = renderer;

    // Mouse Interaction for Custom Orbit Controls
    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !cameraRef.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      const cam = cameraRef.current;
      const offset = cam.position.clone().sub(cameraTarget.current);

      // Rotate around Y and X axis
      const theta = Math.atan2(offset.x, offset.z);
      const phi = Math.atan2(Math.sqrt(offset.x * offset.x + offset.z * offset.z), offset.y);

      const newTheta = theta - deltaX * 0.008;
      const newPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi - deltaY * 0.008));

      const radius = offset.length();
      cam.position.x = cameraTarget.current.x + radius * Math.sin(newPhi) * Math.sin(newTheta);
      cam.position.y = cameraTarget.current.y + radius * Math.cos(newPhi);
      cam.position.z = cameraTarget.current.z + radius * Math.sin(newPhi) * Math.cos(newTheta);

      cam.lookAt(cameraTarget.current);
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (!cameraRef.current) return;
      e.preventDefault();
      const cam = cameraRef.current;
      const offset = cam.position.clone().sub(cameraTarget.current);
      const factor = e.deltaY > 0 ? 1.08 : 0.92;
      const newLen = THREE.MathUtils.clamp(offset.length() * factor, 1.8, 8.5);
      offset.setLength(newLen);
      cam.position.copy(cameraTarget.current).add(offset);
      cam.lookAt(cameraTarget.current);
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    // Handle Resize
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // FPS Counter & Render Loop
    let lastTime = performance.now();
    let frameCount = 0;
    let animId: number;

    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);

      // Rotate wheels if wheelsRotating is true
      if (wheelsRef.current.length > 0 && config.wheelsRotating) {
        wheelsRef.current.forEach((w) => {
          if (w) w.rotation.x += 0.12;
        });
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Environment Lighting & Floor Reflection
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;
    const scene = sceneRef.current;

    // Clear previous lights & floor meshes
    scene.children = scene.children.filter(
      (c) => c.name === 'car-root-group' || c.name === 'car-headlight-spot'
    );

    // Set Background Color & Fog based on environment
    let bgHex = '#0c0e12';
    let fogDensity = 0.08;

    if (config.environment === 'golden_hour') bgHex = '#1c1917';
    else if (config.environment === 'clean_white') { bgHex = '#f8fafc'; fogDensity = 0.02; }
    else if (config.environment === 'cyber_neon') bgHex = '#050508';
    else if (config.environment === 'tokyo_night') bgHex = '#090a16';
    else if (config.environment === 'sunset_coast') bgHex = '#180f1d';
    else if (config.environment === 'industrial_warehouse') bgHex = '#0f1117';
    else if (config.environment === 'desert_salt_flats') { bgHex = '#e2e8f0'; fogDensity = 0.015; }
    else if (config.environment === 'alpine_pass') { bgHex = '#0f172a'; fogDensity = 0.04; }

    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, fogDensity);

    // Main Studio Ambient Lighting
    let ambientHex = '#ffffff';
    let ambientIntensity = 0.8;

    if (config.environment === 'golden_hour') { ambientHex = '#fdba74'; ambientIntensity = 1.0; }
    else if (config.environment === 'clean_white') { ambientHex = '#ffffff'; ambientIntensity = 1.8; }
    else if (config.environment === 'tokyo_night') { ambientHex = '#8b5cf6'; ambientIntensity = 0.9; }
    else if (config.environment === 'sunset_coast') { ambientHex = '#fb923c'; ambientIntensity = 1.1; }
    else if (config.environment === 'industrial_warehouse') { ambientHex = '#fde047'; ambientIntensity = 0.7; }
    else if (config.environment === 'desert_salt_flats') { ambientHex = '#f8fafc'; ambientIntensity = 2.0; }
    else if (config.environment === 'alpine_pass') { ambientHex = '#38bdf8'; ambientIntensity = 1.2; }

    const ambientLight = new THREE.AmbientLight(ambientHex, ambientIntensity);
    scene.add(ambientLight);

    // Directional Key Light
    let keyHex = '#ffffff';
    let keyIntensity = 2.8;

    if (config.environment === 'golden_hour') { keyHex = '#f97316'; keyIntensity = 3.2; }
    else if (config.environment === 'tokyo_night') { keyHex = '#0284c7'; keyIntensity = 2.2; }
    else if (config.environment === 'sunset_coast') { keyHex = '#ea580c'; keyIntensity = 3.5; }
    else if (config.environment === 'industrial_warehouse') { keyHex = '#facc15'; keyIntensity = 3.0; }
    else if (config.environment === 'desert_salt_flats') { keyHex = '#ffffff'; keyIntensity = 3.6; }
    else if (config.environment === 'alpine_pass') { keyHex = '#e0f2fe'; keyIntensity = 3.0; }

    const keyLight = new THREE.DirectionalLight(keyHex, keyIntensity);
    keyLight.position.set(5, 8, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    // Soft Rim Fill Light
    const rimLight = new THREE.DirectionalLight('#e0f2fe', 1.6);
    rimLight.position.set(-6, 5, -5);
    scene.add(rimLight);

    // Environmental Spotlights for specific themes
    if (config.environment === 'cyber_neon') {
      const cyanSpot = new THREE.SpotLight('#06b6d4', 6.0, 18, Math.PI / 4, 0.5);
      cyanSpot.position.set(-4, 3, 3);
      scene.add(cyanSpot);

      const magentaSpot = new THREE.SpotLight('#ec4899', 6.0, 18, Math.PI / 4, 0.5);
      magentaSpot.position.set(4, 3, -3);
      scene.add(magentaSpot);
    } else if (config.environment === 'tokyo_night') {
      const purpleSpot = new THREE.SpotLight('#a855f7', 5.0, 16, Math.PI / 4, 0.5);
      purpleSpot.position.set(-5, 4, 2);
      scene.add(purpleSpot);

      const blueSpot = new THREE.SpotLight('#0284c7', 5.0, 16, Math.PI / 4, 0.5);
      blueSpot.position.set(5, 4, -2);
      scene.add(blueSpot);
    } else if (config.environment === 'industrial_warehouse') {
      const halogen1 = new THREE.SpotLight('#fef08a', 5.0, 15, Math.PI / 3, 0.3);
      halogen1.position.set(0, 7, 0);
      scene.add(halogen1);
    }

    // Studio Floor Ground Plane
    const floorGeo = new THREE.PlaneGeometry(35, 35);
    let floorColorHex = '#0a0c10';
    if (config.environment === 'clean_white') floorColorHex = '#f1f5f9';
    if (config.environment === 'desert_salt_flats') floorColorHex = '#f8fafc';
    if (config.environment === 'industrial_warehouse') floorColorHex = '#1e293b';

    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColorHex,
      roughness: 1.0 - config.floorReflection * 0.7,
      metalness: 0.15 + config.floorReflection * 0.5,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Studio Grid Overlay
    let grid1 = '#334155';
    let grid2 = '#1e293b';
    if (config.environment === 'cyber_neon') { grid1 = '#06b6d4'; grid2 = '#ec4899'; }
    if (config.environment === 'tokyo_night') { grid1 = '#8b5cf6'; grid2 = '#0284c7'; }
    if (config.environment === 'clean_white') { grid1 = '#cbd5e1'; grid2 = '#e2e8f0'; }
    if (config.environment === 'desert_salt_flats') { grid1 = '#94a3b8'; grid2 = '#cbd5e1'; }

    const gridHelper = new THREE.GridHelper(20, 30, grid1, grid2);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    rendererRef.current.toneMappingExposure = config.studioExposure;
  }, [config.environment, config.floorReflection, config.studioExposure]);

  // Build & Update Car Model Mesh
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove old car group & headlight spotlights
    if (carGroupRef.current) {
      scene.remove(carGroupRef.current);
    }
    headlightsRef.current.forEach((hl) => {
      scene.remove(hl);
      if (hl.target) scene.remove(hl.target);
    });

    // Build new car mesh
    const { carGroup, wheels, headlightLights } = buildMx5CarMesh(config);
    carGroup.name = 'car-root-group';
    scene.add(carGroup);

    carGroupRef.current = carGroup;
    wheelsRef.current = wheels;

    headlightLights.forEach((hl) => {
      hl.name = 'car-headlight-spot';
      scene.add(hl);
      if (hl.target) scene.add(hl.target);
    });
    headlightsRef.current = headlightLights;

    return () => {
      scene.remove(carGroup);
      headlightLights.forEach((hl) => {
        scene.remove(hl);
        if (hl.target) scene.remove(hl.target);
      });
    };
  }, [config]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Viewport Overlay Controls & Badges */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-slate-300 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>REAL-TIME 3D RENDER</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{fps} FPS</span>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 shadow-xl hidden sm:flex items-center gap-1.5">
          <span className="text-slate-400">Environment:</span>
          <span className="capitalize text-amber-400">{config.environment.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Drag Orbit Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-slate-800/80 text-xs text-slate-400 shadow-lg">
        <span>Click & drag to rotate 360°</span>
        <span className="text-slate-600">•</span>
        <span>Scroll to zoom</span>
      </div>
    </div>
  );
};

