# MX-5 Configurator — Mod Asset Brief

**Target:** NA (Mk1, 1989–1997) and ND (Mk4, 2015–) MX-5.
**Consumer:** `src/three/carModel.ts` in this repo — not a hypothetical app.
**Tooling:** Claude Code + Blender MCP (Blender 5.2 LTS, running, connected).

Read this file top to bottom before touching Blender. §1–§6 are binding rules for
*every* asset. §7 is the mod catalogue. §8–§11 are the pipeline.

> **This revision is reconciled against the actual codebase and the actual
> assets.** Every coordinate in this document was *measured*, not assumed —
> `node scripts/measure-asset.mjs` produced them by replaying the exact
> transform `CarModel.frame()` applies at runtime. Where the previous revision's
> nominal numbers were wrong, they are corrected here and the delta is called
> out. Re-run the script rather than trusting a number you read here; the script
> is the source of truth and this document is its summary.

---

## 0. What you are building onto, and the one rule that governs everything

The app loads two Sketchfab glTF cars and renders them **exactly as the artists
shipped them**. Nothing is split, renamed, re-materialled or cut. That rule is
not stylistic — `CONFORM_POSTMORTEM.md` is the write-up of a previous attempt to
cut these assets up, and it failed on the third rebuild. Read it before you
propose deriving anything from the base mesh.

So mods are **additive scene-graph objects**, never edits to the car. A mod is a
`.glb` that the app instantiates alongside the car. The car file never changes.

Two consequences you must internalise:

1. **A "REPLACE" mod does not replace geometry.** It adds its own geometry and
   sets `visible = false` on named nodes of the base asset. If a base part cannot
   be hidden cleanly by node name, that mod cannot be built. §7 marks which ones
   those are.
2. **You cannot rely on the base mesh's topology.** Both assets came out of 3ds
   Max with per-part helper armatures at 0.01 scale and mirrored right-hand
   sides. Extracting an edge loop from them to derive a lip or a skirt is exactly
   the operation that failed last time. §7 tiers the catalogue by how much
   base-mesh derivation each mod needs, and Tier 1 needs none.

---

## 1. The coordinate system — the app's, measured

There is only one coordinate system that matters: the one the running app puts
the car in. Not the one the artist authored in, and not a nominal vehicle datum.

`CarModel.frame()` (`src/three/carModel.ts:252`) does three things to the model
root, in this order:

1. yaws it by `modelYawDeg` from `carData.json` so the nose points **+Z**
2. scales it uniformly so its longest horizontal axis equals `dimensions.length`
3. translates it so it is centred on X and Z and stands on **Y = 0**

| | ND | NA |
|---|---|---|
| Yaw applied | 180° | 0° |
| Uniform scale applied | ×1.000562 | ×0.577899 |
| Translation applied (mm) | (0, 140, 40) | (251, −6, 374) |

**The authoring frame, in three.js world space:**

| Axis | Meaning | Units |
|---|---|---|
| **+X** | vehicle **LEFT** | metres |
| **+Y** | up | metres |
| **+Z** | forward (nose) | metres |
| Origin | ground plane, at the car's **bounding-box centre** in X/Z | |

`+X = left` is not a derivation, it is read off the asset: the ND's own
`MirrorL`, `DoorL` and `FenderFL` nodes all sit at **positive** X.

> **Correction to the previous revision.** It specified +Y forward, +Z up, and
> the origin at mid-wheelbase. All three are wrong for this app. The origin is
> the **bbox centre**, which is *not* mid-wheelbase: the ND's mid-wheelbase is at
> Z = +40 and the NA's at Z = +30. Anchor coordinates below are in app space.

### 1.1 Blender ⇄ app axis mapping

Blender is Z-up and the glTF exporter maps Blender `(x, y, z)` → glTF
`(x, z, −y)`. To land nose-toward-+Z in three.js, the car's nose must point
toward **Blender −Y**:

| Blender | App / three.js |
|---|---|
| +X | +X — vehicle left |
| **−Y** | **+Z — forward (nose)** |
| +Z | +Y — up |

```
blender_xyz = (app_x / 1000, -app_z / 1000, app_y / 1000)     # mm → m
```

**Do not memorise this.** `mx5_lib.load_reference(gen)` imports the base car and
applies the frame transform above, so the reference car sits in Blender exactly
where it sits in the app. Model against the reference, and the mapping takes care
of itself. Export with the exporter's default `+Y up` and do not add corrective
rotations — if a mod comes out backwards, the reference car was not loaded.

### 1.2 Measured vehicle geometry

Regenerate with `node scripts/measure-asset.mjs`. All values millimetres,
app space.

| | ND | NA | Catalogue says |
|---|---|---|---|
| Overall bbox size (X × Y × Z) | 1940 × 1397 × 3915 | 1830 × 1570 × 3975 | — |
| Nose Z / tail Z | +1958 / −1957 | +1988 / −1988 | — |
| Front axle Z / rear axle Z | +1194 / −1114 | +1181 / −1122 | — |
| Measured wheelbase | 2308 | **2303** | ND 2310, NA **2265** |
| Measured track (front = rear) | 1469 | **1446** | ND 1495/1505, NA 1405/1427 |
| Hub centre height | 321 | 303 | — |
| Tyre outer ⌀ / wheel width | 641 / 261 | 606 / 258 | — |
| Lowest body point (not wheel) | 124 | 158 | — |
| **Centreline X** | **0** (±1) | **≈ −7** | 0 |

Four measured facts that change how you work:

- **The NA is not symmetric about X = 0.** Its wheel contact patches are at
  X = +714 and X = −732; its panels centre on X = −4 to −9. Its centreline is
  **X ≈ −7**. Mirror NA mods about **X = −7**, not X = 0, and place left/right
  anchors from the measured table below rather than by negating one number. On
  the ND, mirroring about X = 0 is correct to within 1 mm.
- **Both assets run larger tyres than the spec sheet.** The brief's old
  "stock rolling radius 288 / 308" is wrong: measured hub heights are 303 (NA)
  and 321 (ND). Wheel mods must match the *measured* diameter, not the spec.
- **The NA's front and rear tracks are identical** (1446 both ends) where the
  real car's differ by 22 mm. The asset is not dimensionally faithful. Trust the
  asset.
- **The NA's bbox is 1570 mm tall** against a real roof height of 1235. A single
  unidentified node, `Tube003_Material #123_0` (x ±485, y 605…1570, z −184…155),
  accounts for all of it — a 970 mm-wide, 965 mm-tall tube structure sitting
  right where a roll hoop goes. **Identify it visually before building anything
  in the `RB` category.** If it is a roll bar, RB01–RB03 must hide it or are
  redundant.

### 1.3 Measured anchors

These replace the previous revision's nominal table wholesale. Each is a real
node's measured bounding box, so "snap to the mesh" is already done. The full
per-node table for both cars is `blender/anchors.json`
(`node scripts/measure-asset.mjs --out blender/anchors.json`), which
`mx5_lib.anchor()` reads directly — prefer that over retyping a number.

**ND** — node names are meaningful and stable; use them verbatim in `hides`.

