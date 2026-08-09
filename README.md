# Mazda MX-5 3D Configurator

A Three.js viewer for a Mazda MX-5, wrapped in a data-driven configurator UI.

The app loads one Sketchfab model and renders it as the artist shipped it. The
guiding rule is that **nothing may cut the asset up** — an earlier attempt to
do that is written up in `CONFORM_POSTMORTEM.md` — so the configurator drives
only what can be expressed by moving, scaling and recolouring what is already
there.

**What reaches the car:** body colour, rim finish, wheel diameter, ride height,
camber, track offset, roof fabric colour, roof up/down and interior colour.

**What does not:** aero parts, wheel *style* (there is one rim design in the
model), caliper colour (there are no calipers), roof *type* (soft top only).
Those controls still drive the share URL, the spec sheet and pricing.

Also driven: camera presets, environment, exposure, floor reflection, contact
shadow, bloom/SSAO, turntable and the snapshot export.

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
│   ├── surfaceClasses.json  material name → surface class; which class is paint
│   ├── surfaces.ts        classOf() / isPaintable() over that table
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
│   ├── carModel.ts        loads the model, stands it on the ground, sets paint colour
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
is an entry in `materialsData.json`. The UI, the URL codec and the spec sheet
all read from the same catalogue, and `reconcileConfig()` forces a build onto
options the selected generation actually offers — a hand-edited URL or a
generation switch can never leave a dangling part id. The 3D scene reads only
the camera and environment parts of that config.

### The car

`src/three/carModel.ts` loads `scene.gltf`, enables shadows, and applies one
uniform scale, one 180° yaw and one translation to the model *root* so it
stands at real-world size on the ground plane facing the camera presets.
Nothing is split, renamed, hidden or re-materialled. There is no naming
contract, no procedural fallback and no Blender step.

### Wheels, stance and the contact-patch pivot

On load the wheel meshes are re-parented onto four pivots placed at their
**ground contact patches**; what remains under the model root is the body. This
is a scene-graph rearrangement, not an edit — `Object3D.attach()` preserves
world transforms, so nothing visibly moves, and no vertex changes.

It exists because the asset's wheel nodes have their origins on the car's
centreline, not in the wheels, so scaling them in place would drag the wheels
into the sills. Attaching also bakes away the asset's per-part helper armatures
(0.01 scale, mirrored right-hand side — a 3ds Max export artefact) instead of
having to reason about them.

Wheels are found by **material class**, never by node name: all four wheel
groups are called `WheelFL` internally and the nodes are named things like
`Armature.023_192`. Meshes classed `rim` / `rim_badge` / `tyre` are bucketed
into four quadrants by position, which is what actually identifies a wheel.

With the pivot on the ground, the transforms fall out simply:

- **Wheel diameter** scales the pivot. The tyre stays planted and the hub rises,
  exactly as fitting a bigger wheel does. Rim and tyre scale together, so the
  bead always fits — growing the rim alone would punch it through the sidewall,
  since the tyre's inner hole (252mm) sits just inside the rim lip (257mm).
- **Ride height** moves the body by `hub rise + slider`, so a bigger wheel
  lifts the car and the slider lowers it from there.
- **Camber** rotates the pivot, which tilts the wheel about its contact patch
  rather than lifting it off the ground.
- **Track offset** slides the pivot outboard.

The trade-off: this is a bigger wheel with the same tyre, not true plus-sizing.
Fitting an 18" raises the hubs ~19mm. Real plus-sizing — rim grows, sidewall
thins, overall height unchanged — needs the tyre mesh reshaped, which is
deliberately not done here.

### Surface classification, and how paint works

Every mesh in the model carries **exactly one material**, so a material name is
a complete statement of what a surface is. `src/data/surfaceClasses.json` maps
all 24 material names to a surface class (`body_paint`, `trim_gloss_black`,
`lens_red`, `rim`, `glass`, …) and names the single paintable class. Painting
is then trivial: find the materials classified `body_paint` — in practice one
shared material across 18 meshes — and set `.color`. Grille, lenses, badges,
rims, glass and interior are untouched because they are simply not in that set.

Two traps the table exists to document:

- `M_CarPaint_Trim_PlasticSmoothBlack_Max` contains "CarPaint" but is the
  **gloss black** trim on the bumpers and skirts. Lookups are exact-name only;
  a substring match paints the grille surround body colour.
