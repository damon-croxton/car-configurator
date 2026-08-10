# MX-5 Configurator — Blender Mod Asset Brief

**Target:** NA (Mk1, 1989–1997) and ND (Mk4, 2015–) MX-5.
**Consumer:** a web/app configurator that swaps parts at runtime and recolours materials.
**Tooling:** Claude Code + Blender MCP (desktop Blender).

Read this file top to bottom before touching Blender. §1–§5 are binding rules for *every* asset. §6 is the mod catalogue.

---

## 1. Scene, units, axes, origin

| Setting | Value |
|---|---|
| Unit system | Metric, Unit Scale 1.0, Length = Metres |
| Modelling unit in this doc | **millimetres** — divide by 1000 for Blender values |
| +X | vehicle right (passenger side on a LHD car) |
| +Y | vehicle forward (nose) |
| +Z | up |
| World origin | ground plane, on the centreline, **mid-wheelbase** |

Every mod is modelled *in place on the car*, in world space, with its object origin left at `(0,0,0)`.
The app then instantiates it at identity transform and it lands exactly where it belongs.
**Exception:** wheels (see §6.1) — origin at the hub mounting face.

glTF export note: Blender `+Y forward` maps to glTF `-Z forward` with the default exporter settings, which is what three.js / react-three-fiber expects. Do not "fix" this by rotating the mesh.

### 1.1 Vehicle reference dimensions

| | NA | ND |
|---|---|---|
| Length / Width / Height (mm) | 3970 / 1675 / 1235 | 3915 / 1735 / 1230 |
| Wheelbase | 2265 | 2310 |
| Front / rear track | 1405 / 1425 | 1495 / 1505 |
| Front axle Y | +1132.5 | +1155 |
| Rear axle Y | −1132.5 | −1155 |
| Nose tip Y | +1867.5 | +1900 |
| Tail tip Y | −2102.5 | −2015 |
| Stock rolling radius (hub Z) | 288 (195/50R15) | 308 (205/45R17) |
| PCD / hub bore | 4×100 / 54.1 | 4×100 / 54.1 |

### 1.2 Anchor empties

Before modelling anything, create an empty per anchor in the base car `.blend`, named exactly as below, and use them as snap targets. Coordinates are **nominal targets** — if the base car mesh disagrees, snap to the mesh and update the manifest, don't force the number.

| Anchor name | NA (x, y, z) | ND (x, y, z) | Notes |
|---|---|---|---|
| `ANCH_HUB_FL` | (−702.5, 1132.5, 288) | (−747.5, 1155, 308) | mirror X for FR |
| `ANCH_HUB_RL` | (−712.5, −1132.5, 288) | (−752.5, −1155, 308) | mirror X for RR |
| `ANCH_BUMPER_F_LOWER` | (0, 1840, 300) | (0, 1875, 300) | lip/splitter mates here |
| `ANCH_BONNET_HINGE_L` | (−480, 560, 1005) | (−500, 600, 980) | mirror X |
| `ANCH_BONNET_NOSE` | (0, 1650, 830) | (0, 1690, 845) | front edge, centreline |
| `ANCH_BOOTLID_REAR` | (0, −1900, 1010) | (0, −1830, 1015) | ducktail / lip spoiler datum |
| `ANCH_WING_MOUNT_L` | (−330, −1700, 1040) | (−340, −1650, 1045) | wing upright bolt face, mirror X |
| `ANCH_MIRROR_L` | (−870, 330, 1080) | (−880, 380, 1050) | mirror X |
| `ANCH_ANTENNA` | (−760, −900, 1015) | (690, −1450, 1090) | **verify side on base mesh** |
| `ANCH_EXHAUST_TIP` | (330, −2060, 310) | (240, −1975, 300) | ND is a twin/centre exit |
| `ANCH_ROLLBAR_L` | (−480, −620, 620) | (−490, −640, 610) | behind seat, floor pan, mirror X |
| `ANCH_SILL_L` | (−800, −200, 250) | (−820, −200, 245) | side skirt datum, mirror X |
| `ANCH_TOWHOOK_F` | (−420, 1855, 420) | (−440, 1890, 430) | verify side |

---

## 2. Naming and file structure

```
/assets
  /na
    /wheels/W01_race7spoke.blend  → W01_race7spoke.glb
    /aero_front/FA02_streetlip.blend
    ...
  /nd
    ...
  /shared
    mx5_lib.py          ← helper module, written once (see §5)
    manifest.json       ← generated, consumed by the app
```

**IDs:** `<CAT><nn>` — e.g. `W03`, `FA02`, `RA05`, `BP01`, `EX04`, `SU03`, `RB02`, `DT06`.
**Object names:** `MOD_<GEN>_<ID>_<part>` → `MOD_NA_RA02_element`, `MOD_NA_RA02_upright_L`, `MOD_NA_RA02_endplate_R`.
**Collection per mod:** `MOD_<GEN>_<ID>` containing every object for that mod and nothing else.
**Mesh datablocks:** same as object name. No `Cube.003` anywhere in the final file — this is a hard fail.

Use generic descriptive display names in the app ("Deep Dish 8-Spoke", "Race Splitter", "Vented Carbon Bonnet"). The catalogue below cites real products only as visual reference — **do not ship trademarked brand or model names, badges, or logos.**

---

## 3. Materials — the recolour contract

The app recolours by **material slot name**, so slot names must be exact and consistent across every asset. Never create per-mod material names like `Carbon.001`.

| Slot name | Use | App-recolourable |
|---|---|---|
| `M_BodyPaint` | anything that would be painted body colour | ✅ driven by main colour picker |
| `M_AccentPaint` | secondary paint (wing element, mirror caps, stripes) | ✅ secondary picker |
| `M_WheelFace` | wheel spokes + centre | ✅ wheel colour picker |
| `M_WheelLip` | rim barrel / outer lip | ✅ (defaults = same as face) |
| `M_CaliperPaint` | brake calipers | ✅ |
| `M_CarbonWeave` | exposed carbon | ❌ (weave texture, gloss/satin variant) |
| `M_GlossBlack` | trim, endplates, grille surrounds | ❌ |
| `M_SatinBlack` | unpainted PU/ABS lips, splitters, diffusers | ❌ |
| `M_Rubber` | tyres, seals, bushes | ❌ |
| `M_Alloy` | raw/machined aluminium, uprights | ❌ |
| `M_ChromeSteel` | polished tips, bolts, roll bar tube | ❌ |
| `M_TitaniumBurn` | burnt Ti exhaust tips | ❌ |
| `M_Glass` | mirror glass, lenses | ❌ |
| `M_Mesh` | grille mesh (alpha-clipped plane) | ❌ |

