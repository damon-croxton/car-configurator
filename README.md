# Mazda MX-5 3D Configurator

A data-driven Three.js configurator for the Mazda MX-5. Phase 1 ships the **ND**
end to end — paint, roof, wheels, stance, aero, lighting, camera presets,
shareable build URLs, spec sheet and high-resolution snapshot export. NA / NB /
NC are already described in the catalogue and gated behind an `available` flag,
so bringing one online is a data change plus a mesh.

```bash
npm install
npm run dev      # vite dev server on :3000
npm run build    # production bundle
npm run lint     # tsc --noEmit
npm run smoke    # Playwright end-to-end pass (needs `npm run preview` running)
```

---

## Architecture

React never touches Three.js directly. It owns a `CarConfig` object and hands it
to `SceneManager`; everything WebGL — loading, materials, disposal, resize,
quality scaling — lives behind that boundary.

```
src/
├── data/                  the catalogues — nothing else hard-codes an option id
│   ├── carData.json       generations, roofs, wheels, aero parts, stance,
│   │                      interior trims, camera presets
│   ├── materialsData.json paint finishes + colours, wheel/caliper finishes,
│   │                      glass, light mods, environments
│   └── schema.ts          typed access layer + lookup helpers
│
├── config/                the build state
│   ├── types.ts           CarConfig — the single serialisable source of truth
│   ├── defaults.ts        defaults, slider ranges, reconcileConfig()
│   ├── urlState.ts        query-string codec (share links)
│   ├── presets.ts         curated builds
│   └── summary.ts         spec sheet: weight, power, downforce, pricing
│
├── three/                 the renderer
│   ├── sceneManager.ts    renderer, frame loop, resize, snapshot, teardown
│   ├── carModel.ts        GLTF load w/ procedural fallback + applyConfig()
│   ├── nodeNames.ts       the scene-graph naming contract
│   ├── proceduralMx5.ts   parametric ND body, roofs, interior, aero, lights
│   ├── proceduralWheel.ts parametric wheels + six spoke patterns
│   ├── geometryUtils.ts   lofting / surfacing / merge toolkit
│   ├── materialLibrary.ts every material, created once and mutated in place
│   ├── textures.ts        procedural flake, orange-peel, fabric, carbon maps
│   ├── environmentManager.ts  HDRI or code-generated IBL, lights, ground
│   ├── contactShadow.ts   baked-on-demand soft ground shadow
│   ├── cameraRig.ts       OrbitControls + GSAP preset transitions
│   ├── postProcessing.ts  bloom / SSAO / tone mapping, bypassable
│   └── disposal.ts        WebGL memory hygiene
│
├── hooks/useConfigurator.ts   state + URL sync + undo
└── components/            header, viewport, tabbed control panel, spec sheet
```

### Data-driven, not hard-coded

Adding a wheel is an entry in `carData.json` plus a `spokeType`; adding a colour
is an entry in `materialsData.json`. The UI, the URL codec, the spec sheet and
the 3D scene all read from the same catalogue, and `reconcileConfig()` forces a
build onto options the selected generation actually offers — a hand-edited URL
or a generation switch can never leave a dangling part id.

### Fail-safe visuals

Nothing in this repository is a binary asset, and the app still renders a
complete car with working image-based lighting:

- **Model** — `CarModel` probes `generations[].assetUrl`. If the GLB is absent
  or fails to parse, `buildProceduralMx5()` generates the car from code: the
  body is a superellipse loft with a cockpit cut into the top and a rocker tuck
  that leaves the wheels proud of the sills. The viewport shows a
  `PROCEDURAL MESH` badge so it is never ambiguous which path is live.
- **Environment** — `EnvironmentManager` loads `.hdr` files when present;
  otherwise it builds a graded sky dome plus emissive softbox panels from the
  environment's `procedural` block and pre-filters it with `PMREMGenerator`.
- **Textures** — metallic flake, clearcoat orange peel, roof canvas weave and
  carbon twill are all generated to canvas at boot.

Both fallbacks honour the same contracts as the real assets, so dropping in a
GLB or an HDRI later requires no code change. See the READMEs in
`public/assets/models/` and `public/assets/hdri/`.

### Scene graph contract

`src/three/nodeNames.ts` is the interface between the renderer and any authored
asset — `Body_Main`, `Roof_ST_Up` / `Roof_ST_Down`, `Roof_RF_Up` /
`Roof_RF_Down`, `Glass_Windshield`, `Glass_Windows`, `Wheel_FL…RR` (each with
`Rim` / `Tire` / `Brake_Caliper` / `Brake_Disc`), `Interior_*`,
`Aerodynamics_*` and `Suspension_Node`. Aero containers hold one child per
catalogue variant; `CarModel` only ever toggles visibility, never rebuilds.

---

## Rendering

**Car paint** is a `MeshPhysicalMaterial` driven by the finish table in
`materialsData.json`: base colour, metalness/roughness, clearcoat (~1.0) with
low clearcoat roughness, a tiled flake normal map scaled by the finish's flake
ceiling and the user's slider, an orange-peel clearcoat normal map, plus sheen
and iridescence for pearl. Solid / Metallic / Pearl / Matte / Chrome are data,
not branches.

**Glass** uses transmission 0.92 at IOR 1.52; the tint slider darkens the base
colour and reduces transmission together. **Wheels** get a metallic finish with a
brushed roughness map and a polished accent for lip and centre cap. **Calipers**
are powder-coat colours from the catalogue, and the **roof fabric** is a rough
canvas with a woven bump map.

**Lighting** is image-based (HDRI or generated) plus a key/fill/rim rig for
shape and the shadow-casting direction. The ground shadow is a **contact
shadow**: the car is rendered from below with a depth material, blurred twice,
and composited onto a plane — re-baked only when the configuration changes, so
it costs nothing per frame and never shimmers. Tone mapping is ACES Filmic;
bloom and SSAO are optional and the composer is bypassed entirely when both are
off.

**Performance** — one shared material per surface type, spoke patterns merged
into a single geometry per style, all variants built once and toggled by
visibility, DPR capped at 2, shadow map resolution chosen from DPR and viewport
width, and `dispose()` walked over every geometry/material/texture when a car or
environment is swapped (shared library materials are deliberately excluded).

---

## Sharing and export

The address bar is always a shareable link. Only values that differ from the
defaults are written, so a light build stays readable:

```
?model=ND&color=soul_red&wheels=enkei_rpf1&roof=rf_down&stance=-30
```

The **spec sheet** itemises every selected option with pricing and derived kerb
weight, power and downforce, and exports the build as JSON. The **snapshot**
button renders a frame at 2× device resolution straight from the WebGL canvas —
the UI is DOM, so exports are free of overlay artefacts by construction.

---

## Known limitations

- The procedural ND is a stylised stand-in tuned to real ND dimensions
  (3915 × 1735 × 1230 mm, 2310 mm wheelbase). It reads correctly and drives
  every toggle, but it is not a scan — swap in a GLB for production fidelity.
- NA / NB / NC are catalogued but marked `available: false`. Until each has its
  own mesh they would render the ND surfaces rescaled to their proportions,
  which is why the generation switcher keeps them disabled.
- No HDRIs are committed; every environment currently runs on its generated
  lighting rig.
