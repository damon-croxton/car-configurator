# Mazda MX-5 3D Configurator

A Three.js viewer for a Mazda MX-5, wrapped in a data-driven configurator UI.

The app loads Sketchfab models and renders them as the artists shipped them.
Two generations are live — **ND** (2016) and **NA** (1990) — and switching
between them reloads the car in place. The guiding rule is that **nothing may
cut the asset up** — an earlier attempt to do that is written up in
`CONFORM_POSTMORTEM.md`. The configurator moves, scales, recolours and hides
what is already there, and adds **mods**: separate `.glb` parts built by Blender
scripts in `blender/mods/` (or conformed from licensed sources), which bolt on
or stand in for base parts they switch off.

Adding a generation is data, not code: an `assetUrl`, a `modelYawDeg` (assets
disagree about which way is forward), and a surface table.

**What reaches the car:** body colour, paint finish, rim style and finish,
wheel diameter, tyre width/sidewall, ride height, camber, track offset, roof
fabric colour, roof up/down, cabin theme plus separate seat, steering-wheel,
dash-trim and door-insert finishes, window tint, smoked indicators,
tinted headlight housings, head/tail lights, brake hardware and caliper paint
on built wheels, and every aero option marked **3D** in the panel
(`src/data/modsData.json`; `node scripts/mod-status.mjs` lists them). The NA
shares every wheel mod — six rim styles, the two sourced wheels and the
30-wheel pack — fitted to its own tyre at load (see below), and has its own
body kit, one part for every non-stock aero option it offers, plus a tow hook
(`blender/NA-KIT.md`). Most additional parts, from racing stripes to
bolt-on fender flares, are built for both cars (`blender/ND-EXTRAS.md`).
Both cars also get four replacement steering wheels, two pairs of
replacement seats, quick-release bumper fasteners and colour variants of the
stripes, mirrors and flares, and the NA gets a removable hardtop
(`blender/PARTS-R4.md`). Round five adds shift knobs, a fire extinguisher,
rally lamps, race roundels, an offset stripe, eight-spoke and pepperpot
wheels, and NA versions of the vents, canards, fuel cap and a carbon boot lid
(`blender/PARTS-R5.md`). Round six adds harnesses for the carbon buckets,
a cue-ball knob, chrome bullet mirrors, pinstripes, a bonnet wrap, covered
lamps, a skid plate, turbofan and deep-dish wheels, and NA mud flaps
(`blender/PARTS-R6.md`). Round seven adds riveted overfenders,
body-colour flares, NACA bonnet ducts, NA dive planes, rear spats and brake
ducts, and five-spoke, ten-spoke, steel and three-piece multi-spoke wheels
(`blender/PARTS-R7.md`). Round eight adds carbon front fenders, twin-stalk
mirrors, accent mirror caps and side stripes, rally door plates, NA twin tips,
and wire and seven twin-spoke wheels (`blender/PARTS-R8.md`). Variants of one part form a group in the panel,
and picking one takes the others off. A part can require another (the
harnesses need the buckets): fitting it fits both, and losing the required
part drops it.

**What does not:** aero options without the 3D badge (spec sheet only). A
control is not offered where the loaded model has nothing for it to change —
there is no RF roof or seat geometry, so those options are withheld, and the
NA's light and roof controls are hidden because its asset has no lens or
soft-top surfaces. Spec-sheet prices, weight, power and downforce are labelled
as estimates: they are placeholders summed from catalogue figures.

Also driven: camera presets, environment, exposure, floor reflection, contact
shadow, bloom/SSAO, turntable and the snapshot export.

```bash
npm install
npm run dev      # vite dev server on :3000
npm run build    # production bundle (fetches HDRIs first)
npm run lint     # tsc --noEmit
npm run smoke    # Playwright end-to-end pass against `npm run preview` (:4173)
```

`npm run smoke` uses Playwright's Chromium (`npx playwright install chromium`)
or falls back to an installed Chrome, and exits non-zero on any failure.

Pushes to `testing` and pull requests into `main` run
`.github/workflows/checks.yml`: type check, the Node checks
(`scripts/check-mod-selection.mjs`, `check-roof.mjs`, `check-environments.mjs`),
`validate-mod.mjs` over every mod, a build and the smoke test. Only pushes to
`main` deploy the site.

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
The asset file is never edited. At runtime, mods hide the base nodes they
replace, and the ND's roof lining is separated from the cabin tub by loose
part (see `ROOF_LINING_WIP.md`) so it can follow the roof.

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

- **Wheel diameter** grows the rim about its own centre and reshapes the tyre
  so its bead follows the rim while the tread radius holds — a bigger wheel
  trades sidewall for rim at near enough the same rolling diameter, as real
  plus-sizing does. See `CarModel.setRimSize()`.
- **Ride height** moves the body (and any body mods with it) by the slider.
- **Camber** rotates the pivot, which tilts the wheel about its contact patch
  rather than lifting it off the ground.
- **Track offset** slides the pivot outboard.

Tyre width and sidewall sliders are visual multipliers on the mesh, not real
tyre size codes.