- `.001`-style suffixes are per-wheel duplicates of identical materials and are
  normalised away — but `M_LightGlassNormal_OrangeLow.` ends in a bare dot and
  must survive that normalisation intact.

`surfaceClasses.json` also records the 18 painted panels by glTF node name
(`Hood`, `DoorL`, `FenderFR`, …) for later per-panel colour. The app does not
read that list yet; it is there because the names are already in the shipped
asset, so per-panel work needs no Blender step either. Note that the rear
quarters, bumpers, sills and tub are each a single left+right mesh and cannot
be coloured per-side without cutting geometry.

If the model ever gains a material the table does not know, `CarModel` warns to
the console and that surface simply never gets painted.

### Fail-safe lighting

`EnvironmentManager` loads `.hdr` files when present; otherwise it builds a
graded sky dome plus emissive softbox panels from the environment's
`procedural` block and pre-filters it with `PMREMGenerator`, and the viewport
shows a `GENERATED IBL` badge. No HDRIs are committed, so this is the default
path. See `public/assets/hdri/README.md`.

---

## Rendering

**The car's materials are the model's own** — its glTF PBR materials and
textures are loaded and used as authored, so what you see is the artist's
glass, chrome and rubber, not a code-side approximation. The one mutation is
`.color` on the body-paint material; its metalness, roughness and clearcoat
stay exactly as authored, which is why every colour keeps the same finish.

**Lighting** is image-based (HDRI or generated) plus a key/fill/rim rig for
shape and the shadow-casting direction. The ground shadow is a **contact
shadow**: the car is rendered from below with a depth material, blurred twice,
and composited onto a plane — re-baked only when the configuration changes, so
it costs nothing per frame and never shimmers. Tone mapping is ACES Filmic;
bloom and SSAO are optional and the composer is bypassed entirely when both are
off.

**Performance** — the model is loaded once and never rebuilt, DPR capped at 2,
shadow map resolution chosen from DPR and viewport width, and `dispose()` walked
over every geometry/material/texture on teardown.

---

## Assets

`src/data/assetManifest.json` is the ledger: every third-party asset, with its
licence, source and credit. `npm run assets` fetches the entries that have a
`url` into `public/assets/`, and CI runs the same script before building. HDRIs
work that way so git never carries a multi-megabyte revision history; a fetch
failure is non-fatal because the generated lighting rig covers it.

The car is the exception. It is marked `vendored` in the manifest (skipped by
the fetcher) and committed to the repo at
`public/assets/models/mx5_sketchfab/`, via an explicit un-ignore in
`.gitignore` — it is the one asset the app cannot run without.

```bash
npm run assets      # fetch the declared HDRIs; vendored entries are skipped
```

Third-party assets must carry `licence`, `source` and `credit` in the manifest —
that is what renders the in-app credits panel and keeps `ATTRIBUTION.md` honest.
See `public/assets/*/README.md` for the per-directory contract.

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

- **Roof "down" hides the roof rather than folding it.** The model ships one
  roof state and no folded stack, so down means the whole roof part — canvas,
  stitching, rear window and frame — is hidden together. The side windows stay
  up, because they live inside the chassis part and cannot be separated by
  class.
- **Interior colour cannot separate seats from dashboard.** The cabin tub,
  seats, steering wheel and door cards are one mesh sharing one material, so
  the seat colour tints all of it. The door tops and dash rail are a separate
  material and take the trim colour. Aero options remain inert — the model has
  no aero parts.
- **Wheel *style* is inert; wheel *diameter* and *finish* work.** There is one
  rim design in the model, so the TE37/RPF1-style catalogue entries change the
  spec sheet but not the render. Caliper colour is inert for the same reason —
  the model has no separate caliper.
- **Body paint applies colour only, not finish.** A matte or chrome swatch
  changes the hue; the surface keeps the model's authored metallic clearcoat.
  Rim finishes *do* drive metalness and roughness, because that is what
  separates matte black from chrome. Making paint consistent with that is a
  deliberate next decision rather than an oversight.
- **Wheel sizing is not true plus-sizing** — see above; an 18" raises the car
  ~19mm.
- Per-panel colour is not wired up. The data to do it is in
  `surfaceClasses.json`; the app currently paints all panels together.
- NA / NB / NC are catalogued but marked `available: false`; there is one model
  and it is an ND.
- No HDRIs are committed; every environment currently runs on its generated
  lighting rig.