Rules:
1. **Slot 0 is always the primary recolourable surface** of that mod. If a mod has no recolourable surface, slot 0 is its dominant material.
2. Assign by face selection *before* adding modifiers. Never rely on modifier-generated material indices.
3. Principled BSDF only. Base colour, metallic, roughness, normal. No procedural node trees that won't survive glTF export — bake anything clever.
4. Every material must exist in the file even if a variant doesn't use it? **No** — only include slots actually used. Unused slots break the app's slot-index assumptions.

---

## 4. Geometry standards

- **Scale, rotation, location applied** (`Ctrl+A → All Transforms`) except the deliberate object origin.
- Modifiers **applied** before export (Mirror, Array, Subsurf, Solidify). No unapplied Bevel with a shade-auto-smooth dependency.
- Quads preferred, tris allowed, **no n-gons on visible curved surfaces**.
- Normals recalculated outside. No flipped faces, no interior faces, no doubled verts (`Merge by Distance` at 0.0001 m).
- Shade Smooth + Smooth by Angle 30°. Add a 1–2 mm bevel to every hard edge that catches a highlight — untouched razor edges are the #1 reason a render looks like a placeholder.
- No object may occupy the same volume as the base car body ("z-fighting"): replacement parts must sit exactly where the removed part sat; bolt-ons must sit **0.5–1 mm proud** of the surface they bolt to.
- Thickness: real parts are not zero-thickness. Lips/splitters 8–12 mm, wing elements 18–25 mm, over-fenders 4 mm, roll bar tube 38 mm OD × 2.5 mm wall.
- UVs: every object needs a non-overlapping UV map. Carbon parts need consistent world-scale UVs (~50 mm per weave tile) so the weave doesn't change size between panels.
- Triangle budgets are per-mod totals, given in §6. Going 20% over is fine; going 3× over is not.

---

## 5. Working method with Blender MCP

The MCP bridge is literal-minded. Work like this:

1. **Write `mx5_lib.py` first**, before any mod, and run it into Blender once per session. It should expose:
   - `start_mod(gen, mod_id)` → creates/clears the collection, returns it
   - `mat(name)` → get-or-create a material from the §3 table with sensible Principled values
   - `assign(obj, name, faces=None)` → material slot assignment
   - `bevel_smooth(obj, width=0.0015, angle=30)` 
   - `mirror_x(obj)` → mirror modifier across world X, applied
   - `stats(collection)` → returns bbox min/max in mm, tri count, material slot list, loose-vert count
   - `export_glb(gen, mod_id)` → exports the collection only, correct settings
   - `anchor(name)` → returns the anchor empty's world coords
   Re-use it for every mod. Do not re-derive this logic per part.
2. **One mod per unit of work.** Build → `stats()` → render 3 viewport screenshots (front-3/4, rear-3/4, top) → self-critique against the spec → fix → export → append to `manifest.json`.
3. **Build from primitives + explicit numbers, not from vibes.** "Add a cylinder, radius 0.19, depth 0.203, 48 verts, at (−0.7025, 1.1325, 0.288), rotated 90° about Y" is a good instruction to yourself. "Model a nice wheel" is not.
4. **Always state the fixing points out loud in the code comments**: what bolts to what, and at which coordinates. Anything that visually floats is a bug.
5. **Verify before moving on.** The checklist in §7 is not optional.
6. If a step needs more than ~120 lines of Python, split it. Long MCP payloads fail silently more often than short ones.

---

## 6. Mod catalogue

Each entry gives: **Fits · Type · Slot · Anchors · Build · Materials · Tri budget · Pitfalls.**
- **Type** is `REPLACE` (occupies a slot, evicts the OEM part) or `BOLT_ON` (additive).
- Where a mod exists for both generations, build the NA version first, then re-fit for ND — the ND is wider and its surfaces are more curved; do not just scale it.

---

### 6.1 Wheels (`W`) — REPLACE, slot `wheels`

**Universal wheel rules (read once, apply to all 8):**

- Origin at the **hub mounting face centre**, wheel axis along **X**. The app positions and mirrors them; you model one wheel per design, facing +X (right-hand side), and set `Wheel is mirrored for LHS` in the manifest.
- Model **rim + tyre + brake disc + caliper** as four objects in the collection. The disc and caliper are shared geometry — build them once as `DISC_NA` / `CALIPER_NA` and link, don't rebuild per wheel.
- **Rim barrel**: build a 2D profile (the cross-section: outer lip → outer bead seat → drop centre → inner bead seat → inner lip) and spin it 360° around the X axis with 48–64 segments. Do not extrude a cylinder and hope.
- **Spokes must physically bridge hub to rim.** Each spoke starts on the hub face disc (radius ~55–75 mm from centre) and terminates *merged into the inner face of the outer rim lip*. A spoke that stops 5 mm short reads as broken in every render. Use a Boolean union or a bridge-edge-loop to actually join them.
- **Dish/offset**: the hub face plane sits at X = `width/2 − offset` measured from the wheel centreline. Lower offset ⇒ hub face further inboard ⇒ more visible dish. This is the single most important visual difference between "track wheel" and "stance wheel" — get it right per design.
- **Centre bore** 54.1 mm ⌀ through the hub face, plus **4 lug holes** on a 100 mm PCD (i.e. 50 mm radius) at 0°, 90°, 180°, 270°. Model lug nuts as small hex frustums seated in countersunk pockets.
- **Tyre**: separate object, `M_Rubber`. Profile: bead at rim diameter, sidewall bulging outward ~6 mm beyond the rim width at mid-height, square-ish shoulder, tread band with a shallow (2 mm) longitudinal groove pattern — do not model individual tread blocks. Add a raised sidewall lettering ring only as a subtle 0.6 mm extrusion.
- **Contact patch**: flatten the bottom ~40 mm of the tyre by 3 mm so it doesn't look like it's hovering.
- Tri budget per wheel assembly: **12k–18k** (rim 6–9k, tyre 4k, disc 1k, caliper 1.5k).

