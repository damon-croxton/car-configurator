import React from 'react';
import * as THREE from 'three';
import { CarConfig, WheelStyle } from '../types';

export interface CarBuildResult {
  carGroup: THREE.Group;
  wheels: THREE.Group[];
  headlightLights: THREE.SpotLight[];
}

export function buildMx5CarMesh(config: CarConfig): CarBuildResult {
  const carGroup = new THREE.Group();
  const wheels: THREE.Group[] = [];
  const headlightLights: THREE.SpotLight[] = [];

  // ---------------------------------------------------------
  // 1. MATERIALS DEFINITION
  // ---------------------------------------------------------
  
  // Paint Material (Calibrated for vibrant base colors without dark red tinting)
  const paintColor = new THREE.Color(config.paintColor);
  let roughness = 0.18;
  let metalness = 0.2;
  let clearcoat = 1.0;
  let clearcoatRoughness = 0.05;

  if (config.paintFinish === 'metallic') {
    metalness = 0.35;
    roughness = 0.16;
  } else if (config.paintFinish === 'pearl') {
    metalness = 0.25;
    roughness = 0.15;
  } else if (config.paintFinish === 'matte') {
    metalness = 0.05;
    roughness = 0.7;
    clearcoat = 0.0;
  } else if (config.paintFinish === 'chrome') {
    metalness = 0.95;
    roughness = 0.04;
    clearcoat = 1.0;
  }

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: paintColor,
    roughness: roughness,
    metalness: metalness,
    clearcoat: clearcoat * config.clearcoatGloss,
    clearcoatRoughness: clearcoatRoughness,
    reflectivity: 0.9,
  });

  // Carbon Fiber Material
  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#1a1a1e',
    roughness: 0.35,
    metalness: 0.7,
  });

  // Dark Plastic Trim Material
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#111215',
    roughness: 0.6,
    metalness: 0.2,
  });

  // Glass Material
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    roughness: 0.05,
    metalness: 0.9,
    transparent: true,
    opacity: Math.min(0.92, 0.65 + config.windowTint * 0.3),
    reflectivity: 1.0,
  });

  // Interior Seat Material
  let seatColorHex = '#18181b';
  if (config.interiorColor === 'tan_nappa') seatColorHex = '#78350f';
  if (config.interiorColor === 'red_alcantara') seatColorHex = '#991b1b';
  if (config.interiorColor === 'recaro_bucket') seatColorHex = '#09090b';
  const seatMat = new THREE.MeshStandardMaterial({
    color: seatColorHex,
    roughness: 0.65,
    metalness: 0.1,
  });

  // ---------------------------------------------------------
  // 2. CHASSIS ROOT (Suspension Drop applied here)
  // ---------------------------------------------------------
  const bodyRoot = new THREE.Group();
  bodyRoot.position.set(0, 0.42 - config.suspensionDrop * 0.18, 0);
  carGroup.add(bodyRoot);

  // --- Smooth Organic Main Body Fuselage (Lower Mid Belly) ---
  const bellyGeo = new THREE.CylinderGeometry(0.78, 0.76, 3.6, 24, 1);
  bellyGeo.scale(1.0, 0.36, 1.0);
  const bellyMesh = new THREE.Mesh(bellyGeo, paintMat);
  bellyMesh.rotation.x = Math.PI / 2;
  bellyMesh.position.set(0, 0.26, 0);
  bellyMesh.castShadow = true;
  bellyMesh.receiveShadow = true;
  bodyRoot.add(bellyMesh);

  // --- Sleek Side Door Sills & Character Lines ---
  const sideLGeo = new THREE.CylinderGeometry(0.22, 0.2, 2.4, 16);
  sideLGeo.scale(0.5, 1.0, 1.0);
  const sideL = new THREE.Mesh(sideLGeo, paintMat);
  sideL.rotation.x = Math.PI / 2;
  sideL.position.set(-0.76, 0.28, 0);
  sideL.castShadow = true;

  const sideR = new THREE.Mesh(sideLGeo, paintMat);
  sideR.rotation.x = Math.PI / 2;
  sideR.position.set(0.76, 0.28, 0);
  sideR.castShadow = true;

  bodyRoot.add(sideL, sideR);

  // --- Front Nose & Kodo Curved Hood ---
  // Hood shape extrude for smooth curved bonnet
  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(-0.7, -0.7);
  hoodShape.quadraticCurveTo(-0.72, 0, -0.68, 0.7);
  hoodShape.quadraticCurveTo(0, 0.78, 0.68, 0.7);
  hoodShape.quadraticCurveTo(0.72, 0, 0.7, -0.7);
  hoodShape.quadraticCurveTo(0, -0.68, -0.7, -0.7);

  const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.06, bevelThickness: 0.04 };
  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, extrudeSettings);
  hoodGeo.scale(0.98, 0.98, 1.0);

  const hoodMat = config.hoodStyle === 'carbon_vented' ? carbonMat : paintMat;
  const hoodMesh = new THREE.Mesh(hoodGeo, hoodMat);
  hoodMesh.rotation.x = -Math.PI / 2 - 0.08;
  hoodMesh.position.set(0, 0.38, 0.95);
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  bodyRoot.add(hoodMesh);

  // Hood Power Bulge Crease Line
  const bulgeGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.2, 16);
  bulgeGeo.scale(1.0, 0.15, 1.0);
  const bulge = new THREE.Mesh(bulgeGeo, hoodMat);
  bulge.rotation.x = Math.PI / 2 - 0.08;
  bulge.position.set(0, 0.42, 1.0);
  bodyRoot.add(bulge);

  // Hood Vents if carbon_vented
  if (config.hoodStyle === 'carbon_vented') {
    const ventMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.9 });
    const ventL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.4), ventMat);
    ventL.position.set(-0.32, 0.43, 1.05);
    ventL.rotation.x = -0.08;
    const ventR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.4), ventMat);
    ventR.position.set(0.32, 0.43, 1.05);
    ventR.rotation.x = -0.08;
    bodyRoot.add(ventL, ventR);
  }

  // --- Front Bumper & Mazda Kodo Pentagon Grille ---
  const noseConeGeo = new THREE.CylinderGeometry(0.72, 0.65, 0.55, 24);
  noseConeGeo.scale(1.04, 0.5, 0.8);
  const noseCone = new THREE.Mesh(noseConeGeo, paintMat);
  noseCone.rotation.x = Math.PI / 2 - 0.15;
  noseCone.position.set(0, 0.24, 1.72);
  noseCone.castShadow = true;
  bodyRoot.add(noseCone);

  // Signature Pentagonal Front Grille
  const grilleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.22, 0.08),
    new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.85, metalness: 0.2 })
  );
  grilleMesh.position.set(0, 0.18, 1.96);
  grilleMesh.rotation.x = -0.05;
  bodyRoot.add(grilleMesh);

  // Mazda Emblem Badge (Chrome Ring)
  const emblemRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.012, 12, 24),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 })
  );
  emblemRing.position.set(0, 0.29, 1.97);
  bodyRoot.add(emblemRing);

  // --- Sculpted Fender Arches (Front & Rear) ---
  const makeFender = (x: number, z: number, r1: number, r2: number, len: number) => {
    const fGeo = new THREE.CylinderGeometry(r1, r2, len, 24);
    fGeo.scale(0.55, 1.0, 1.0);
    const fMesh = new THREE.Mesh(fGeo, paintMat);
    fMesh.rotation.z = Math.PI / 2;
    fMesh.position.set(x, 0.32, z);
    fMesh.castShadow = true;
    fMesh.receiveShadow = true;
    return fMesh;
  };

  bodyRoot.add(makeFender(-0.76, 1.12, 0.38, 0.4, 0.22)); // FL
  bodyRoot.add(makeFender(0.76, 1.12, 0.38, 0.4, 0.22));  // FR
  bodyRoot.add(makeFender(-0.76, -1.12, 0.4, 0.42, 0.24)); // RL
  bodyRoot.add(makeFender(0.76, -1.12, 0.4, 0.42, 0.24));  // RR

  // --- Curved Rear Deck & Tail Bumper ---
  const rearDeckGeo = new THREE.CylinderGeometry(0.74, 0.68, 0.7, 24);
  rearDeckGeo.scale(1.02, 0.52, 0.85);
  const rearDeck = new THREE.Mesh(rearDeckGeo, paintMat);
  rearDeck.rotation.x = Math.PI / 2 + 0.1;
  rearDeck.position.set(0, 0.32, -1.58);
  rearDeck.castShadow = true;
  bodyRoot.add(rearDeck);

  // --- Sleek Side Mirrors ---
  const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.05, metalness: 0.95 });
  [-0.82, 0.82].forEach((xPos) => {
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(xPos, 0.52, 0.45);

    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.12), trimMat);
    stem.position.set(xPos > 0 ? -0.04 : 0.04, -0.04, 0);
    mirrorGroup.add(stem);

    // Aero Housing
    const housingGeo = new THREE.SphereGeometry(0.09, 16, 12);
    housingGeo.scale(1.4, 0.8, 1.0);
    const housing = new THREE.Mesh(housingGeo, paintMat);
    housing.castShadow = true;

    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.12), mirrorGlassMat);
    glass.position.set(xPos > 0 ? -0.07 : 0.07, 0, 0);

    mirrorGroup.add(housing, glass);
    bodyRoot.add(mirrorGroup);
  });

  // --- Curved Windshield & A-Pillars ---
  const windshieldGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.48, 20, 1, false, -Math.PI / 3, (2 * Math.PI) / 3);
  windshieldGeo.scale(1.0, 0.05, 1.0);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0, 0.62, 0.38);
  windshield.rotation.x = 0.52;
  bodyRoot.add(windshield);

  const pillarMat = new THREE.MeshStandardMaterial({ color: '#111215', roughness: 0.3, metalness: 0.5 });
  const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.52), pillarMat);
  pillarL.position.set(-0.64, 0.62, 0.38);
  pillarL.rotation.set(0.5, 0, -0.15);

  const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.52), pillarMat);
  pillarR.position.set(0.64, 0.62, 0.38);
  pillarR.rotation.set(0.5, 0, 0.15);

  bodyRoot.add(pillarL, pillarR);

  // ---------------------------------------------------------
  // 3. LIGHTING (Sleek LED Headlights & Teardrop Taillights)
  // ---------------------------------------------------------
  const headColor = config.headlightsOn ? '#f0f9ff' : '#1e293b';
  const headEmissive = config.headlightsOn ? '#38bdf8' : '#000000';
  const tailColor = config.taillightsOn ? '#ff1744' : '#450a0a';
  const tailEmissive = config.taillightsOn ? '#ef4444' : '#000000';

  const headMat = new THREE.MeshStandardMaterial({
    color: headColor,
    emissive: headEmissive,
    emissiveIntensity: config.headlightsOn ? 3.0 : 0,
    roughness: 0.1,
  });

  // Sleek Angled Headlight Housings with Projector Lenses
  [-0.58, 0.58].forEach((xPos) => {
    const hlGroup = new THREE.Group();
    hlGroup.position.set(xPos, 0.32, 1.88);
    hlGroup.rotation.set(-0.1, xPos > 0 ? 0.2 : -0.2, 0);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.12), headMat);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 16),
      new THREE.MeshBasicMaterial({ color: config.headlightsOn ? '#ffffff' : '#475569' })
    );
    lens.position.set(0, 0, 0.05);
    hlGroup.add(housing, lens);
    bodyRoot.add(hlGroup);
  });

  if (config.headlightsOn) {
    const spotL = new THREE.SpotLight('#f0f9ff', 6.0, 16, Math.PI / 5, 0.4);
    spotL.position.set(-0.58, 0.74 - config.suspensionDrop * 0.18, 1.88);
    spotL.target.position.set(-0.58, 0, 8);
    headlightLights.push(spotL);

    const spotR = new THREE.SpotLight('#f0f9ff', 6.0, 16, Math.PI / 5, 0.4);
    spotR.position.set(0.58, 0.74 - config.suspensionDrop * 0.18, 1.88);
    spotR.target.position.set(0.58, 0, 8);
    headlightLights.push(spotR);
  }

  if (config.drlGlow) {
    const drlMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    const drlL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.02), drlMat);
    drlL.position.set(-0.58, 0.22, 1.94);
    const drlR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.02), drlMat);
    drlR.position.set(0.58, 0.22, 1.94);
    bodyRoot.add(drlL, drlR);
  }

  // Teardrop Taillights
  const tailMat = new THREE.MeshStandardMaterial({
    color: tailColor,
    emissive: tailEmissive,
    emissiveIntensity: config.taillightsOn ? 3.5 : 0,
    roughness: 0.1,
  });

  [-0.58, 0.58].forEach((xPos) => {
    const tailGroup = new THREE.Group();
    tailGroup.position.set(xPos, 0.38, -1.88);
    tailGroup.rotation.y = xPos > 0 ? -0.15 : 0.15;

    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), tailMat);
    outer.rotation.x = Math.PI / 2;

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.01, 12, 24),
      new THREE.MeshBasicMaterial({ color: config.taillightsOn ? '#ff1744' : '#450a0a' })
    );
    innerRing.position.z = -0.04;

    tailGroup.add(outer, innerRing);
    bodyRoot.add(tailGroup);
  });

  // ---------------------------------------------------------
  // 4. ROOF SYSTEM (Soft top open/closed & RF Hardtop)
  // ---------------------------------------------------------
  let roofCanvasHex = '#1a1a1a';
  if (config.roofColor === 'tan') roofCanvasHex = '#78350f';
  if (config.roofColor === 'cherry') roofCanvasHex = '#881337';
  const roofCanvasMat = new THREE.MeshStandardMaterial({
    color: roofCanvasHex,
    roughness: 0.85,
    metalness: 0.1,
  });

  const rfBodyMat = new THREE.MeshPhysicalMaterial({
    color: config.roofColor === 'black' ? '#111215' : config.paintColor,
    roughness: config.roofColor === 'black' ? 0.3 : roughness,
    metalness: config.roofColor === 'black' ? 0.3 : metalness,
    clearcoat: config.roofColor === 'black' ? 0.5 : clearcoat,
  });

  if (config.roofType === 'softtop_open') {
    const openDeckGeo = new THREE.CylinderGeometry(0.62, 0.65, 0.32, 20);
    openDeckGeo.scale(1.0, 0.25, 0.7);
    const openDeck = new THREE.Mesh(openDeckGeo, roofCanvasMat);
    openDeck.position.set(0, 0.46, -0.62);
    openDeck.castShadow = true;
    bodyRoot.add(openDeck);
  } else if (config.roofType === 'softtop_closed') {
    const closedRoofGroup = new THREE.Group();
    closedRoofGroup.position.set(0, 0.72, -0.22);

    const canopyGeo = new THREE.SphereGeometry(0.68, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.2);
    canopyGeo.scale(1.02, 0.42, 1.2);
    const canopy = new THREE.Mesh(canopyGeo, roofCanvasMat);
    canopy.castShadow = true;

    const rearWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.18, 0.02),
      new THREE.MeshStandardMaterial({ color: '#0a0f1d', roughness: 0.05, metalness: 0.9 })
    );
    rearWindow.position.set(0, -0.04, -0.52);
    rearWindow.rotation.x = -0.32;

    closedRoofGroup.add(canopy, rearWindow);
    bodyRoot.add(closedRoofGroup);
  } else if (config.roofType === 'rf_hardtop') {
    const rfGroup = new THREE.Group();
    rfGroup.position.set(0, 0.74, -0.25);

    const rfPanelGeo = new THREE.SphereGeometry(0.69, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.3);
    rfPanelGeo.scale(1.02, 0.4, 1.1);
    const rfPanel = new THREE.Mesh(rfPanelGeo, rfBodyMat);
    rfPanel.castShadow = true;

    const buttressL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.38), rfBodyMat);
    buttressL.position.set(-0.58, -0.12, -0.48);
    buttressL.rotation.x = -0.45;
    buttressL.castShadow = true;

    const buttressR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.38), rfBodyMat);
    buttressR.position.set(0.58, -0.12, -0.48);
    buttressR.rotation.x = -0.45;
    buttressR.castShadow = true;

    const targaGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.24, 0.02),
      new THREE.MeshStandardMaterial({ color: '#0a0f1d', roughness: 0.05, metalness: 0.9 })
    );
    targaGlass.position.set(0, -0.05, -0.48);
    targaGlass.rotation.x = -0.5;

    rfGroup.add(rfPanel, buttressL, buttressR, targaGlass);
    bodyRoot.add(rfGroup);
  }

  // ---------------------------------------------------------
  // 5. INTERIOR COCKPIT
  // ---------------------------------------------------------
  const interiorGroup = new THREE.Group();
  interiorGroup.position.set(0, 0.38, -0.1);

  // Dash & Instrument Binnacle
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.18, 0.38),
    new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.7 })
  );
  dash.position.set(0, 0.12, 0.32);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.12, 0.02),
    new THREE.MeshBasicMaterial({ color: '#0284c7' })
  );
  screen.position.set(0, 0.24, 0.28);
  screen.rotation.x = -0.15;

  // Steering Wheel
  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.018, 12, 24),
    new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.4 })
  );
  wheelRim.position.set(-0.32, 0.22, 0.18);
  wheelRim.rotation.x = 0.3;

  interiorGroup.add(dash, screen, wheelRim);

  // Bucket Seats
  [-0.34, 0.34].forEach((xPos) => {
    const seatGroup = new THREE.Group();
    seatGroup.position.set(xPos, 0.08, -0.18);

    const baseGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.42, 16);
    baseGeo.scale(0.85, 1.0, 1.0);
    const base = new THREE.Mesh(baseGeo, seatMat);
    base.rotation.x = 0.15;
    base.castShadow = true;

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.1), seatMat);
    headrest.position.set(0, 0.32, -0.08);
    headrest.castShadow = true;

    seatGroup.add(base, headrest);
    interiorGroup.add(seatGroup);
  });

  // Roll Hoops
  const hoopMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.85, roughness: 0.2 });
  [-0.34, 0.34].forEach((xPos) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 12, 24, Math.PI), hoopMat);
    hoop.position.set(xPos, 0.36, -0.42);
    hoop.castShadow = true;
    interiorGroup.add(hoop);
  });

  // Acrylic Wind Deflector
  const windDeflector = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.01),
    new THREE.MeshStandardMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.35 })
  );
  windDeflector.position.set(0, 0.36, -0.42);
  interiorGroup.add(windDeflector);

  bodyRoot.add(interiorGroup);

  // ---------------------------------------------------------
  // 6. FRONT LIP / AERO
  // ---------------------------------------------------------
  if (config.frontLip !== 'stock') {
    const lipGroup = new THREE.Group();
    lipGroup.position.set(0, 0.05, 1.92);

    if (config.frontLip === 'mazdaspeed') {
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(1.54, 0.05, 0.22),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.3 })
      );
      lip.castShadow = true;
      lipGroup.add(lip);
    } else if (config.frontLip === 'apr_carbon') {
      const splitterBlade = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.025, 0.36), carbonMat);
      splitterBlade.castShadow = true;

      const rodMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', metalness: 0.95 });
      const rodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), rodMat);
      rodL.position.set(-0.35, 0.08, 0.12);
      rodL.rotation.x = 0.3;

      const rodR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), rodMat);
      rodR.position.set(0.35, 0.08, 0.12);
      rodR.rotation.x = 0.3;

      lipGroup.add(splitterBlade, rodL, rodR);
    } else if (config.frontLip === 'leg_motorsport') {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.28), paintMat);
      lip.castShadow = true;
      lipGroup.add(lip);
    }
    bodyRoot.add(lipGroup);
  }

  // ---------------------------------------------------------
  // 7. SIDE SKIRTS
  // ---------------------------------------------------------
  if (config.sideSkirts !== 'stock') {
    const skirtMat = config.sideSkirts === 'carbon_extenders' ? carbonMat : trimMat;
    const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 2.2), skirtMat);
    skirtL.position.set(-0.78, 0.08, 0);
    skirtL.castShadow = true;

    const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 2.2), skirtMat);
    skirtR.position.set(0.78, 0.08, 0);
    skirtR.castShadow = true;

    bodyRoot.add(skirtL, skirtR);
  }

  // ---------------------------------------------------------
  // 8. REAR DIFFUSER & EXHAUST
  // ---------------------------------------------------------
  const rearDiffGroup = new THREE.Group();
  rearDiffGroup.position.set(0, 0.08, -1.86);

  const diffuserBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.38, 0.09, 0.28),
    new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.8 })
  );
  rearDiffGroup.add(diffuserBase);

  const chromeTipMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.98, roughness: 0.1 });
  const titaniumTipMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.9, roughness: 0.1 });

  if (config.exhaustStyle === 'stock_single') {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 16), chromeTipMat);
    tip.position.set(0.38, 0.04, -0.08);
    tip.rotation.x = Math.PI / 2;
    rearDiffGroup.add(tip);
  } else if (config.exhaustStyle === 'oem_dual') {
    [-0.38, -0.28].forEach((posX) => {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.18, 16), chromeTipMat);
      tip.position.set(posX, 0.04, -0.08);
      tip.rotation.x = Math.PI / 2;
      rearDiffGroup.add(tip);
    });
  } else if (config.exhaustStyle === 'titanium_quad') {
    [-0.48, -0.37, 0.37, 0.48].forEach((posX) => {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 16), titaniumTipMat);
      tip.position.set(posX, 0.04, -0.08);
      tip.rotation.x = Math.PI / 2;
      rearDiffGroup.add(tip);
    });
  } else if (config.exhaustStyle === 'tomei_single_big') {
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.28, 20),
      new THREE.MeshStandardMaterial({ color: '#60a5fa', metalness: 0.95, roughness: 0.08 })
    );
    tip.position.set(0.42, 0.04, -0.1);
    tip.rotation.set(Math.PI / 2, 0.15, 0);
    rearDiffGroup.add(tip);
  }

  bodyRoot.add(rearDiffGroup);

  // ---------------------------------------------------------
  // 9. REAR SPOILER / GT WING
  // ---------------------------------------------------------
  if (config.spoilerStyle !== 'none') {
    const spoilerGroup = new THREE.Group();
    spoilerGroup.position.set(0, 0.58, -1.78);

    if (config.spoilerStyle === 'oem_ducktail') {
      const ducktail = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.05, 0.14), paintMat);
      ducktail.castShadow = true;
      spoilerGroup.add(ducktail);
    } else if (config.spoilerStyle === 'carbon_lip') {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.045, 0.18), carbonMat);
      lip.castShadow = true;
      spoilerGroup.add(lip);
    } else if (config.spoilerStyle === 'voltex_gt_wing') {
      const wing = new THREE.Group();
      wing.position.set(0, 0.2, 0);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.028, 0.32), carbonMat);
      blade.position.set(0, 0.12, 0);
      blade.rotation.x = -0.05;
      blade.castShadow = true;

      const endplateL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.36), carbonMat);
      endplateL.position.set(-0.83, 0.12, 0);
      const endplateR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.36), carbonMat);
      endplateR.position.set(0.83, 0.12, 0);

      const mountMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9 });
      const mountL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.12), mountMat);
      mountL.position.set(-0.42, 0, 0);
      const mountR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.12), mountMat);
      mountR.position.set(0.42, 0, 0);

      wing.add(blade, endplateL, endplateR, mountL, mountR);
      spoilerGroup.add(wing);
    }
    bodyRoot.add(spoilerGroup);
  }

  // ---------------------------------------------------------
  // 10. LICENSE PLATE
  // ---------------------------------------------------------
  const plateGroup = new THREE.Group();
  plateGroup.position.set(0, 0.22, -1.95);
  const plateMat = new THREE.MeshStandardMaterial({
    color: config.licensePlateStyle === 'black_gold' ? '#09090b' : '#f8fafc',
    roughness: 0.4,
  });
  const plateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.01), plateMat);
  plateGroup.add(plateMesh);
  bodyRoot.add(plateGroup);

  // ---------------------------------------------------------
  // 11. WHEELS & SUSPENSION ASSEMBLY
  // ---------------------------------------------------------
  const wheelsLayer = new THREE.Group();
  wheelsLayer.name = 'wheels-layer';
  carGroup.add(wheelsLayer);

  const wheelFinishColorHex = getWheelFinishColorHex(config);
  const spacerOffset = config.wheelSpacerOffset * 0.08;
  const wheelRadius = 0.35 * config.wheelSizeRatio;
  const camberRad = (config.camberAngle * Math.PI) / 180;

  const wheelPositions: [number, number, number, boolean][] = [
    [-0.78 - spacerOffset, wheelRadius, 1.12, true],  // FL
    [0.78 + spacerOffset, wheelRadius, 1.12, false],  // FR
    [-0.78 - spacerOffset, wheelRadius, -1.12, true], // RL
    [0.78 + spacerOffset, wheelRadius, -1.12, false], // RR
  ];

  wheelPositions.forEach(([x, y, z, isLeft]) => {
    const wheelStationGroup = new THREE.Group();
    wheelStationGroup.position.set(x, y, z);
    wheelStationGroup.rotation.z = isLeft ? camberRad : -camberRad;

    // Animated Rotating Wheel Hub Group
    const rotatingHub = new THREE.Group();
    wheels.push(rotatingHub);

    // Tire Rubber
    const tireMat = new THREE.MeshStandardMaterial({ color: '#121214', roughness: 0.85 });
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.24, 32), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    rotatingHub.add(tire);

    // Rim Barrel
    const rimMat = new THREE.MeshStandardMaterial({
      color: wheelFinishColorHex,
      metalness: config.wheelFinish === 'chrome' ? 0.98 : 0.85,
      roughness: config.wheelFinish === 'satin_black' ? 0.4 : 0.15,
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.82, wheelRadius * 0.82, 0.25, 32), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.castShadow = true;
    rotatingHub.add(rim);

    // Spokes
    const spokes = createWheelSpokes(config.wheelStyle, wheelFinishColorHex, wheelRadius * 0.78);
    rotatingHub.add(spokes);

    wheelStationGroup.add(rotatingHub);

    // Static Brake Assembly behind wheel
    const brakeGroup = new THREE.Group();
    brakeGroup.position.set(isLeft ? 0.05 : -0.05, 0, 0);

    const rotorMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.2 });
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, 0.03, 24), rotorMat);
    rotor.rotation.z = Math.PI / 2;

    const caliperMat = new THREE.MeshStandardMaterial({ color: config.caliperColor, metalness: 0.3, roughness: 0.2 });
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.2), caliperMat);
    caliper.position.set(0, wheelRadius * 0.38, 0);

    brakeGroup.add(rotor, caliper);
    wheelStationGroup.add(brakeGroup);

    wheelsLayer.add(wheelStationGroup);
  });

  return { carGroup, wheels, headlightLights };
}