| Feature | Node name | x | y | z |
|---|---|---|---|---|
| Bonnet | `Hood 6.001_120` | ±721 | 582…864 | 423…1800 |
| Boot lid | `Boot 6.001_157` | ±604 | 756…918 | −1864…−1308 |
| Front bumper (paint) | `BumperF 6.003_111` | ±857 | 175…644 | 1371…1958 |
| Front bumper lower lip | `BumperF 6.001_109` | ±469 | 169…489 | 1839…1937 |
| Rear bumper (paint) | `BumperR 6.001_146` | ±856 | 191…753 | −1957…−1303 |
| Rocker sill | `Skirts 6.003_57` | ±855 | 161…390 | −781…841 |
| Front fender (left) | `FenderFL 6.002_88` | 653…865 | 255…837 | 358…1609 |
| Rear quarter (shared L+R) | `FendersR 6.001_40` | ±867 | 371…889 | −1795…−593 |
| Mirror head (left) | `MirrorL 6.003_176` | 783…970 | 824…936 | −3…158 |
| Mirror base (left) | `MirrorBaseL 5_163` | 767…829 | 744…816 | 46…163 |
| Soft top | `Roof 6_24` | ±698 | 831…1226 | −1248…−134 |
| Exhaust tip | `Exhausts 6_124` | −354…−220 | 198…259 | −1855…−1783 |
| Antenna mast | `FendersR 6.002_41` | −587…−575 | 989…1371 | −1671…−1571 |

Wheel contact patches (ND): LF (734, 0, 1194) · LR (734, 0, −1114) ·
RF (−735, 0, 1194) · RR (−735, 0, −1114).

**NA** — node names embed the material and contain a `#` and a space
(`hood_Material #71_0`). Copy them exactly; they are JSON string keys.

| Feature | Node name | x | y | z |
|---|---|---|---|---|
| Bonnet | `hood_Material #71_0` | −702…694 | 623…858 | 523…1795 |
| Boot lid | `trunk_Material #71_0` | −564…555 | 685…873 | −1889…−1099 |
| Front bumper | `frontbumper_Material #71_0` | −834…817 | 219…659 | 1465…1988 |
| Rear bumper | `rearbumper_Material #71_0` | −822…805 | 229…530 | −1988…−1402 |
| Front fenders **(both, one mesh)** | `f fender_Material #71_0` | −859…845 | 237…845 | 385…1738 |
| Rear fenders **(both, one mesh)** | `rearfender_Material #71_0` | −853…839 | 232…851 | −1813…−461 |
| A-pillar / screen frame | `Apillar_Material #71_0` | ±715 | 768…1168 | −24…465 |
| Mirror (right) | `mirrorbox_Material #70_0` | −915…−717 | 770…892 | −9…172 |
| Pop-up headlights | `popuplight_Material #71_0` | — | ~619…747 | ~1465…1773 |
| Unidentified tube (see §1.2) | `Tube003_Material #123_0` | ±485 | 605…1570 | −184…155 |

Wheel contact patches (NA): LF (714, 0, 1181) · LR (714, 0, −1122) ·
RF (−732, 0, 1181) · RR (−732, 0, −1122).

**Not found in the NA asset by name, and therefore unresolved:** any exhaust or
muffler node, any rocker-sill node, any antenna. Locate them visually before
building `EX`, `RA06` or `DT01`/`DT02` for the NA, or drop those from the NA set.
The NA also carries **79 materials that `surfaceClasses.json` does not classify**
— deliberate (`complete: false`), but it means you cannot find NA parts by
surface class the way you can on the ND.

---

## 2. How a mod attaches — the app-side contract

**This does not exist yet.** There is currently no code in the repo that loads a
mod. Building it is Phase 0 of §11 and it must ship before any mod asset, because
it is the only thing that can prove an asset lands correctly.

### 2.1 Scene graph

```
Car  (CarModel.group)                      world space, metres, real size
├── MX5_ND_Body  (model root)              yawed + scaled + offset by frame()
│                                          ride height moves .position.y
├── Wheel_LF / _RF / _LR / _RR  (pivots)   at the contact patches
│   └── OEM wheel meshes (re-parented)      + wheel mod instances
└── Mods                                   ← NEW
    └── BodyMods                           mirrors the body's ride-height Y
        └── mod instances, identity transform
```

### 2.2 The rules that fall out of it

- **Body mods are siblings of the body, not children.** The model root carries a
  uniform scale (×0.578 on the NA!) and an offset. A mod parented under it would
  be scaled by that factor. Under `Mods`, a mod exported in metres in app space
  drops in at **identity transform** and lands exactly where it was modelled.
- **`BodyMods.position.y` must track the body.** `setStance()` sets
  `body.position.y = bodyBaseY + hubRise + rideHeight/1000`. Body mods must move
  with it: `bodyMods.position.y = body.position.y - bodyBaseY`. Skip this and
  every mod floats the moment the ride-height slider moves.
- **Wheel mods are children of the four pivots**, at identity. The pivot already
  does position, diameter scaling, camber and track offset — a wheel mod
  inherits all four for free and no new maths is needed.
- **Wheel mods are authored once, for the LEFT side, origin at the contact
  patch**, axis along X. The right-hand instance is placed with
  `rotation.y = π`. That is a rigid transform, so it does not flip normals or
  winding — do **not** mirror with a negative scale.
  > Correction: the previous revision put the wheel origin at the hub mounting
  > face. That fights the app, which pivots wheels at the contact patch so a
  > bigger wheel stays planted and raises the hub. Contact-patch origin means
  > diameter/camber/track keep working unchanged.
- **Hiding OEM parts** is `visible = false` on the nodes named in the mod's
  `hides` list. Wheels are hidden by surface class (`rim`, `rim_badge`, `tyre`),
  which is how `CarModel` already finds them.
- **Re-bake the contact shadow** after any mod change; `SceneManager` bakes it
  on config change and a new silhouette needs a new bake.

### 2.3 Ride height, and why mods must not assume it

Anchors in §1.3 are measured at **stock ride height with the stock wheel
diameter**. `setStance()` moves the body up by `hubRise` for a larger wheel and
down by the slider. Model at stock. The `BodyMods` group handles the rest.

---

## 3. Materials — the real recolour contract

> **The previous revision's material contract does not work in this app.** It
> said "the app recolours by material slot name, slot 0 is always the primary
> recolourable surface." This app does not look at slot indices at all. It maps a
> **material name** to a **surface class** via `src/data/surfaceClasses.json`,
> buckets every material instance by class, and tints a whole class at once
> (`CarModel.tint()`). Slot order is irrelevant.

So the contract is: **name a mod's material such that `surfaceClasses.json` maps
it to the class you want, and the existing app code recolours it with no new
code at all.**

Add one shared `mods` table to `surfaceClasses.json`, merged over whichever car's
table is loaded. Use these names verbatim:

| Material name | Surface class | Driven by | New app code? |
|---|---|---|---|
| `MOD_BodyPaint` | `body_paint` | main colour picker | **none** |
| `MOD_Rim` | `rim` | wheel finish picker | **none** |
| `MOD_Tyre` | `tyre` | — (stays black) | none |
| `MOD_GlossBlack` | `trim_gloss_black` | — | none |
| `MOD_SatinBlack` | `trim_matte_black` | — | none |
| `MOD_Glass` | `glass` | window tint | none |
| `MOD_MirrorGlass` | `mirror_glass` | — | none |
| `MOD_Chrome` | `chrome` | — | none |
| `MOD_CaliperPaint` | `caliper` | `config.caliperColor` | small — wires up an **existing but inert** control |
| `MOD_AccentPaint` | `mod_accent` | new secondary picker | new class + picker |
| `MOD_CarbonWeave` | `mod_carbon` | — (weave texture) | new class |
| `MOD_Alloy` | `mod_alloy` | — | new class |
| `MOD_Rubber` | `mod_rubber` | — | new class |
| `MOD_Titanium` | `mod_titanium` | — | new class |

Rules:

1. **Exact names only.** `classOf()` strips a trailing `.001`-style suffix and
   nothing else. `MOD_BodyPaint.001` is fine; `MOD_BodyPaint_v2` is unclassified
   and will never be painted.
2. The ND's table is `complete: true`, so **any unclassified material logs a
   console warning**. Landing a mod with an off-contract material name is
   therefore self-reporting — watch the console.
3. Principled BSDF only: base colour, metallic, roughness, normal. No procedural
   node trees; bake anything clever. Nothing survives glTF export otherwise.