| ID | Display name | Reference look | Sizes (NA / ND) | Character |
|---|---|---|---|---|
| `W01` | Lightweight Race 7-Spoke | Enkei RPF1 | 15×8 ET28 / 17×9 ET35 | The default aftermarket Miata wheel. Flat face, 7 straight tapered spokes with a raised centre rib, deep lug pockets, small centre cap. |
| `W02` | Split 6-Spoke | Rota Grid | 15×8 ET20 / 17×8 ET30 | 6 spokes that fork into 12 at the rim. Mild concavity, visible outer lip ~15 mm. |
| `W03` | Flow-Form 10-Spoke | Konig Hypergram / Dekagram | 15×9 ET36 / 17×9 ET25 | 10 very thin (14 mm) spokes, strongly concave, spokes arc outboard from the hub then curve back to the rim. Thin spokes = big brake clearance; make the arc obvious. |
| `W04` | Deep Dish 8-Spoke | RS Watanabe RS-8 | 15×8 ET0 / n/a (NA only) | Classic. Flat 8-spoke face set far inboard, **50 mm+ polished outer lip**, exposed lip bolts (24 around the barrel), stepped inner barrel. Slot 0 = `M_WheelFace`, lip uses `M_WheelLip` set to polished alloy by default. |
| `W05` | Classic Mesh | Panasport C8 / Minilite | 15×7 ET25 / 16×8 ET35 | 8 spokes with fine mesh webbing between them. Build one 45° wedge of mesh, then circular-array it — never model 200 individual struts. |
| `W06` | Two-Piece Turbofan Dish | Work Meister / Longchamp | 15×8 ET15 / 17×9 ET20 | Straight multi-spoke (12) flat face + separate barrel with a 30 mm stepped lip and visible hardware. Face and lip in different material slots so the app can do "bronze face / polished lip". |
| `W07` | Forged 6-Spoke Concave | Volk TE37 | 15×9 ET35 / 17×9 ET25 | Six wide flat-topped spokes, chamfered edges, machined dimple pattern near the hub, prominent centre cap. Spoke cross-section is a rounded trapezoid, not a box. |
| `W08` | OEM ND 17" Design | Mazda ND Club | n/a / 17×7 ET45 | 10 thin split spokes, gunmetal. Include this as the "stock" baseline so the configurator has a null option. |

Also produce `W00_stock_na` — the NA 14×6 7-spoke/daisy OEM wheel — as the NA null option.

**Wheel-size axis for the app:** expose 15/16/17" per design where the table lists them, with matching tyre profiles (15" → 195/50 or 205/50, 16" → 205/45, 17" → 205/45 or 235/40). Rolling diameter must stay within ±15 mm of stock so ride height maths doesn't break.

---

### 6.2 Front aero (`FA`)

| ID | Display name | Fits | Type | Slot |
|---|---|---|---|---|
| `FA01` | OEM+ Front Lip | NA, ND | BOLT_ON | `front_lip` |
| `FA02` | Street Lip Spoiler (deep) | NA, ND | BOLT_ON | `front_lip` |
| `FA03` | Race Splitter + Support Rods | NA, ND | BOLT_ON | `front_lip` |
| `FA04` | Type-2 Front Bumper | NA | REPLACE | `front_bumper` |
| `FA05` | Dive Planes / Canards | NA, ND | BOLT_ON | `canards` |
| `FA06` | Tow Hook | NA, ND | BOLT_ON | `tow_hook_f` |
| `FA07` | Mesh Grille Insert | NA, ND | REPLACE | `grille` |

**`FA01` — OEM+ Front Lip** *(ref: Mazdaspeed / R-package lip)*
Build: take the bumper's lower edge curve from the base mesh (`Shift+G → Sharp Edges`, duplicate the loop, separate). Extrude that loop downward 55 mm and forward 25 mm, with a gentle 8° outward flare. Solidify 9 mm, bevel 2 mm all round. The top edge must **share the bumper's exact silhouette** — if it deviates you get a visible step.
Fixing: sits flush under the bumper lower lip, 0.5 mm proud; 6 clip bosses along the top face at Y = anchor, X = 0, ±280, ±540.
Materials: slot 0 `M_BodyPaint` (owners paint these), optional `M_SatinBlack` variant. Tri budget 3k.
Pitfall: don't let the lip's ends stop mid-bumper — they must wrap to the wheel arch opening.