function getWheelFinishColorHex(config: CarConfig): string {
  switch (config.wheelFinish) {
    case 'satin_black': return '#18181b';
    case 'bronze': return '#d97706';
    case 'hyper_silver': return '#f1f5f9';
    case 'gunmetal': return '#475569';
    case 'chrome': return '#ffffff';
    case 'custom': return config.customWheelColor || '#475569';
    default: return '#475569';
  }
}

function createWheelSpokes(style: WheelStyle, colorHex: string, radius: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.85, roughness: 0.2 });

  if (style === 'volk_te37') {
    [0, 60, 120, 180, 240, 300].forEach((deg) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, radius * 1.8, 0.06), mat);
      s.rotation.z = (deg * Math.PI) / 180;
      group.add(s);
    });
  } else if (style === 'enkei_rpf1') {
    [0, 72, 144, 216, 288].forEach((deg) => {
      const sub = new THREE.Group();
      sub.rotation.z = (deg * Math.PI) / 180;
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, radius * 1.8, 0.05), mat);
      s1.position.x = -0.03;
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, radius * 1.8, 0.05), mat);
      s2.position.x = 0.03;
      sub.add(s1, s2);
      group.add(sub);
    });
  } else if (style === 'bbs_rs') {
    [0, 30, 60, 90, 120, 150].forEach((deg) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.025, radius * 1.8, 0.04), mat);
      s.rotation.z = (deg * Math.PI) / 180;
      group.add(s);
    });
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95 })
    );
    cap.rotation.x = Math.PI / 2;
    group.add(cap);
  } else if (style === 'work_s1') {
    [0, 72, 144, 216, 288].forEach((deg) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, radius * 1.7, 0.06), mat);
      s.rotation.z = (deg * Math.PI) / 180;
      group.add(s);
    });
  } else {
    [0, 45, 90, 135, 180, 225, 270, 315].forEach((deg) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, radius * 1.8, 0.05), mat);
      s.rotation.z = (deg * Math.PI) / 180;
      group.add(s);
    });
  }

  return group;
}

export const Mx5Model3D: React.FC<{ config: CarConfig }> = () => null;