4. Only include materials the mod actually uses.
5. `MOD_CaliperPaint` is worth going out of your way for. `CarConfig.caliperColor`
   already exists and is inert because the base assets have no calipers — the
   first wheel mod that ships a caliper makes an existing control work.

---

## 4. Naming, files and where things live

```
blender/
  mx5_lib.py          helper module (§6), written once
  anchors.json        generated: node scripts/measure-asset.mjs --out
  mods/
    W01_race7spoke.py   one build script per mod, committed, re-runnable
    RA02_gtwing.py
  build/              .blend working files (git-ignored)

public/assets/mods/
  na/W01_race7spoke.glb
  nd/RA02_gtwing.glb

src/data/modsData.json    the catalogue the app reads (§9)
```

**Build scripts are the deliverable, not the .blend file.** Every mod is a
committed, re-runnable Python file that builds the mod from nothing. If a
measurement changes, re-run it. Never hand-edit geometry in the viewport — the
result is unreproducible and the next anchor correction destroys it.

- **IDs:** `<CAT><nn>` — `W03`, `FA02`, `RA05`, `BP01`, `EX04`, `SU03`, `RB02`, `DT06`.
- **Object names:** `MOD_<GEN>_<ID>_<part>` → `MOD_NA_RA02_element`,
  `MOD_NA_RA02_upright_L`.
- **Collection per mod:** `MOD_<GEN>_<ID>`, containing that mod's objects and
  nothing else.
- **Mesh datablocks:** same name as their object. No `Cube.003` anywhere — hard
  fail, checked by `validate-mod.mjs`.

**`.gitignore` currently excludes `public/assets/**/*.glb`.** Mod GLBs are
generated locally and cannot be fetched from anywhere, so they must be committed
via an explicit un-ignore, exactly as the car itself is. Add it before the first
export or the assets silently never reach CI.

**Attribution.** Any mod whose geometry is derived from a base mesh (Tier 3,
§7.0) is a *derivative work* of a CC-BY asset. `ATTRIBUTION.md` currently says
both cars are "Used unmodified." That stops being true for those mods. CC-BY
permits it, but requires the credit and an indication that changes were made —
update `ATTRIBUTION.md` and the relevant `assetManifest.json` entry in the same
commit as the first Tier 3 mod. Tier 1 and 2 mods are original geometry and raise
no such issue.

**Names.** Ship generic descriptive display names for *new* catalogue entries and
put no trademarked badge, logo or lettering in any geometry. Note that
`carData.json` **already ships** "Volk TE37", "Enkei RPF1", "BBS Mesh",
"Watanabe RS-8" as wheel-style display names. That is a pre-existing decision, not
something to change unilaterally — flag it, leave it, and do not add to it.

---

## 5. Geometry standards

- **Transforms applied** (`Ctrl+A → All Transforms`). Object origin at `(0,0,0)`
  for body mods; at the **contact patch** for wheels (§2.2).
- **Modifiers applied** before export — Mirror, Array, Subsurf, Solidify. No
  unapplied Bevel with a shade-auto-smooth dependency.
- Quads preferred, tris allowed, **no n-gons on visible curved surfaces**.
- Normals recalculated outside. No flipped faces, no interior faces, no doubled
  verts (`Merge by Distance` at 0.0001 m).
- Shade Smooth + Smooth by Angle 30°. A 1–2 mm bevel on every hard edge that
  catches a highlight; untouched razor edges are the #1 reason a render reads as
  a placeholder.
- **Nothing may occupy the same volume as the base car.** Bolt-ons sit
  **0.5–1 mm proud** of their host surface — never coplanar (z-fighting), never
  gapped. Replacements sit exactly where the hidden OEM part sat.
- Real thickness: lips/splitters 8–12 mm, wing elements 18–25 mm, over-fenders
  4 mm, roll bar tube 38 mm OD × 2.5 mm wall.
- Every object needs a non-overlapping UV map. Carbon parts need world-scale UVs
  (~50 mm per weave tile) so the weave does not change size between panels.
- Triangle budgets are per-mod totals, given in §7. +20% is fine; 3× is not.
- **Target ≤ 2 MB per `.glb`.** The app caps DPR at 2 and re-bakes a contact
  shadow on every config change; a 60 k-tri mod is a frame-rate problem, not just
  a download.

---

## 6. Working method

The previous revision said "write Python in chunks under ~120 lines, long MCP
payloads fail silently." Correct diagnosis, wrong fix. **Write the build script
to a file and have Blender execute the file:**

```python
exec(open(r"C:/Users/Damon/car-configurator/blender/mods/W01_race7spoke.py").read())
```

That is a one-line MCP payload regardless of script size, and the script is
committed, diffable and re-runnable. Use `Write`/`Edit` for the script, and
`mcp__blender__execute_blender_code` only to run it and to read results back.

### 6.1 `mx5_lib.py` — write this first

Run it into Blender once per session. It exposes:

| Function | Contract |
|---|---|
| `load_reference(gen)` | imports the base glTF and applies `frame()` from `anchors.json`, so the reference car sits in Blender exactly as in the app. Locked, unselectable, on its own collection. |
| `anchor(gen, node_name)` | returns a measured node's bbox from `anchors.json`, in **metres, Blender axes** |
| `app_to_blender(x, y, z)` | mm app space → m Blender space |
| `start_mod(gen, mod_id)` | creates/clears the collection, returns it |
| `mat(name)` | get-or-create a §3 material with sensible Principled values; refuses a name not in the table |
| `assign(obj, name, faces=None)` | material assignment by face selection |
| `bevel_smooth(obj, width=0.0015, angle=30)` | |
| `mirror_x(obj, about=0.0)` | mirror + apply; `about` defaults per generation (NA = −0.007) |
| `stats(collection)` | bbox min/max in mm **app space**, tri count, material list, loose verts, non-manifold count |
| `export_glb(gen, mod_id)` | exports that collection only, correct settings, to `public/assets/mods/<gen>/` |

Prove each helper on a throwaway cube before using it on a real asset.

### 6.2 Per-mod loop

1. Restate the mod's fixing points and key dimensions in your own words, citing
   the measured anchors you will use. If the recipe is ambiguous for this
   specific base mesh, say so and propose a resolution rather than guessing.
2. Write `blender/mods/<ID>_<name>.py`. Explicit numeric coordinates read from
   `anchor()`; no magic values.
3. Run it. Run `stats()`. 
4. Export the `.glb`, add the `modsData.json` entry, run
   `node scripts/validate-mod.mjs <ID>` — the automated §10 checklist.
5. Render three viewport screenshots (front-3/4, rear-3/4, top) **with the
   reference car visible** and look at them. Critique your own result against the
   §7 description: silhouette, proportion, anything floating, whether edges catch
   light. Fix and repeat from 3.
6. Load it in the app and screenshot it there. The Blender viewport is not the
   renderer that ships.
7. Only then move to the next mod.

Steps 3–4 are machine-checkable and must pass before step 5 is worth doing.

---

## 7. Mod catalogue

Each entry gives **Fits · Type · Slot · Anchors · Build · Materials · Tri budget
· Pitfalls**. `REPLACE` hides base nodes and takes their place; `BOLT_ON` is
purely additive.

### 7.0 Tiers — read before picking anything up

| Tier | Definition | Risk |
|---|---|---|
| **1** | Free-standing geometry placed at a measured anchor. Touches nothing on the base mesh but proximity. | Low. Build these first. |
| **2** | Free-standing, but must *visually* follow a base surface (sits flush on a curved panel). Needs a shrinkwrap-and-apply against the reference, not topology extraction. | Medium. |
| **3** | Must reproduce a base part's shut lines or fill a hole left by hiding one. Requires deriving topology from the base mesh. | **High — this is the operation `CONFORM_POSTMORTEM.md` records failing.** Do not start a Tier 3 mod until Tiers 1 and 2 are shipped and the app-side pipeline is proven. |