**One set of wheel mods, two cars.** Wheel mods are modelled around the ND's
tyre (17in, 253 mm bead). The NA's is a 14in rim in a much taller sidewall
(183 mm bead), so a uniform scale cannot fit both. A mod lists the generation
it was built for first in `gen`; on any other generation that reuses the same
file, `CarModel.fitWheel()` scales the rim radially until its lip seats in
that car's own tyre bead, keeps its width, and lifts it to that car's hub —
the same design as a 14in wheel, in the NA's own textured tyre. The 30-wheel
pack keeps its own low-profile tyre and scales uniformly to the NA's rolling
diameter instead. `validate-mod.mjs` checks a shared file once, under the
generation it was built for.

### Surface classification, and how paint works

Every mesh in both models carries **exactly one material**, so a material name
is a complete statement of what a surface is. `src/data/surfaceClasses.json`
holds one table per model, mapping material names to a surface class
(`body_paint`, `trim_gloss_black`, `lens_red`, `rim`, `glass`, …) and naming the
single paintable class. Painting is then trivial: find the materials classified
`body_paint` and set `.color`. Grille, lenses, badges, rims, glass and interior
are untouched because they are simply not in that set.

**The two tables were built very differently, and that is the interesting bit.**
The ND's material names are self-describing (`M_CarPaintNormal_Max`), so its
table was read straight off them. The NA's are `Material_71`, `Material_230` —
meaningless. Its table was built by inspecting *which objects use each
material*: `Material_71` turns out to be used by `hood`, `leftdoor`,
`rigthdoor`, `trunk`, `frontbumper`, `rearfender`, `f fender`, `rearbumper`,
`Apillar` and `popuplight`, which is unambiguously the paint. Same mechanism,
different way of populating it — so a model with bad names costs an afternoon of
inspection, not a redesign.

A table declares `complete: true` when it is meant to cover every material in
the asset, and `CarModel` warns about anything missing. The NA's is `false`: it
maps only the surfaces the configurator drives and leaves ~80 others alone
deliberately, so no drift warning is raised.

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
shows a `GENERATED IBL` badge.

All six environments have a real `.hdr`. None is committed — git keeps every
revision of a binary forever — so they are fetched by `npm run assets`, which
`prebuild` runs, meaning CI has them too. Run it once after cloning and the
badge disappears. The generated rig is the fallback for a failed or skipped
fetch, not the normal path. See `public/assets/hdri/README.md`.

Each environment also has a sharp 8K WebP panorama, converted from Poly Haven's
tonemapped JPG by the asset fetcher. `GroundedSkybox` projects the photograph
onto the floor and surrounding sky; the contact shadow anchors the car without
an opaque grid floor hiding the scenery. The 1K HDR stays separate for lighting.
The source HDR remains a visible fallback if the panorama fails to load.

The ND catalogue includes ten additional supplier-inspired aero concepts and
two coordinated presets, **ND MSR-inspired** and **ND Club Aero**. See
[the modelling references](blender/ND-AERO-REFERENCES.md) for sources, design
scope and rebuild instructions. All eight main aero options are shareable;
stacked canards and rear spats are available under Additional parts.

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
?model=ND&color=soul_red&wheels=enkei_rpf1&roof=st_down&stance=-30
```

The **spec sheet** itemises every fitted option, including additional parts and
sourced wheels, with estimated pricing and catalogue-derived kerb weight, power
and downforce, and exports the build as JSON. The figures are placeholders and
labelled as such. The **snapshot**
button renders a frame at 2× device resolution straight from the WebGL canvas —
the UI is DOM, so exports are free of overlay artefacts by construction.

---

## Known limitations

- **Roof "down" hides the roof rather than folding it.** The model ships one
  roof state and no folded stack, so down means the whole roof part — canvas,
  stitching, rear window and frame — is hidden together. The side windows stay
  up, because they live inside the chassis part and cannot be separated by
  class.
- **Cabin parts are split at load, not modelled apart.** Seats, steering
  wheel, dash/door trim and door inserts each take their own finish, but on
  the ND the seats and the rest of the tub share one mesh and material. The
  seats are therefore the tub's loose parts inside a seat-shaped region
  (`surfaceClasses.json` → `cabinParts`), given a cloned material, alongside
  the roof-lining split. The cabin textures are very dark, so colours are
  divided by each texture's mean (`CarModel.interiorTint`), keeping the grain
  while landing the requested colour.
- **Caliper paint needs a built wheel.** The base car has no separate caliper,
  so the control appears only with a mod wheel fitted and its brakes shown.
  The 30-wheel pack's calipers are baked into its texture and keep their own
  colour.
- **Metallic flake is an approximation.** Paint finish, clearcoat and flake all
  reach the car now: the finish drives metalness, roughness, clearcoat, sheen
  and iridescence, and the clearcoat slider scales the finish rather than
  replacing it, so a matte wrap stays matte at full clearcoat. Flake has no
  material equivalent in three.js, so it is approximated the way it reads —
  more metallic, slightly sharper, hotter against the environment — with the
  colour's own `flakeHex` tinting the sheen. There are no actual flakes.
  Paintable materials that arrive as `MeshStandardMaterial` (mods exported
  without a coat weight) are upgraded to `MeshPhysicalMaterial` on the way in,
  so a matte body does not end up next to a glossy bonnet.
- Per-panel colour is not wired up. The data to do it is in
  `surfaceClasses.json`; the app currently paints all panels together.
- NB / NC are catalogued but marked `available: false` — no model for them yet.
- **The NA's roof cannot go up.** The asset ships roof-down with no soft-top
  geometry, so the roof controls are not offered for it.
- HDRIs are fetched, not committed — run `npm run assets` once after cloning, or
  every environment falls back to its generated lighting rig.