**`FA02` — Street Lip Spoiler (deep)** *(ref: Garage Vary)*
Build: as FA01 but 110 mm drop, with a 20 mm forward-projecting leading edge, a horizontal step ridge running the full width at 40 mm below the join, and end sections that sweep up into the arch. Add two 60×25 mm brake-duct openings at X ±430 (cut through the full 9 mm thickness — an inlet that doesn't go anywhere reads as fake).
Fixing: same as FA01 plus 2 lower brackets to the front subframe at (±300, +1810, 250).
Materials: slot 0 `M_BodyPaint`; carbon variant swaps slot 0 to `M_CarbonWeave`. Tri budget 6k.

**`FA03` — Race Splitter + Support Rods**
Build: a flat 12 mm plate on a horizontal plane at Z = 110 mm, projecting **95 mm forward** of the bumper (NA: front edge at Y ≈ +1960) and following the bumper's plan-view outline plus a straight leading edge with 25 mm radiused corners. Two support rods: 10 mm ⌀ cylinders from the splitter top face at (±420, +1930, 122) up to bumper mount tabs at (±420, +1840, 420) — **the rods must intersect both surfaces, not float between them**. Add 4 washer/bolt discs where the rods meet the plate.
Materials: slot 0 `M_CarbonWeave` (or `M_SatinBlack`), rods `M_Alloy`. Tri budget 4k.
Pitfall: the splitter plate must be *flat and level*, not following the bumper's curve downward — that's the whole point of a splitter.

**`FA04` — Type-2 Front Bumper (NA)** *(ref: Garage Vary / KG Works full bumper)*
Build: full bumper replacement. Start by duplicating the OEM bumper mesh, then: lower the leading edge 40 mm, widen the central intake to 720×140 mm with a 15 mm surround, add two 220×110 mm outer intakes at X ±480, and integrate a lip identical in form to FA02 so it's one continuous surface. Keep the mounting flange geometry and the pop-up headlight cutouts identical to OEM.
Materials: slot 0 `M_BodyPaint`, intakes `M_Mesh`, surrounds `M_GlossBlack`. Tri budget 12k.
Pitfall: this REPLACES the bumper — the manifest must mark the OEM bumper mesh as hidden, and FA01–FA03 must be marked incompatible.

**`FA05` — Dive Planes / Canards**
Build: one canard = a 190×85 mm curved plate, 6 mm thick, with 12 mm upturned outer edge, swept back 25° and angled 12° nose-up. Two per side, stacked with 70 mm vertical gap, mounted to the bumper corner face at (±745, +1790, 480) and (±745, +1790, 410). Mirror across X.
**The inboard edge must be coincident with the bumper surface** — model them slightly oversized and let them intersect 3 mm into the body.
Materials: slot 0 `M_CarbonWeave`. Tri budget 1.5k for the set.

**`FA06` — Tow Hook**
Build: a 12 mm-thick, 140 mm-long tapered plate with a 45 mm ⌀ hole at the outer end, protruding forward and slightly outboard from `ANCH_TOWHOOK_F`, plus a bolt boss where it meets the bumper. Add a 4 mm chamfer around the eye.
Materials: slot 0 `M_AccentPaint` (these are always anodised red/gold/blue — make it recolourable). Tri budget 800.

**`FA07` — Mesh Grille Insert**
Build: a single subdivided plane conforming to the intake aperture, offset 20 mm behind the bumper face, with an alpha-clip diamond-mesh texture and a 10 mm `M_GlossBlack` surround frame. Do **not** model the mesh as geometry.
Materials: slot 0 `M_Mesh`, frame `M_GlossBlack`. Tri budget 400.

---

### 6.3 Rear & side aero (`RA`)

| ID | Display name | Fits | Type | Slot |
|---|---|---|---|---|
| `RA01` | Ducktail Spoiler | NA, ND | BOLT_ON | `boot_aero` |
| `RA02` | GT Wing (boot-mounted) | NA, ND | BOLT_ON | `boot_aero` |
| `RA03` | Swan-Neck Big Wing | NA, ND | BOLT_ON | `boot_aero` |
| `RA04` | Rear Diffuser (4-strake) | NA, ND | BOLT_ON | `diffuser` |
| `RA05` | OEM+ Lip Spoiler | NA, ND | BOLT_ON | `boot_aero` |
| `RA06` | Side Skirts | NA, ND | BOLT_ON | `side_skirts` |
| `RA07` | Over-Fenders (widebody, 4pc) | NA, ND | BOLT_ON | `fenders` |

**`RA01` — Ducktail Spoiler**
Build: extract the boot lid's trailing edge loop and its rear 260 mm of surface. Duplicate, then raise the trailing edge 85 mm while keeping the front edge coincident with the boot lid at Y ≈ `ANCH_BOOTLID_REAR.y + 260`. The profile is a smooth upward sweep — front tangent matches the boot lid exactly (0° step), rear tangent ~28° up. Solidify 10 mm with a rolled 5 mm under-return at the trailing edge. Width tapers into the rear quarter shoulders on both sides.
Fixing: adhesive-mounted, so the **entire lower surface must kiss the boot lid** with no gap. Verify by looking along the boot lid from the side at eye level.
Materials: slot 0 `M_BodyPaint`, carbon variant `M_CarbonWeave`. Tri budget 3k.
Pitfall: the single most common failure is a visible step at the front edge. Snap the front row of verts to the boot lid mesh.

**`RA02` — GT Wing (boot-mounted)**
Build, in this order:
1. **Element**: a single-plane aerofoil, chord 240 mm, thickness 22 mm, span **1400 mm**, with 3° of camber and set at 8° angle of attack. Extrude the aerofoil profile along X; add a 4 mm radius on the leading edge and a sharp 1.5 mm trailing edge. Position centre at (0, −1740, **1320**) — roughly roofline height.
2. **Endplates**: 300×180 mm flat plates, 6 mm thick, at X = ±700, vertical, with the wing element's trailing corner cut flush. Add a 40 mm forward-swept leading corner.
3. **Uprights**: 2 plates, 14 mm thick, 240 mm tall, tapering from 150 mm chord at the base to 90 mm at the top, running from `ANCH_WING_MOUNT_L/R` up to the element's underside at X ±330. **The upright's top edge must be cut to the element's underside curve and merged into it**; the bottom must sit on a 180×90×8 mm base plate that lies flat on the boot lid.
4. **Hardware**: 4 bolt heads per base plate, 2 adjuster bolts per upright/element joint.
Fixing: base plates bolt through the boot lid at the anchors. The wing must **not** intersect the boot lid, and the boot lid must still be able to open in the render (visually plausible clearance).
Materials: slot 0 `M_AccentPaint` (element — people run coloured wings), endplates `M_GlossBlack`, uprights `M_Alloy`, hardware `M_ChromeSteel`. Tri budget 6k.
Pitfall: uprights floating above the boot lid, or an element whose span extends past the car's width (1675 NA / 1735 ND) — cap span at body width minus 150 mm.

**`RA03` — Swan-Neck Big Wing** *(ref: 9 Lives Racing style)*
Build: as RA02 but the uprights attach to the **top** of the element and hook over it (swan neck), and the element is a higher-camber section: chord 300 mm, thickness 30 mm, 12° AoA, span 1500 mm, mounted at Z 1360. Uprights are 16 mm-thick curved plates whose top ~90 mm bends 90° over the element's upper surface and bolts through it — model the bend as a real fillet with a 60 mm radius, not a mitre. Endplates 360×220 mm with a rectangular cut-out.
Materials: slot 0 `M_AccentPaint`, uprights `M_Alloy`, endplates `M_GlossBlack`. Tri budget 8k.

**`RA04` — Rear Diffuser (4-strake)**
Build: a base panel following the underside of the rear bumper, starting flat at Y = −1820 / Z = 260 and kicking **up at 12°** to the rear edge at Y = −2090 / Z = 330. Width 1180 mm, tapering in 40 mm at each side. Add 4 vertical strakes, 10 mm thick × 90 mm deep, at X = 0, ±280, ±560, each running the full length of the diffuser and following its kick angle. Add a 15 mm rolled outer edge.
Fixing: 6 tabs to the bumper's lower edge; must tuck *behind* the bumper's bottom lip, not sit on top of it. Must clear the exhaust tip anchor — check against whichever `EX` mod is fitted and leave a 40 mm cut-out at the tip location.
Materials: slot 0 `M_CarbonWeave` or `M_SatinBlack`. Tri budget 4k.

**`RA05` — OEM+ Lip Spoiler**
Build: a low, subtle version of RA01 — 35 mm rise, 140 mm deep, 8 mm thick, following the boot's trailing edge exactly with a slight upward flick at the ends. Materials: slot 0 `M_BodyPaint`. Tri budget 1.5k. Use this as the "mild" option in the same slot as the ducktail and wings.

**`RA06` — Side Skirts**
Build: from `ANCH_SILL_L`, extract the rocker sill's lower edge loop between the front and rear wheel arches (NA: Y +700 → −900). Extrude down 60 mm and out 25 mm, with a horizontal step ridge and a 12° inward-angled lower face. Solidify 10 mm. **Both ends must terminate flush into the arch openings** — they cannot stop short in the middle of the sill.
Fixing: 5 clip bosses per side along the top face. Mirror across X.
Materials: slot 0 `M_BodyPaint` / `M_SatinBlack` variant. Tri budget 4k the pair.

**`RA07` — Over-Fenders (widebody, 4pc)** *(ref: Rocket Bunny / Pandem style)*
Build: for each arch, take the arch opening edge loop, offset it outward **+45 mm front / +55 mm rear**, and build a flared band 140 mm wide (measured along the body surface) that starts tangent to the body 140 mm from the opening and flares to the offset lip. Solidify 4 mm, roll the outer edge 8 mm inward. Add 12 rivet bosses (3 mm ⌀ discs) evenly spaced around the outer perimeter, 20 mm in from the edge.
Fixing: sits *on* the body, overlapping it — intersect 2 mm into the body surface all round. Mirror across X, and remember front and rear arches have different curvature.
Materials: slot 0 `M_BodyPaint`, rivets `M_ChromeSteel`. Tri budget 10k the set.
App note: this mod should also flag `track_widening: +40mm per side` so the configurator can offer aggressive wheel offsets that would otherwise clip.

---

### 6.4 Body panels (`BP`)

| ID | Display name | Fits | Type | Slot |
|---|---|---|---|---|
| `BP01` | Vented Carbon Bonnet (dual louvre) | NA, ND | REPLACE | `bonnet` |
| `BP02` | Cowl / Double-Bubble Bonnet | NA | REPLACE | `bonnet` |
| `BP03` | NACA-Duct Bonnet | NA, ND | REPLACE | `bonnet` |
| `BP04` | Carbon Boot Lid | NA, ND | REPLACE | `boot_lid` |
| `BP05` | Fixed Headlight Conversion | NA | REPLACE | `headlights` |
| `BP06` | Hardtop | NA, ND | REPLACE | `roof` |

**`BP01` — Vented Carbon Bonnet**
Build: duplicate the OEM bonnet as the base surface (identical outer silhouette, hinge cutouts and edge return flange — a replacement panel that doesn't match the shut lines is worthless). Then cut two rectangular apertures, 300×160 mm, centred at (±330, +1180, ~870), following the bonnet's curvature. Into each, fit a louvre stack: 5 blades, each 300×45 mm, 4 mm thick, angled 35° rearward-up, spaced 32 mm, with their leading edges recessed 20 mm below the bonnet surface and a 10 mm surround lip around the aperture. **The blades must span the full aperture and attach to the surround at both ends** — floating slats are the classic failure here.
Fixing: hinge tabs at `ANCH_BONNET_HINGE_L/R`, latch tab at (0, +1620, 800). Front edge coincident with `ANCH_BONNET_NOSE`.
Materials: slot 0 `M_CarbonWeave` (default) with a `M_BodyPaint` variant, louvres `M_SatinBlack`. Tri budget 12k.
Pitfall: UV the carbon so the weave runs longitudinally and is continuous across the whole panel.

**`BP02` — Cowl / Double-Bubble Bonnet (NA)**
Build: from the OEM bonnet, raise two longitudinal blisters: each 900 mm long, 320 mm wide, peaking 55 mm above the stock surface at Y +1150, centred at X ±280, blending back to flush at both ends over 250 mm. Use a lattice or proportional-edit falloff on a subdivided panel, then relax. Add a rear-facing 240×30 mm exit slot at the back of each blister.
Materials: slot 0 `M_BodyPaint`. Tri budget 10k.
Pitfall: shading. Sample the surface with a matcap/studio HDRI — any pinching in the blend zone will show as a dark crease.

**`BP03` — NACA-Duct Bonnet**
Build: OEM bonnet plus a single centreline NACA inlet: 380 mm long, tapering from 20 mm wide at the front to 190 mm at the rear, sinking from flush to 45 mm deep, with the characteristic curved side walls (the walls diverge and drop simultaneously) and a sharp lip at the rear opening. Cut a real through-hole at the rear 60 mm of the duct.
Materials: slot 0 `M_BodyPaint` or `M_CarbonWeave`. Tri budget 9k.

**`BP04` — Carbon Boot Lid**
Build: duplicate OEM boot lid; keep the shut lines and the badge recess deleted (smooth). Add a 6 mm return flange around the underside edge. Weave UVs continuous.
Materials: slot 0 `M_CarbonWeave`. Tri budget 6k.
Note: mark as incompatible with nothing — ducktails and wings should still mount to it (their anchors are unchanged).

**`BP05` — Fixed Headlight Conversion (NA)**
Build: replaces the pop-up assemblies. Fill the pop-up bays with a smooth surface continuous with the bonnet/wing line, then inset a 280×90 mm angled lens aperture per side, raked back 30°, with a 12 mm surround. Behind the lens: a shallow reflector bowl (a shrunk hemisphere with an inner projector barrel, 70 mm ⌀), plus a small LED strip strip along the lower edge.
Materials: slot 0 `M_BodyPaint`, lens `M_Glass` (transmission 0.9, roughness 0.05), reflector `M_ChromeSteel` (metallic 1, roughness 0.08). Tri budget 8k the pair.
Pitfall: the filled bay must blend into the bonnet line with no visible seam — this is a surfacing job, do it with edge loops rather than a Boolean.

**`BP06` — Hardtop**
Build: a shell 1180 mm long, following the windscreen header at the front (must match the header rail exactly at `Y +180, Z 1200`-ish — take the loop from the base mesh) and the rear deck at Y −1150. Roof crown peaks 40 mm above the soft top line. Include: a wraparound rear window (60% of the rear face, `M_Glass`), a 25 mm-wide window surround, side quarter windows following the door glass DLO, a 20 mm perimeter flange with 6 clamp points, and a headlining shell 30 mm inside the outer skin (so it reads as double-skinned at the door aperture).
Materials: slot 0 `M_BodyPaint`, glass `M_Glass`, surround `M_GlossBlack`, lining `M_SatinBlack`. Tri budget 14k.
Pitfall: it must REPLACE the soft top; the manifest must hide the soft top and the roll bar mods must be marked incompatible if their hoop height exceeds the hardtop's inner surface.

---

### 6.5 Exterior details (`DT`)

| ID | Display name | Fits | Type | Slot |
|---|---|---|---|---|
| `DT01` | Stubby Antenna | NA, ND | REPLACE | `antenna` |
| `DT02` | Antenna Delete Plug | NA, ND | REPLACE | `antenna` |
| `DT03` | Aero Mirrors (teardrop) | NA, ND | REPLACE | `mirrors` |
| `DT04` | Race Mirrors (stalk-mounted) | NA, ND | REPLACE | `mirrors` |
| `DT05` | Carbon Mirror Caps | ND | REPLACE | `mirror_caps` |
| `DT06` | Bonnet Dampers | NA, ND | BOLT_ON | `bonnet_hw` |
| `DT07` | Bonnet Pins | NA, ND | BOLT_ON | `bonnet_hw` |
| `DT08` | Tow Strap (rear) | NA, ND | BOLT_ON | `tow_hook_r` |

**`DT01` — Stubby Antenna**
Build: a tapered cylinder, 32 mm ⌀ at the base narrowing to 12 mm at the tip, **95 mm tall**, with 14 shallow helical grooves (screw a small profile, or use a spiral bevel), on a 40 mm ⌀ × 8 mm rubber base gasket. Tilt to match the body's local normal at `ANCH_ANTENNA` plus 20° rearward rake.
Fixing: base gasket must sit **flush against the curved quarter panel** — conform its bottom face to the body surface (shrinkwrap, then apply).
Materials: slot 0 `M_SatinBlack`, gasket `M_Rubber`. Tri budget 600.
Pitfall: verify which side of the car the OEM antenna is on in your base mesh before placing it.

**`DT02` — Antenna Delete Plug**
Build: a 28 mm ⌀ domed disc, 4 mm proud, conformed to the panel. Materials: slot 0 `M_BodyPaint`. Tri budget 200. (Trivial, but it's the option people actually pick.)

**`DT03` — Aero Mirrors (teardrop)** *(ref: Ganador / Craft Square style)*
Build: head = a teardrop volume 180 mm long × 105 mm tall × 75 mm deep, widest at the front, with a flat rear face holding a 150×90 mm convex glass panel (2 mm proud, 400 mm radius convex). Stalk = a swept 30×22 mm oval cross-section arm, 90 mm long, running from `ANCH_MIRROR_L` outward and forward at 15° rise. Base = a 90×60 mm triangular foot conformed to the A-pillar/door skin.
Fixing: the base must be **coincident with the door skin surface at the mirror anchor** — no daylight. Mirror across X, and remember the glass faces rearward on both sides (rotate, don't just mirror the glass normal).
Materials: slot 0 `M_BodyPaint` (or `M_CarbonWeave` variant), glass `M_Glass` metallic 1 / roughness 0. Tri budget 3k the pair.

**`DT04` — Race Mirrors (stalk-mounted)** *(ref: Spoon / APR style)*
Build: a small rectangular head, 130×80×50 mm with rounded corners and a slight forward taper, on a thin 16 mm ⌀ round stalk 120 mm long, angled 25° up and 30° out from a 70 mm ⌀ round base plate. Glass fills 90% of the rear face.
Materials: slot 0 `M_AccentPaint`, stalk `M_GlossBlack`, glass `M_Glass`. Tri budget 2k the pair.

**`DT05` — Carbon Mirror Caps (ND)**
Build: shell-only. Duplicate the OEM mirror head's outer surface, offset 1.5 mm outward, solidify 2 mm, trim to the cap parting line. It must hug the OEM shape exactly.
Materials: slot 0 `M_CarbonWeave`. Tri budget 1.5k the pair.

**`DT06` — Bonnet Dampers**
Build: per side, a two-stage gas strut: 20 mm ⌀ body 190 mm long + 12 mm ⌀ rod 150 mm extended, with ball-socket ends. Lower end mounts to the inner wing at (±420, +600, 780); upper end to the bonnet underside at (±430, +1000, 900). **Both ends must terminate in visible ball-joint cups touching their mount brackets.** Only visible with the bonnet open — build a second "open" pose variant if the app animates the bonnet, otherwise supply the closed pose with the strut compressed.
Materials: slot 0 `M_AccentPaint` (anodised), rod `M_ChromeSteel`. Tri budget 1.2k the pair.

**`DT07` — Bonnet Pins**
Build: per pin, a 55×55 mm base plate flush to the bonnet surface, a 10 mm ⌀ × 40 mm post through it, a hinged locking pin through a cross-hole at the top, and a 300 mm lanyard cable (a thin bevelled curve) to a second small anchor plate 120 mm away. Placed at (±560, +1600, 815) on the NA.
Materials: slot 0 `M_AccentPaint`, cable `M_SatinBlack`. Tri budget 1.5k the pair.

**`DT08` — Tow Strap (rear)**
Build: a flat woven loop — a 45 mm-wide, 3 mm-thick band, 210 mm long, doubled over through a stitched eyelet, hanging from a bolt boss under the rear bumper at (−480, −2070, 400) with a slight natural sag (2–3 verts of curve, not a straight bar).
Materials: slot 0 `M_AccentPaint`. Tri budget 500.

---

### 6.6 Exhaust (`EX`) — REPLACE, slot `exhaust`

**Universal exhaust rules:** the app only ever shows the last ~700 mm plus the tip(s), but model the visible run properly: a mandrel-bent pipe (build a Bézier curve, then a Bevel with a 30 mm ⌀ circle profile, 12 segments, and apply) exiting the muffler and terminating in a tip. Every tip must be **hollow** — cut the end face and inset a 25 mm-deep inner sleeve with `M_SatinBlack` inside, or it looks like a solid rod. Tips must clear the bumper cut-out by 12–18 mm all round and never intersect the bumper or diffuser.

| ID | Display name | Fits | Description |
|---|---|---|---|
| `EX01` | Single Round Tip Cat-Back | NA, ND | 100 mm ⌀ straight-cut polished tip, 140 mm long, on a 60 mm pipe, with a visible 500×140 mm oval muffler body 320 mm ahead of the tip. Tip centre at `ANCH_EXHAUST_TIP`. |
| `EX02` | Twin Round Tips | NA, ND | Two 90 mm ⌀ tips, 110 mm apart, both exiting a shared 560 mm oval muffler. Tips must be exactly parallel and level — misaligned twin tips are instantly visible. |
| `EX03` | Quad Centre-Exit | ND | Four 76 mm ⌀ tips in a 2×2 arrangement at X ±95 / ±195, centred, in a `M_GlossBlack` surround valance panel. Requires a bumper cut-out variant flag. |
| `EX04` | Burnt Titanium Tip | NA, ND | Single 115 mm ⌀ tip, slash-cut at 15°, with a rolled outer edge and a stepped weld bead 30 mm from the end. Materials: slot 0 `M_TitaniumBurn` (blue/purple gradient via a bake or vertex-colour ramp). |
| `EX05` | Side-Exit | NA | Pipe exits ahead of the rear wheel: 63 mm pipe running along the sill under `ANCH_SILL_L`, terminating in a 90 mm ⌀ tip at (−830, −620, 240), angled 10° out and 8° down. Include a 200×120 mm heat shield plate on the sill above it. |
| `EX06` | Twin Oval Tips | NA, ND | 120×80 mm oval tips, 150 mm apart, straight-cut, chrome, on a large chrome-tipped rear muffler. The "fast road" default. |

Materials for all: slot 0 `M_ChromeSteel` (tips), muffler/pipe `M_SatinBlack`. Tri budget 3k–6k each.

---

### 6.7 Suspension & stance (`SU`)

This category is **parametric, not just meshes.** The configurator drives it by moving the body relative to the wheels.

Rules for the app (put these in the manifest, not the mesh):
- The wheels stay on the ground plane. Ride height presets translate the **body + all body-mounted mods** down by `drop_mm` on Z.
- Camber rotates each wheel about its local Y axis (top inboard = negative).
- Any drop over 45 mm requires the wheel to tuck: pair each preset with a recommended max wheel width/offset combo and flag `requires_fender_roll` where relevant.

| ID | Display name | Drop | Camber F/R | Notes |
|---|---|---|---|---|
| `SU00` | Stock | 0 | −0.5° / −1.0° | Baseline. |
| `SU01` | Lowering Springs | −25 mm | −1.0° / −1.5° | Model a visible shorter progressive spring, 12 mm wire, 7 coils, `M_AccentPaint` (springs are always coloured — make it recolourable). |
| `SU02` | Coilovers (street) | −45 mm | −1.5° / −2.0° | Full visible assembly: 60 mm ⌀ threaded shock body with a real helical thread groove, adjustable perch collar (two knurled rings), 65 mm ⌀ × 180 mm spring (8 coils), top hat with 3 bolts, and a damper rod. Must span from the lower control arm to the tower — model the lower fork bracket and the two bolt holes. |
| `SU03` | Coilovers (track) | −55 mm | −2.5° / −2.0° | Same assembly, shorter spring, plus a visible camber-adjustable top mount (a slotted plate with a spherical bearing). |
| `SU04` | Slammed / Stance | −75 mm | −4.0° / −3.5° | Flags `requires_fender_roll: true`, pairs with W04/W06 low-offset wheels. |
| `SU05` | Raised / Rally | +30 mm | −0.5° / −0.5° | Add a small sump guard plate (900×600×6 mm, `M_Alloy`) under the front. |

Coilover mesh: build **once** as `SU_COILOVER_ASSY` and reuse for SU01–SU04 with different spring lengths and perch positions. It is only ever seen through the wheel spokes and the arch gap — budget 4k tris, and make sure the spring is a real swept helix (curve + circle bevel), not a stack of tori.

---

### 6.8 Roll bar & roof (`RB`)

| ID | Display name | Fits | Type | Slot |
|---|---|---|---|---|
| `RB01` | Single-Hoop Roll Bar | NA, ND | BOLT_ON | `roll_bar` |
| `RB02` | Double-Hoop Roll Bar + Harness Bar | NA, ND | BOLT_ON | `roll_bar` |
| `RB03` | Bolt-In Half Cage | NA | BOLT_ON | `roll_bar` |
| `RB04` | Roof Duckbill Lip | NA, ND | BOLT_ON | `roof_aero` |
| `RB05` | Tonneau / Soft Top Cover | NA, ND | BOLT_ON | `tonneau` |
| `RB06` | Wind Deflector | NA, ND | BOLT_ON | `wind_deflector` |

**Universal:** all tube is 38 mm OD, 2.5 mm wall — model as a curve with a circle bevel and **cap the ends** (or better, weld them into footplates). Every tube end must terminate in a 100×100×6 mm footplate with 4 bolt holes, sitting flat on the floor/rear bulkhead at `ANCH_ROLLBAR_L/R`. **A tube that ends in mid-air is an automatic fail.** Where two tubes meet, they must intersect and be joined (Boolean union + a small fillet), not just touch.

**`RB01` — Single-Hoop**: a main hoop from `ANCH_ROLLBAR_L` up to Z 1120 (just above the seat backs, below the folded soft top line), 470 mm wide radius bends, mirrored, plus two rear stays running back and down at 40° to footplates at (±420, −1050, 480). Materials: slot 0 `M_AccentPaint` (powder-coated colours are common) with `M_ChromeSteel` variant. Tri budget 5k.

**`RB02` — Double-Hoop + Harness Bar**: two parallel hoops at Y −620 and Y −760, 140 mm apart, joined by a horizontal cross-tube at Z 950 (the harness bar) and two short spacer tubes at the top. Same rear stays. Tri budget 8k.

**`RB03` — Bolt-In Half Cage (NA)**: main hoop + harness bar + two A-pillar-following diagonals running forward to footplates at (±520, +420, 380), plus a single X-brace between the rear stays. Follows the cabin's inner surface with a 25 mm gap — must not intersect the door aperture or the windscreen header. Tri budget 12k.

**`RB04` — Roof Duckbill Lip**: for hardtop-equipped cars — a 40 mm-tall lip along the hardtop's rear edge, 8 mm thick, spanning 900 mm, swept up 20°. Depends on `BP06` being fitted; flag that dependency. Materials: slot 0 `M_CarbonWeave`. Tri budget 1k.

**`RB05` — Tonneau Cover**: a soft-look panel over the folded top well, 1180×420 mm, with a slight sag (subdivide and pull the centre down 12 mm), a stitched 8 mm perimeter seam, and 8 press-stud discs. Materials: slot 0 `M_SatinBlack` (fabric roughness 0.85). Tri budget 1.5k.

**`RB06` — Wind Deflector**: a 900×280 mm clear panel between the roll hoops with a 20 mm `M_SatinBlack` frame and two mounting brackets. `M_Glass` with transmission 0.85 and a slight tint. Tri budget 800.

---

## 7. Per-mod verification checklist

Run this before exporting. Print the results.

```
[ ] Collection MOD_<GEN>_<ID> exists and contains only this mod's objects
[ ] All object + mesh names follow §2, zero "*.001" names
[ ] Transforms applied; object origin at (0,0,0)  [wheels: hub face]
[ ] Bounding box (mm) matches the spec dimensions within ±5%
[ ] Every mount/fixing point listed in the entry is geometrically coincident
    with its anchor — no floating parts (check with a wireframe side view)
[ ] Bolt-ons sit 0.5-1mm proud of the host surface; replacements sit exactly
    where the OEM part sat (no z-fighting)
[ ] Material slots present, named per §3, slot 0 = primary recolourable
[ ] All faces have a UV; carbon parts have world-consistent UV scale
[ ] Normals outside; 0 loose verts; 0 non-manifold edges on closed volumes
[ ] Hard edges bevelled 1-2mm; Shade Smooth + 30° applied
[ ] Tri count within budget (+20% tolerance)
[ ] 3 renders taken (front-3/4, rear-3/4, top) and visually checked against
    the reference description
[ ] Exported to /assets/<gen>/<cat>/<ID>.glb, opens cleanly, <2MB
[ ] manifest.json entry appended
```

---

## 8. `manifest.json` schema

The app reads this. One object per mod.

```json
{
  "id": "RA02",
  "gen": ["na", "nd"],
  "category": "rear_aero",
  "displayName": "GT Wing",
  "attachType": "bolt_on",
  "slot": "boot_aero",
  "replaces": null,
  "hides": [],
  "incompatibleWith": ["RA01", "RA03", "RA05"],
  "requires": [],
  "anchors": ["ANCH_WING_MOUNT_L", "ANCH_WING_MOUNT_R"],
  "transform": { "position": [0,0,0], "rotation": [0,0,0], "scale": 1 },
  "mirrored": false,
  "colourable": [
    { "slot": "M_AccentPaint", "label": "Wing colour", "default": "#1A1A1A" }
  ],
  "staticMaterials": ["M_GlossBlack", "M_Alloy", "M_ChromeSteel"],
  "bbox_mm": { "min": [-700,-1860,1180], "max": [700,-1620,1345] },
  "triangles": 5840,
  "file": "/assets/na/aero_rear/RA02_gtwing.glb",
  "flags": { "requiresFenderRoll": false, "trackWidening": 0 }
}
```

For `replace` mods, `replaces` names the OEM slot occupant and `hides` lists the base-mesh object names the app must switch off (e.g. `["BODY_bonnet"]`).

---

## 9. Build order

Do it in this order — each stage de-risks the next.

1. `mx5_lib.py` + anchor empties in both base cars + one throwaway test cube exported end-to-end through the app.
2. **Wheels** `W00`, `W01`, `W08` (stock NA, stock ND, one aftermarket) — proves the wheel pipeline, sizes, and recolour slots.
3. Remaining wheels `W02`–`W07`.
4. **Rear aero** `RA01`, `RA02`, `RA05` — proves bolt-on anchoring on a curved panel.
5. **Front aero** `FA01`–`FA03`, `FA05`, `FA06`.
6. **Body panels** `BP01`, `BP04` — proves REPLACE + hide logic.
7. **Exterior details** `DT01`–`DT04` — quick wins, high visual payoff.
8. **Exhaust** `EX01`, `EX02`, `EX06`.
9. **Suspension** `SU_COILOVER_ASSY` + the parametric preset entries.
10. **Roll bar & roof** `RB01`, `RB02`, `BP06`.
11. Everything remaining, then a full-catalogue regression render: every mod fitted at once to check for intersections, then a matrix of the likely popular combos.