- **Tier 1:** all `W` wheels, `RA02`, `RA03`, `FA03`, `FA05`, `FA06`, `DT01`,
  `DT02`, `DT04`, `DT06`, `DT07`, `DT08`, all `EX`, all `SU`, `RB01`, `RB02`,
  `RB05`, `RB06`.
- **Tier 2:** `FA01`, `FA02`, `FA07`, `RA01`, `RA04`, `RA05`, `RA06`, `DT03`,
  `RB03`, `RB04`.
- **Tier 3:** `FA04`, `RA07`, `BP01`, `BP02`, `BP03`, `BP04`, `BP05`, `BP06`,
  `DT05`.

### 7.1 Slot mapping — the app already has slots, use them

`CarConfig` (`src/config/types.ts`) and `carData.json` already define these
aero slots, each with catalogue ids that are currently **inert** because the
assets have no aero parts. A mod that adopts an existing id makes an existing
control work end to end, with no schema change:

| `CarConfig` field | `carData.json` ids already present | Mods that fit |
|---|---|---|
| `frontLip` | `stock`, `club_lip`, `aggressive_splitter` | FA01 → `club_lip`, FA03 → `aggressive_splitter` |
| `sideSkirts` | `stock`, `oem_extensions`, `carbon_extenders` | RA06 |
| `rearDiffuser` | `stock`, `oem_diffuser`, `track_diffuser` | RA04 |
| `rearWing` | `wing_delete`, `oem_ducktail`, `oem_lip`, `gt_wing` | RA01 → `oem_ducktail`, RA05 → `oem_lip`, RA02 → `gt_wing` |
| `hood` | `stock`, `vented_carbon`, `painted_vented` | BP01 |
| `exhaust` | `stock_single`, `oem_dual`, `titanium_quad`, `big_bore_single` | EX01/EX02/EX03/EX06 |
| `rollBar` | `none`, `style_bar`, `track_hoop` | RB01 → `style_bar`, RB02 → `track_hoop` |
| `wheelStyle` | `oem_17_design`, `oem_16_silver`, `rays_te37`, `enkei_rpf1`, `bbs_mesh`, `watanabe_rs` | W01–W08 |
| `caliperColor` | inert, no calipers exist | any `W` mod that ships a caliper |

**No slot exists** for canards, tow hooks, mirrors, antennas, over-fenders,
hardtops, bonnet hardware, tonneau or wind deflector. Those need new `CarConfig`
fields, new `carData.json` slots, new UI controls and new URL-codec keys —
roughly a day of app work each batch. **Phase 1 ships only mods that map onto an
existing slot.** Everything else waits for a deliberate schema extension.

### 7.2 Wheels (`W`) — REPLACE, slot `wheelStyle`

**Universal wheel rules:**

- **Origin at the contact patch** (§2.2), wheel axis along X, modelled for the
  **left** side. Not the hub face.
- Outer tyre diameter **must match the measured base wheel**: **641 mm on the ND,
  606 mm on the NA**. The app scales the pivot by `selectedDiameter /
  defaultWheelDiameter`, so a mod authored at the wrong overall diameter shifts
  the whole car's ride height.
- Model **rim + tyre + brake disc + caliper** as four objects. Build the disc and
  caliper once as `DISC_<GEN>` / `CALIPER_<GEN>` and reuse.
- **Rim barrel:** build a 2D cross-section profile (outer lip → outer bead seat →
  drop centre → inner bead seat → inner lip) and spin it 360° about X with 48–64
  segments. Do not extrude a cylinder and hope.
- **Spokes must physically bridge hub to rim.** Each spoke starts on the hub face
  disc (radius ~55–75 mm) and terminates *merged into the inner face of the outer
  rim lip*. A spoke stopping 5 mm short reads as broken in every render. Boolean
  union or bridge-edge-loop — actually join them.
- **Dish/offset:** the hub face plane sits at `X = width/2 − offset` from the
  wheel centreline. Lower offset ⇒ hub face further inboard ⇒ more visible dish.
  This is the single biggest visual difference between a track wheel and a stance
  wheel.
- Centre bore 54.1 mm ⌀, 4 lug holes on 100 mm PCD (50 mm radius) at 0/90/180/270°.
  Lug nuts as small hex frustums in countersunk pockets.
- **Tyre:** separate object, `MOD_Rubber`. Bead at rim diameter, sidewall bulging
  ~6 mm beyond rim width at mid-height, square-ish shoulder, tread band with a
  shallow 2 mm longitudinal groove pattern — no individual tread blocks. Raised
  sidewall lettering only as a 0.6 mm extrusion, **no brand text**.
- **Contact patch:** flatten the bottom ~40 mm of the tyre by 3 mm.
- Tri budget per assembly: **12k–18k** (rim 6–9k, tyre 4k, disc 1k, caliper 1.5k).
- Materials: `MOD_Rim` (face and lip), `MOD_Rubber`, `MOD_Chrome` (disc),
  `MOD_CaliperPaint`. Where a design wants a two-tone face/lip, use `MOD_Rim` for
  the face and `MOD_Alloy` for the lip — `MOD_Rim` is the one the wheel-finish
  picker drives.

| ID | Display name | Reference look | Sizes (NA / ND) | Character |
|---|---|---|---|---|
| `W01` | Lightweight Race 7-Spoke | RPF1-ish | 15×8 ET28 / 17×9 ET35 | Flat face, 7 straight tapered spokes, raised centre rib, deep lug pockets, small centre cap. |
| `W02` | Split 6-Spoke | Rota Grid-ish | 15×8 ET20 / 17×8 ET30 | 6 spokes forking into 12 at the rim. Mild concavity, ~15 mm outer lip. |
| `W03` | Flow-Form 10-Spoke | Hypergram-ish | 15×9 ET36 / 17×9 ET25 | 10 very thin (14 mm) spokes, strongly concave, arcing outboard then back. Make the arc obvious. |
| `W04` | Deep Dish 8-Spoke | RS-8-ish | 15×8 ET0 / — | Flat 8-spoke face set far inboard, **50 mm+ polished outer lip**, 24 exposed lip bolts, stepped inner barrel. |
| `W05` | Classic Mesh | Panasport-ish | 15×7 ET25 / 16×8 ET35 | 8 spokes with fine mesh webbing. Build one 45° wedge and circular-array it — never 200 individual struts. |
| `W06` | Two-Piece Turbofan Dish | Meister-ish | 15×8 ET15 / 17×9 ET20 | Straight 12-spoke flat face + separate barrel, 30 mm stepped lip, visible hardware. |
| `W07` | Forged 6-Spoke Concave | TE37-ish | 15×9 ET35 / 17×9 ET25 | Six wide flat-topped spokes, chamfered edges, machined dimples near the hub, prominent cap. Rounded-trapezoid spoke section, not a box. |
| `W08` | OEM ND 17" Design | — | — / 17×7 ET45 | 10 thin split spokes, gunmetal. The ND's null option. |

Also `W00_stock_na` — the NA 14×6 seven-spoke OEM wheel — as the NA null option.

**Sizing:** expose 15/16/17" per design where listed, tyre profiles 15" → 195/50
or 205/50, 16" → 205/45, 17" → 205/45 or 235/40. Keep rolling diameter within
±15 mm of the **measured** stock so the ride-height maths does not break.

> Note the app's known limitation: wheel scaling scales rim *and* tyre together,
> so this is a bigger wheel with the same tyre, not true plus-sizing. A wheel mod
> does not change that — it inherits the same pivot scaling.

### 7.3 Front aero (`FA`)

| ID | Display name | Fits | Type | Slot | Tier |
|---|---|---|---|---|---|
| `FA01` | OEM+ Front Lip | NA, ND | BOLT_ON | `frontLip` / `club_lip` | 2 |
| `FA02` | Street Lip Spoiler (deep) | NA, ND | BOLT_ON | `frontLip` | 2 |
| `FA03` | Race Splitter + Support Rods | NA, ND | BOLT_ON | `frontLip` / `aggressive_splitter` | 1 |
| `FA04` | Type-2 Front Bumper | NA | REPLACE | *(no slot)* | 3 |
| `FA05` | Dive Planes / Canards | NA, ND | BOLT_ON | *(no slot)* | 1 |
| `FA06` | Tow Hook | NA, ND | BOLT_ON | *(no slot)* | 1 |
| `FA07` | Mesh Grille Insert | NA, ND | REPLACE | *(no slot)* | 2 |

**`FA01` — OEM+ Front Lip.** Shrinkwrap a swept profile onto the bumper's lower
edge rather than extracting its loop: build a curve following the bumper's
plan-view outline at the measured lower edge (ND: y ≈ 169, z ≈ 1839…1937), sweep
a 55 mm-drop × 25 mm-forward section along it with an 8° outward flare, solidify
9 mm, bevel 2 mm. Shrinkwrap the top edge onto the bumper and **apply**, then
push 0.7 mm proud. Ends must wrap into the wheel-arch opening, not stop
mid-bumper. Materials: `MOD_BodyPaint`, `MOD_SatinBlack` variant. 3k tris.

**`FA02` — Street Lip Spoiler (deep).** As FA01 but 110 mm drop, 20 mm
forward-projecting leading edge, a full-width horizontal step ridge 40 mm below
the join, ends sweeping up into the arch. Two 60×25 mm brake-duct openings at
X ±430, cut through the full 9 mm — an inlet that doesn't go anywhere reads as
fake. Materials: `MOD_BodyPaint`; carbon variant swaps to `MOD_CarbonWeave`.
6k tris.

**`FA03` — Race Splitter + Support Rods.** *(Tier 1 — start the FA category
here.)* A flat 12 mm plate on a level plane, projecting ~95 mm forward of the
bumper, following the bumper's plan outline plus a straight leading edge with
25 mm radiused corners. **ND: plate at Y = 150** (the bumper's lowest point is
168; the old brief's Z = 110 predates measurement), front edge at Z ≈ 2050.
Two 10 mm ⌀ rods from the plate top face up to bumper mount tabs — **the rods
must intersect both surfaces, not float between them**. 4 washer/bolt discs where
rods meet plate. Materials: `MOD_CarbonWeave` or `MOD_SatinBlack`, rods
`MOD_Alloy`. 4k tris. **Pitfall:** the plate must be flat and level, not
following the bumper's curve downward — that is the entire point of a splitter.

**`FA04` — Type-2 Front Bumper (NA).** *(Tier 3.)* Full bumper replacement:
hides `frontbumper_Material #71_0`, and must reproduce its mounting flange and
the pop-up headlight cutouts exactly. Lower leading edge 40 mm, central intake
720×140 mm with 15 mm surround, two 220×110 mm outer intakes at X ±480,
integrated FA02-form lip as one continuous surface. Incompatible with FA01–FA03.
Materials: `MOD_BodyPaint`, `MOD_Mesh`, `MOD_GlossBlack`. 12k tris.

**`FA05` — Dive Planes / Canards.** One canard = 190×85 mm curved plate, 6 mm
thick, 12 mm upturned outer edge, swept back 25°, angled 12° nose-up. Two per
side, 70 mm vertical gap, on the bumper corner face. **The inboard edge must be
coincident with the bumper** — model oversized and intersect 3 mm into the body.
`MOD_CarbonWeave`. 1.5k tris the set.

**`FA06` — Tow Hook.** 12 mm-thick, 140 mm-long tapered plate, 45 mm ⌀ hole at
the outer end, protruding forward and slightly outboard, plus a bolt boss where
it meets the bumper. 4 mm chamfer around the eye. `MOD_AccentPaint` (these are
always anodised — make it recolourable). 800 tris.

**`FA07` — Mesh Grille Insert.** A single subdivided plane conforming to the
intake aperture, 20 mm behind the bumper face, alpha-clip diamond-mesh texture,
10 mm `MOD_GlossBlack` surround. **Do not model the mesh as geometry.**
400 tris.

### 7.4 Rear & side aero (`RA`)

| ID | Display name | Fits | Type | Slot | Tier |
|---|---|---|---|---|---|
| `RA01` | Ducktail Spoiler | NA, ND | BOLT_ON | `rearWing` / `oem_ducktail` | 2 |
| `RA02` | GT Wing (boot-mounted) | NA, ND | BOLT_ON | `rearWing` / `gt_wing` | 1 |
| `RA03` | Swan-Neck Big Wing | NA, ND | BOLT_ON | `rearWing` | 1 |
| `RA04` | Rear Diffuser (4-strake) | NA, ND | BOLT_ON | `rearDiffuser` / `track_diffuser` | 2 |
| `RA05` | OEM+ Lip Spoiler | NA, ND | BOLT_ON | `rearWing` / `oem_lip` | 2 |
| `RA06` | Side Skirts | NA, ND | BOLT_ON | `sideSkirts` | 2 |
| `RA07` | Over-Fenders (widebody) | NA, ND | BOLT_ON | *(no slot)* | 3 |

**`RA02` — GT Wing.** *(Tier 1, and the best first bolt-on: it touches the car
only at two base plates.)* Build in this order:

1. **Element** — single-plane aerofoil, chord 240 mm, thickness 22 mm, span
   **1400 mm**, 3° camber, 8° angle of attack. Extrude the profile along X, 4 mm
   leading-edge radius, sharp 1.5 mm trailing edge. **ND: centre at
   (0, 1320, −1700)** — the boot lid's top surface is at Y 918 and its rear edge
   at Z −1864, so this clears it by ~400 mm and sits inboard of the tail.
2. **Endplates** — 300×180 mm flat plates, 6 mm, at X ±700, vertical, wing's
   trailing corner cut flush, 40 mm forward-swept leading corner.
3. **Uprights** — 2 plates, 14 mm thick, 240 mm tall, tapering 150 mm chord at
   base to 90 mm at top, from the boot lid at X ±330, Z ≈ −1700 up to the
   element's underside. **The upright's top edge must be cut to the element's
   underside curve and merged into it**; the bottom sits on a 180×90×8 mm base
   plate lying flat on the boot lid.
4. **Hardware** — 4 bolt heads per base plate, 2 adjuster bolts per joint.

Base plates bolt through the boot lid at the measured surface. The wing must not
intersect the boot lid, and the boot must look able to open. Materials:
`MOD_AccentPaint` (element), `MOD_GlossBlack` (endplates), `MOD_Alloy`
(uprights), `MOD_Chrome` (hardware). 6k tris.
**Pitfall:** uprights floating above the boot lid, or a span exceeding body width
— cap span at body width minus 150 mm (**ND 1940 → 1790 max; NA 1830 → 1680**).

**`RA03` — Swan-Neck Big Wing.** As RA02, but uprights attach to the **top** of
the element and hook over it. Higher-camber section: chord 300 mm, thickness
30 mm, 12° AoA, span 1500 mm, mounted 40 mm higher. Uprights 16 mm curved plates
whose top ~90 mm bends 90° over the element and bolts through — model the bend as
a real 60 mm-radius fillet, not a mitre. Endplates 360×220 mm with a rectangular
cut-out. 8k tris.

**`RA01` — Ducktail Spoiler.** *(Tier 2.)* Front edge coincident with the boot
lid — shrinkwrap the front row of verts onto the reference boot surface and
apply. **ND: boot lid runs Z −1864…−1308 at Y 756…918**, so the ducktail occupies
the rear ~260 mm (Z −1864…−1600) and raises its trailing edge 85 mm. Front
tangent matches the boot lid exactly (0° step), rear tangent ~28° up. Solidify
10 mm with a rolled 5 mm under-return. Width tapers into the rear quarter
shoulders. Adhesive-mounted, so **the entire lower surface must kiss the boot
lid** — verify along the boot from the side at eye level.
**Pitfall:** a visible step at the front edge is the single most common failure.

**`RA05` — OEM+ Lip Spoiler.** A low RA01: 35 mm rise, 140 mm deep, 8 mm thick,
following the boot's trailing edge with a slight upward flick at the ends.
`MOD_BodyPaint`. 1.5k tris.

**`RA04` — Rear Diffuser (4-strake).** Base panel following the rear bumper's
underside, flat at the front and kicking **up at 12°** to the rear edge. **ND:
the rear bumper runs Y 191…753, Z −1957…−1303**, so start at Z −1820 / Y 260 and
finish at Z −2050 / Y 330. Width 1180 mm, tapering in 40 mm each side. Four
vertical strakes, 10 mm × 90 mm deep, at X 0, ±280, ±560, following the kick
angle. 15 mm rolled outer edge. Must tuck *behind* the bumper's bottom lip, not
sit on top of it, and must clear the exhaust tip — **the ND's tip is at
X −354…−220, Y 198…259, Z −1855…−1783**, i.e. off-centre to the vehicle's right,
so the cut-out is asymmetric. `MOD_CarbonWeave` or `MOD_SatinBlack`. 4k tris.

**`RA06` — Side Skirts.** **ND rocker sill: X ±855, Y 161…390, Z −781…841.**
Sweep a section along that lower edge, extruding down 60 mm and out 25 mm, with a
horizontal step ridge and a 12° inward-angled lower face. Solidify 10 mm. **Both
ends must terminate flush into the arch openings.** Mirror across X (NA: about
X = −7). `MOD_BodyPaint` / `MOD_SatinBlack` variant. 4k tris the pair.
**NA blocker:** no rocker-sill node was found by name in the NA asset. Locate it
visually first, or ship ND-only.

**`RA07` — Over-Fenders.** *(Tier 3.)* Requires the arch opening edge loop, which
means base-mesh derivation. **On the NA it is worse than that: both front fenders
are a single mesh (`f fender_Material #71_0`, X −859…845) and both rears are
another.** Nothing can be hidden or flared per side. Offset the arch outward
+45 mm front / +55 mm rear, flared band 140 mm wide, tangent to the body 140 mm
from the opening, solidify 4 mm, roll the outer edge 8 mm inward, 12 rivet bosses
20 mm in from the edge. Intersect 2 mm into the body all round. Flag
`trackWidening: 40` so the configurator can offer offsets that would otherwise
clip. 10k tris the set.

### 7.5 Body panels (`BP`) — all Tier 3

Every mod here hides an OEM panel and must reproduce its shut lines. **Do not
start these until Tiers 1–2 are shipped**, and re-read `CONFORM_POSTMORTEM.md`
first. `BP05` (fixed headlight conversion) additionally requires *filling* the
pop-up bays — surfacing over a hole left by a hidden part, which is the hardest
thing in the catalogue and the least likely to look right.

| ID | Display name | Fits | Hides | Tri budget |
|---|---|---|---|---|
| `BP01` | Vented Carbon Bonnet | NA, ND | ND `Hood 6.001_120` / NA `hood_Material #71_0` | 12k |
| `BP02` | Cowl / Double-Bubble Bonnet | NA | `hood_Material #71_0` | 10k |
| `BP03` | NACA-Duct Bonnet | NA, ND | as BP01 | 9k |
| `BP04` | Carbon Boot Lid | NA, ND | ND `Boot 6.001_157` / NA `trunk_Material #71_0` | 6k |
| `BP05` | Fixed Headlight Conversion | NA | `popuplight_Material #71_0` | 8k |
| `BP06` | Hardtop | NA, ND | ND `Roof 6_24`, `Roof 6.001_25`, `Roof 6.002_26`, `Roof 6.003_27` | 14k |

Recipes as previously specified, with two corrections:

- **`BP01` apertures.** The ND bonnet measures X ±721, Y 582…864, Z 423…1800.
  Two 300×160 mm apertures centred at (±330, ~840, 1180) sit comfortably within
  it. Louvre stack: 5 blades, 300×45 mm, 4 mm thick, 35° rearward-up, 32 mm
  spacing, leading edges recessed 20 mm below the surface, 10 mm surround lip.
  **The blades must span the full aperture and attach to the surround at both
  ends** — floating slats are the classic failure. UV the carbon so the weave
  runs longitudinally and is continuous.
- **`BP06` interacts with existing app behaviour.** The ND's roof is already
  hideable — `CarModel.setRoofUp()` hides the whole roof part *and* the roof
  lining split out of the cabin mesh (`ROOF_LINING_WIP.md`). A hardtop must reuse
  that mechanism, not invent a second one. **The NA asset has no soft top at all**
  (it ships roof-down), so a hardtop on the NA has nothing to hide — it just
  bolts on, and needs its own header-rail fit against `Apillar_Material #71_0`
  (X ±715, Y 768…1168, Z −24…465).

### 7.6 Exterior details (`DT`)

None of these has an app slot yet (§7.1). They are cheap and high-payoff, so they
are the strongest argument for the first schema extension — but they cannot ship
before it.

| ID | Display name | Fits | Type | Tier |
|---|---|---|---|---|
| `DT01` | Stubby Antenna | ND (NA: locate first) | REPLACE | 1 |
| `DT02` | Antenna Delete Plug | ND | REPLACE | 1 |
| `DT03` | Aero Mirrors (teardrop) | NA, ND | REPLACE | 2 |
| `DT04` | Race Mirrors (stalk-mounted) | NA, ND | REPLACE | 1 |
| `DT05` | Carbon Mirror Caps | ND | REPLACE | 3 |
| `DT06` | Bonnet Dampers | NA, ND | BOLT_ON | 1 |
| `DT07` | Bonnet Pins | NA, ND | BOLT_ON | 1 |
| `DT08` | Tow Strap (rear) | NA, ND | BOLT_ON | 1 |

**`DT01`/`DT02` — Antenna.** *The previous revision guessed the ND antenna at
(690, −1450, 1090) and flagged "verify side". Measured, it is at X −587…−575 —
the vehicle's **right**, not left — with the mast running Y 989…1371 at
Z −1671…−1571 (`FendersR 6.002_41`), on a housing `FendersR 6_39` reaching down
to Y 819.* DT01 is a tapered cylinder 32 mm ⌀ → 12 mm over **95 mm**, 14 shallow
helical grooves, on a 40 mm ⌀ × 8 mm rubber base gasket, raked 20° rearward and
tilted to the panel's local normal. The gasket must sit **flush against the
curved quarter panel** — shrinkwrap its bottom face and apply. `MOD_SatinBlack` +
`MOD_Rubber`, 600 tris. DT02 is a 28 mm ⌀ domed disc 4 mm proud, `MOD_BodyPaint`,
200 tris. **No NA antenna node was found — locate it before building either.**

**`DT03` — Aero Mirrors.** ND mirror head measures X 783…970, Y 824…936,
Z −3…158; base X 767…829, Y 744…816, Z 46…163. Head = teardrop 180×105×75 mm,
widest at the front, flat rear face with a 150×90 mm convex glass panel (2 mm
proud, 400 mm convex radius). Stalk = swept 30×22 mm oval arm, 90 mm, outward and
forward at 15° rise. Base = 90×60 mm triangular foot conformed to the door skin —
**coincident, no daylight**. Mirror across X, and **rotate rather than mirror the
glass** so it faces rearward on both sides. `MOD_BodyPaint` (or `MOD_CarbonWeave`)
+ `MOD_MirrorGlass`. 3k tris the pair.

**`DT04` — Race Mirrors.** 130×80×50 mm rounded rectangular head with a slight
forward taper, on a 16 mm ⌀ round stalk 120 mm long, 25° up and 30° out, from a
70 mm ⌀ base plate. Glass fills 90% of the rear face. `MOD_AccentPaint` +
`MOD_GlossBlack` + `MOD_MirrorGlass`. 2k tris the pair.

**`DT05` — Carbon Mirror Caps (ND).** *(Tier 3 — it must hug the OEM shape
exactly, which means duplicating and offsetting the base surface.)* Offset the
OEM mirror head's outer surface 1.5 mm outward, solidify 2 mm, trim to the cap
parting line. `MOD_CarbonWeave`. 1.5k tris the pair.

**`DT06` — Bonnet Dampers.** Per side, a two-stage gas strut: 20 mm ⌀ body
190 mm + 12 mm ⌀ rod 150 mm extended, ball-socket ends. **Both ends must
terminate in visible ball-joint cups touching their mount brackets.** Only
visible with the bonnet open, which this app never does — **supply the closed
pose, compressed, and skip the open variant** until bonnet animation exists.
`MOD_AccentPaint` + `MOD_Chrome`. 1.2k tris the pair.

**`DT07` — Bonnet Pins.** Per pin: 55×55 mm base plate flush to the bonnet, a
10 mm ⌀ × 40 mm post through it, a hinged locking pin through a cross-hole, and a
300 mm lanyard (thin bevelled curve) to a second anchor plate 120 mm away. Place
on the measured bonnet surface (ND: Y ≈ 850 near Z 1700). `MOD_AccentPaint` +
`MOD_SatinBlack`. 1.5k tris the pair.

**`DT08` — Tow Strap (rear).** A 45 mm-wide, 3 mm-thick woven band, 210 mm long,
doubled through a stitched eyelet, hanging from a bolt boss under the rear bumper
with a natural sag (2–3 verts of curve, not a straight bar). `MOD_AccentPaint`.
500 tris.

### 7.7 Exhaust (`EX`) — REPLACE, slot `exhaust`

**Universal:** the app only shows the last ~700 mm plus the tips, but model the
visible run properly — a mandrel-bent pipe (Bézier curve + 30 mm ⌀ circle bevel,
12 segments, applied) from the muffler to the tip. **Every tip must be hollow:**
cut the end face and inset a 25 mm-deep sleeve with `MOD_SatinBlack` inside, or
it reads as a solid rod. Tips clear the bumper cut-out by 12–18 mm all round and
never intersect the bumper or a fitted diffuser.

**ND tip position is measured and off-centre:** X −354…−220 (vehicle right),
Y 198…259, Z −1855…−1783. `EX03`'s symmetric quad arrangement therefore does not
sit where the OEM tips do — it needs the OEM `Exhausts` nodes hidden and its own
valance. **No exhaust node was found in the NA asset at all** — locate it
visually or ship the `EX` set ND-only.

| ID | Display name | Fits | Description |
|---|---|---|---|
| `EX01` | Single Round Tip Cat-Back | ND (NA TBC) | 100 mm ⌀ straight-cut polished tip, 140 mm long, 60 mm pipe, visible 500×140 mm oval muffler 320 mm ahead of the tip. |
| `EX02` | Twin Round Tips | ND (NA TBC) | Two 90 mm ⌀ tips, 110 mm apart, shared 560 mm oval muffler. **Exactly parallel and level** — misalignment is instantly visible. |
| `EX03` | Quad Centre-Exit | ND | Four 76 mm ⌀ tips, 2×2 at X ±95 / ±195, in a `MOD_GlossBlack` surround valance. Needs a bumper cut-out variant flag. |
| `EX04` | Burnt Titanium Tip | ND (NA TBC) | Single 115 mm ⌀ tip, slash-cut 15°, rolled outer edge, stepped weld bead 30 mm from the end. `MOD_Titanium` (blue/purple gradient, baked or vertex-colour ramp). |
| `EX05` | Side-Exit | NA | Blocked until the NA sill is located. 63 mm pipe along the sill, 90 mm ⌀ tip angled 10° out / 8° down, 200×120 mm heat shield above it. |
| `EX06` | Twin Oval Tips | ND (NA TBC) | 120×80 mm oval tips, 150 mm apart, straight-cut chrome, large chrome-tipped rear muffler. The "fast road" default. |

Materials: `MOD_Chrome` tips, `MOD_SatinBlack` muffler and pipe. 3k–6k tris each.

### 7.8 Suspension & stance (`SU`)

**This category is mostly data, and most of it already works.** The app's
`stancePresets` in `carData.json` and `CarConfig.rideHeight` / `camber` /
`trackOffset` already drive the car — `setStance()` lowers the body, tilts each
wheel about its contact patch, and slides the pivots outboard. **Do not re-specify
that behaviour in the manifest; it exists.** What is missing is only the *visible
hardware*, and it is visible only through the spokes.

| ID | Display name | Drop | Camber F/R | Hardware to model |
|---|---|---|---|---|
| `SU00` | Stock | 0 | −0.5° / −1.0° | none |
| `SU01` | Lowering Springs | −25 | −1.0° / −1.5° | shorter progressive spring, 12 mm wire, 7 coils, `MOD_AccentPaint` |
| `SU02` | Coilovers (street) | −45 | −1.5° / −2.0° | full assembly (below) |
| `SU03` | Coilovers (track) | −55 | −2.5° / −2.0° | as SU02 + camber-adjustable top mount (slotted plate, spherical bearing) |
| `SU04` | Slammed / Stance | −75 | −4.0° / −3.5° | as SU02, `requiresFenderRoll: true`, pairs with W04/W06 |
| `SU05` | Raised / Rally | +30 | −0.5° / −0.5° | + sump guard plate 900×600×6 mm, `MOD_Alloy` |

Build `SU_COILOVER_ASSY` **once** and reuse with different spring lengths and
perch positions: 60 mm ⌀ threaded shock body with a real helical thread groove,
adjustable perch collar (two knurled rings), 65 mm ⌀ × 180 mm spring (8 coils),
top hat with 3 bolts, damper rod, lower fork bracket with two bolt holes. The
spring must be a real swept helix (curve + circle bevel), not a stack of tori.
4k tris.

Note the app's existing `stancePresets` use different numbers (`sport` −30,
`coilover` −55, and a `spacer` field). Reconcile with the catalogue rather than
adding a parallel set — a second source of truth for ride height is a bug
waiting to happen.

### 7.9 Roll bar & roof (`RB`)

**Before anything here: identify `Tube003_Material #123_0` on the NA** (§1.2). It
occupies the roll-bar volume and reaches 1570 mm.

**Universal:** all tube 38 mm OD, 2.5 mm wall — a curve with a circle bevel,
ends **capped or welded into footplates**. Every tube end terminates in a
100×100×6 mm footplate with 4 bolt holes, flat on the floor or rear bulkhead.
**A tube ending in mid-air is an automatic fail.** Where two tubes meet they must
intersect and be joined (Boolean union + small fillet), not merely touch.

| ID | Display name | Fits | Slot | Tier |
|---|---|---|---|---|
| `RB01` | Single-Hoop Roll Bar | NA, ND | `rollBar` / `style_bar` | 1 |
| `RB02` | Double-Hoop + Harness Bar | NA, ND | `rollBar` / `track_hoop` | 1 |
| `RB03` | Bolt-In Half Cage | NA | `rollBar` | 2 |
| `RB04` | Roof Duckbill Lip | NA, ND | *(no slot)* | 2 |
| `RB05` | Tonneau / Soft Top Cover | NA, ND | *(no slot)* | 1 |
| `RB06` | Wind Deflector | NA, ND | *(no slot)* | 1 |

**`RB01`** — main hoop rising to Y 1120 (just above the seat backs, below the
folded soft-top line), 470 mm bend radius, mirrored, plus two rear stays running
back and down at 40° to footplates. `MOD_AccentPaint` with a `MOD_Chrome`
variant. 5k tris.
**`RB02`** — two parallel hoops 140 mm apart, joined by a horizontal harness bar
at Y 950 and two short top spacers. Same rear stays. 8k tris.
**`RB03`** — main hoop + harness bar + two A-pillar-following diagonals running
forward to footplates, plus an X-brace between the rear stays. Follows the
cabin's inner surface with a 25 mm gap; must not intersect the door aperture or
the windscreen header (**NA A-pillar: X ±715, Y 768…1168, Z −24…465**). 12k tris.
**`RB04`** — 40 mm-tall lip along a hardtop's rear edge, 8 mm thick, 900 mm span,
swept up 20°. **Requires `BP06`** — flag the dependency. `MOD_CarbonWeave`. 1k.
**`RB05`** — soft-look panel over the folded top well, 1180×420 mm, slight sag
(centre pulled down 12 mm), stitched 8 mm perimeter seam, 8 press-stud discs.
`MOD_SatinBlack` at roughness 0.85. 1.5k tris.
**`RB06`** — 900×280 mm clear panel between the hoops, 20 mm `MOD_SatinBlack`
frame, two brackets. `MOD_Glass` with a slight tint. 800 tris.

---

## 8. `modsData.json` — the catalogue the app reads

There is already an `src/data/assetManifest.json` (a **licence ledger**) and a
`carData.json` (the **option catalogue**). Do not add a third `manifest.json`
under `/assets` — it would be a fourth source of truth. Mods go in
**`src/data/modsData.json`**, typed in `src/data/schema.ts` alongside the others.

```jsonc
{
  "version": 1,
  "mods": [
    {
      "id": "RA02",
      "gen": ["na", "nd"],
      "category": "rear_aero",
      "displayName": "GT Wing",
      // Which existing CarConfig field and option id this mod IS. Null for a
      // mod with no slot yet — it cannot ship until one exists (§7.1).
      "slot": "rearWing",
      "optionId": "gt_wing",
      "attachType": "bolt_on",          // bolt_on | replace
      "attachTo": "body",               // body | wheel
      // Base-asset node names to switch off. Exact strings, per generation.
      "hides": { "na": [], "nd": [] },
      "incompatibleWith": ["RA01", "RA03", "RA05"],
      "requires": [],
      // Measured anchors this mod must reach — validate-mod.mjs checks the
      // exported bbox actually comes within tolerance of each one.
      "anchors": { "nd": ["Boot 6.001_157"], "na": ["trunk_Material #71_0"] },
      "materials": ["MOD_AccentPaint", "MOD_GlossBlack", "MOD_Alloy", "MOD_Chrome"],
      "bboxMm": { "nd": { "min": [-700, 1180, -1860], "max": [700, 1345, -1620] } },
      "triangles": { "nd": 5840 },
      "triangleBudget": 6000,
      "file": { "na": "assets/mods/na/RA02_gtwing.glb",
                "nd": "assets/mods/nd/RA02_gtwing.glb" },
      "flags": { "requiresFenderRoll": false, "trackWidening": 0 },
      "derivedFromBaseMesh": false      // true ⇒ ATTRIBUTION.md must be updated
    }
  ]
}
```

Per-generation values are objects keyed by generation, because the two cars are
different sizes and a single bbox would be a lie for one of them.

---

## 9. Automated verification

The per-mod checklist is a script, not a paragraph. Run it; paste its output.

```bash
node scripts/measure-asset.mjs --out blender/anchors.json
```
```bash
node scripts/validate-mod.mjs RA02
```

`validate-mod.mjs` checks, per generation, from the exported `.glb`:

- file exists, opens cleanly, **< 2 MB**
- object and mesh names match `MOD_<GEN>_<ID>_<part>`; **zero `.001`, `Cube`,
  `Material.00n` names**
- every material name is in the §3 table **and** classified in
  `surfaceClasses.json`
- triangle count within budget +20%
- exported bbox within ±5% of the declared `bboxMm`
- **every declared anchor is reached** — the mod's bbox must come within
  tolerance of each anchor node's box, which is the machine-checkable form of
  "nothing floats"
- `TEXCOORD_0` and `NORMAL` present on every primitive
- root node at identity transform (wheels: origin at the contact patch)

What it cannot check, and you still must do by eye:

- loose verts, non-manifold edges, flipped normals → `stats()` in Blender
- 0.5–1 mm proud vs coplanar vs gapped → wireframe side view against the
  reference car
- silhouette, proportion, whether edges catch light → three viewport renders
  **plus one screenshot from the running app**

---

## 10. Build order

Each stage de-risks the next. Do not reorder.

**Phase 0 — the pipeline (no mod geometry at all).**
1. `node scripts/measure-asset.mjs --out blender/anchors.json` — done; re-run
   whenever an asset changes.
2. App side: `src/three/modLoader.ts` + the `Mods` / `BodyMods` groups (§2),
   the `mods` table in `surfaceClasses.json` (§3), `modsData.json` + its types
   (§8), the `.gitignore` un-ignore for `public/assets/mods/**` (§4).
3. `blender/mx5_lib.py` (§6.1), each helper proved on a throwaway cube.
4. **One throwaway cube, end to end**: built by a script, exported, validated,
   loaded by the app, visible in the right place, and recoloured by the existing
   paint picker because its material is named `MOD_BodyPaint`. Until this works,
   nothing else is worth building.

**Phase 1 — Tier 1 mods that map to an existing slot.**
5. Wheels `W08` (ND stock), `W00` (NA stock), `W01` — proves the wheel pipeline,
   the contact-patch origin, diameter scaling and rim recolour.
6. `RA02`, `RA03` — proves body-mounted bolt-ons and ride-height tracking.
7. `FA03`, `RB01`, `RB02`, `EX01`, `EX02`, `EX06` — fills existing slots.
8. Remaining wheels `W02`–`W07`.

**Phase 2 — Tier 2.**
9. `RA01`, `RA05`, `RA04`, `RA06`, `FA01`, `FA02` — shrinkwrap-and-apply against
   the reference. Each needs its own visual sign-off.
10. `SU_COILOVER_ASSY` + reconciled stance presets.

**Phase 3 — schema extension, then the rest.**
11. Add `CarConfig` fields, `carData.json` slots, UI controls and URL keys for
    mirrors, canards, tow hooks, antenna, tonneau, wind deflector.
12. `DT01`–`DT04`, `DT06`–`DT08`, `FA05`, `FA06`, `RB05`, `RB06`.

**Phase 4 — Tier 3, only if Phases 0–3 shipped clean.**
13. `BP01`, `BP04` first (simplest hide-and-replace), then the rest.
    Re-read `CONFORM_POSTMORTEM.md` before starting.

**Finally:** a full-catalogue regression render — every compatible mod fitted at
once to find intersections, then a matrix of the likely popular combinations.

---

## 11. Stop and ask

- The base mesh is missing, mis-scaled, or oriented differently from §1.
- A measured anchor moved by more than 30 mm from the table in §1.3 (i.e. an
  asset changed), or a named node no longer exists.
- `Tube003_Material #123_0` on the NA turns out to be a roll bar — the `RB`
  category needs re-scoping.
- A mod's spec would visually clash with the base car in a way this brief does
  not anticipate.
- You are about to exceed a tri budget by more than 2×.
- A mod needs a `CarConfig` field that does not exist and Phase 3 has not
  happened.
- Anything would require editing the base car asset. That is never the answer.
