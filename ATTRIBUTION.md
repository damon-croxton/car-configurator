# Attribution

Third-party assets used by this project. Every entry here is mirrored in
`src/data/assetManifest.json`, which is what the build fetches and what the
in-app **Asset credits** panel (spec sheet) renders — so this file and the
running site cannot drift apart.

Everything not listed below is generated in code (the lighting rigs in
`environmentManager.ts`).

---

## Environment maps — Poly Haven (CC0)

[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) —
public domain. No attribution is required; these are credited anyway.

| Used as | Asset | Source |
| --- | --- | --- |
| `studio` | Studio Small 03 | https://polyhaven.com/a/studio_small_03 |
| `sunset` | Dikhololo Sunset | https://polyhaven.com/a/dikhololo_sunset |
| `urban_night` | Rooftop Night | https://polyhaven.com/a/rooftop_night |
| `warehouse` | Autoshop 01 | https://polyhaven.com/a/autoshop_01 |
| `salt_flats` | Kloofendal 43d Clear | https://polyhaven.com/a/kloofendal_43d_clear |
| `mountain_pass` | Camdeboo Road | https://polyhaven.com/a/camdeboo_road |

The 1K HDR files supply prefiltered lighting. Separate tonemapped panoramas
from the same CC0 assets are converted to 8K WebP at build time and displayed
as ground-projected scenery. The panorama is not blurred by PMREM. Names in
the scene picker describe the actual photographs; URL identifiers remain stable.

The ten original ND aero concepts FA20–FA22 and RA20–RA26 use supplier photos
only as shape references. No supplier photographs or CAD files are included.
See [the reference ledger](blender/ND-AERO-REFERENCES.md) for sources and scope.

The ten additional ND club parts (W10/W11, FA30, RA30–RA32, EX30/EX31,
DT30/DT31) are original modeled geometry. W10 takes visual inspiration from
the [WORK Emotion CR Kiwami](https://www.work-wheels.co.jp/campaign/we/workemotion-kiwami.html)
split-spoke design. No vendor geometry, photographs or logos are bundled.
See [the collection notes](blender/ND-CLUB-EXPANSION.md).

---

## Car model — 2016 Mazda MX-5 Miata

| Field | Value |
| --- | --- |
| Title | 2016 Mazda MX-5 Miata |
| Author | Galaxy Car Showroom |
| Source | https://sketchfab.com/3d-models/2016-mazda-mx-5-miata-922ff6fec90340ed8cf5aabe38dd1ad2 |
| Licence | [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Modified | No. The Sketchfab download (`scene.gltf` + `scene.bin` + `textures/`) is vendored verbatim at `public/assets/models/mx5_sketchfab/` — same geometry, same materials, same textures, byte for byte. At runtime the app places the model at real-world size on the ground, re-parents the wheel meshes onto pivots at their contact patches so wheel size and stance can be driven, and sets colours on the body-paint and rim materials. No geometry is split or edited, no vertex moves, and nothing is written back to the file. |

The model is the whole car as the artist authored it: body, glass, lights,
soft-top, interior and all four wheels. No part of it is generated, replaced or
supplemented in code.

**The vendored asset above is unmodified, but some mod assets are derived from
it.** BP01 and BP03 reuse the bonnet perimeter and surface, cut bounded vent
openings and add louvres or a recessed inlet. BP04 reuses the boot surface with
a thin carbon skin, and BP43 the front fender skins as carbon fenders. These
panels receive new materials and UV coordinates.
The current front lips, side extensions and boot spoilers are independently
modelled geometry fitted against the reference surface. Derived mods carry
`derivedFromBaseMesh: true` in
`src/data/modsData.json`; mods without that flag are original geometry built
from primitives.

Required credit: *This work is based on "2016 Mazda MX-5 Miata"
(https://sketchfab.com/3d-models/2016-mazda-mx-5-miata-922ff6fec90340ed8cf5aabe38dd1ad2)
by Galaxy Car Showroom, licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: the bonnet, boot lid
and front fender surfaces were reused as the basis for replacement panels.*

---

## Car model — 1990 Mazda Miata NA

| Field | Value |
| --- | --- |
| Title | 1990 Mazda Miata NA |
| Author | Ricy ([sketchfab.com/ngon_3d](https://sketchfab.com/ngon_3d)) |
| Source | https://sketchfab.com/3d-models/1990-mazda-miata-na-7acee5044310499f85df631b203227b5 |
| Licence | [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Modified | No. Vendored verbatim at `public/assets/models/mx5_na_sketchfab/`. Handled exactly like the ND: placed at real-world size on the ground at runtime, with colours set on the body-paint and rim materials. No geometry is edited and nothing is written back to the file. |

Required credit: *This work is based on "1990 Mazda Miata NA"
(https://sketchfab.com/3d-models/1990-mazda-miata-na-7acee5044310499f85df631b203227b5)
by Ricy (https://sketchfab.com/ngon_3d) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/)*

**Three mod assets are derived from it.** HD40 (NA carbon bonnet), BP42 (NA
carbon boot lid) and the NA version of BP43 (carbon front fenders) reuse the
stock bonnet, boot lid and front fender surfaces, thickened into a 2 mm skin
with a carbon material, and replace the stock panel when fitted. The vendored
file itself is untouched. Credit for HD40, BP42 and BP43: *This work is based
on "1990 Mazda Miata NA" by Ricy, licensed under CC-BY-4.0. Modified: the
bonnet, boot lid and front fender surfaces were reused as the basis for carbon
replacement panels.*

Its materials are named `Material_71`, `Material_230` and so on, which say
nothing about what they are — so unlike the ND, this model's surface table was
built by inspecting which objects use each material. See
`src/data/surfaceClasses.json`.

---

## Car model — Mazda MX-5 NB

| Field | Value |
| --- | --- |
| Title | Mazda MX-5 (NB) convertible HQ interior |
| Author | niev ([sketchfab.com/niev](https://sketchfab.com/niev)) |
| Source | https://sketchfab.com/3d-models/mazda-mx-5-nb-convertible-hq-interior-5d103c567bee4c61ad66f04562049933 |
| Licence | Listed as [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Modified | Yes. `blender/prepare_nb_nc.py` stands the model upright, removes the number plates, moves the wheel faces onto per-wheel objects with their own materials, decimates it from 1.25M to ~340k triangles (never the rims or tyres), renames every material `NB_<name>`, corrects the PBR values the importer lost, and exports `public/assets/models/mx5_nb/scene.glb`. |

Required credit: *This work is based on "Mazda MX-5 (NB) convertible HQ
interior" (https://sketchfab.com/3d-models/mazda-mx-5-nb-convertible-hq-interior-5d103c567bee4c61ad66f04562049933)
by niev (https://sketchfab.com/niev), licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: decimated,
re-materialled and number plates removed.*

**Provenance concern.** The source's number plates read "HUM3D" and its file
is named in Hum3D's catalogue style, so this upload is likely a re-upload of a
commercial Hum3D model rather than the uploader's own work. The project owner
chose to publish it on the listed licence. The plates are removed, so no
"HUM3D" mark ships.

---

## Car model — Mazda MX-5 NC

| Field | Value |
| --- | --- |
| Title | 2009 Mazda MX-5 Miata (NC) |
| Author | supercarmodels ([sketchfab.com/supercarmodels](https://sketchfab.com/supercarmodels)) |
| Source | https://sketchfab.com/3d-models/2009-mazda-mx-5-miata-nc-44f83bd458df4025b8daa7f6eeb36b1f |
| Licence | Listed as [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Modified | Yes. The same `blender/prepare_nb_nc.py` steps take it from 1.09M to ~308k triangles, export `public/assets/models/mx5_nc/scene.glb`, and move its rim and brake faces onto their own materials (the source shares them with body badges and the exhaust). |

Required credit: *This work is based on "2009 Mazda MX-5 Miata (NC)"
(https://sketchfab.com/3d-models/2009-mazda-mx-5-miata-nc-44f83bd458df4025b8daa7f6eeb36b1f)
by supercarmodels (https://sketchfab.com/supercarmodels), licensed under
CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Modified: decimated,
re-materialled and number plates removed.*

**Provenance concern.** The listing says the car "appears in NFS Shift and The
Run", which suggests it was extracted from those games. The project owner
chose to publish it on the listed licence.

---

## Sourced wheel models

Mod wheels are usually built from primitives in Blender (see the mod brief),
but some are real third-party models, conformed to the car rather than built
from scratch. Same licence obligations as the cars above.

| Field | Value |
| --- | --- |
| Title | Meister L1 3P |
| Author | Wilbruh ([sketchfab.com/mirz1911](https://sketchfab.com/mirz1911)) |
| Source | https://sketchfab.com/3d-models/meister-l1-3p-b4d1f40355b745049fe5990674b5910e |
| Licence | [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Used as | `WS01` (rim only — the tyre, disc, caliper and lug nuts are original geometry, same as every other wheel mod) |
| Modified | Yes. Rescaled and re-origined to the car's contact-patch convention; two branded elements removed to satisfy the mod brief's "no trademarked names, badges or logos" rule — a WORK Wheels(R) logo decal (a separate small mesh, deleted outright) and a MEISTER wordmark baked into the centre-cap texture (texture stripped, replaced with a flat colour matching the rest of the polished face; the cap's own geometry is untouched). Materials renamed into the app's `MOD_*` contract; their original PBR values (metalness, roughness) were kept, not replaced. |

Required credit: *This work is based on "Meister L1 3P"
(https://sketchfab.com/3d-models/meister-l1-3p-b4d1f40355b745049fe5990674b5910e)
by Wilbruh (https://sketchfab.com/mirz1911) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: rescaled, two branded
elements removed, materials renamed.*

`WS01` ships at the source model's full 12,376-tri resolution — a decimated
comparison pass was tried and dropped as unnecessary. Catalogued under
`category: "wheel_sourced"` and selectable in the panel itself (Wheels tab →
"Rim style", since it was renamed into the real `MOD_*` contract and the
Wheel finish picker recolours it like any other wheel), not only via `?mods=`.

| Field | Value |
| --- | --- |
| Title | RAYS GramLights 57DR |
| Author | ilvskf ([sketchfab.com/ilvskf](https://sketchfab.com/ilvskf)) |
| Source | https://sketchfab.com/3d-models/rays-gramlights-57dr-71a90d6c2d0a444d9d2ca7e3cf715c76 |
| Licence | [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Used as | `WS02` (rim only — tyre, disc, caliper and lug nuts are original geometry) |
| Modified | Yes. The source model's rotational axis is Blender Y, not the app's X convention, so every mesh is rotated 90° about Z before the usual rescale/re-origin to the contact-patch convention. Two branding meshes removed outright (a black sticker and a yellow/gold sticker, both off-axis badges). Materials renamed into the app's `MOD_*` contract, split `MOD_Rim`/`MOD_SatinBlack` by each mesh's own metallic factor. `WS02` is the raw 267,926-tri export, down from 338,167 raw once the two branding meshes are stripped. |

Required credit: *This work is based on "RAYS GramLights 57DR"
(https://sketchfab.com/3d-models/rays-gramlights-57dr-71a90d6c2d0a444d9d2ca7e3cf715c76)
by ilvskf (https://sketchfab.com/ilvskf) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: rotated to the app's
axial convention, two branded elements removed, materials renamed.*

`WS02` is 15x the normal wheel triangle budget and is deliberately kept as an
oversized comparison asset (`oversizeApproved: true` in `modsData.json`, an
8+ MB `.glb`) rather than decimated down — a 95%-decimated pass (`WS02D`) was
built and shipped alongside it, then removed after judging the result in-app:
the reduction reads as visibly softer at normal viewing distance, not a
worthwhile tradeoff. Catalogued under `category: "wheel_sourced"` and
selectable in the panel (Wheels tab → "Rim style", alongside `WS01` — both
were renamed into the real `MOD_*` contract, so the Wheel finish picker
recolours them same as any other wheel, unlike the sourced wheel pack below).
`WS01` and `WS02` are mutually exclusive, enforced by the panel itself rather
than by the catalogue's `incompatibleWith` alone (see the comment on
`toggleSourcedWheel`/`selectRimStyle` in `ControlPanel.tsx` for why: a
symmetric `incompatibleWith` between two simultaneously-selected mods filters
both out, not just one).

| Field | Value |
| --- | --- |
| Title | Wheels |
| Author | Wasi204 ([sketchfab.com/hafizzwaseem88](https://sketchfab.com/hafizzwaseem88)) |
| Source | https://sketchfab.com/3d-models/wheels-2feccdb562f5417c8dff4d5b5623de50 |
| Licence | [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Used as | `WP01`-`WP30` — the whole pack |
| Modified | Yes, but less than WS01/WS02: this source is a complete self-contained assembly per wheel — rim, tyre and an already-modelled disc+caliper — so no tyre/disc/caliper/lug geometry was built from primitives around it. Each `Wheel_NN` sat on an arbitrary display-tray rotation in the source scene; that placement was undone (measuring in the wheel's own local frame, not raw import-world space) before the usual rescale to the app's `TYRE_R` and re-origin to the contact-patch convention. Nothing was rotated, cut or retextured beyond that — no trademarked names or badges were present to remove. Every wheel gets the same 180-degree turn about local Z to put the finished face outward rather than the disc's hub-mount back — see `WP01`'s `$bugs` note in `modsData.json` for how that landed on "unconditional" only after a per-wheel heuristic was tried and confirmed wrong twice over. |

Required credit: *This work is based on "Wheels"
(https://sketchfab.com/3d-models/wheels-2feccdb562f5417c8dff4d5b5623de50)
by Wasi204 (https://sketchfab.com/hafizzwaseem88) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: rescaled and
re-origined to the contact-patch convention, display-tray placement removed.*

Unlike every other mod, `WP01`-`WP30` keep their source materials
(`wheel_NN_metal`, `wheel_NN_rubber`) rather than the flat-PBR `MOD_*`
contract — each wheel ships a small baked texture (AO/highlight detail) that
is very likely why it reads as a real wheel at under 1,000 triangles, and the
`MOD_Rim` flat colour would have replaced it. `materialContractExempt: true`
in `modsData.json` lets `validate-mod.mjs` pass them without that renaming,
and `wheel_NN_metal`/`wheel_NN_rubber` map to a `static_textured` class in
`surfaceClasses.json` that nothing tints — the Wheel finish picker has no
effect on these wheels, by design.

---

## Trademarks

"Mazda", "MX-5" and "Miata" are trademarks of Mazda Motor Corporation. This is
an unaffiliated, non-commercial personal project. A Creative Commons licence on
a 3D model covers that model's copyright only — it grants no trademark or
industrial-design rights, which are separate and are not the model author's to
license. Nothing here is endorsed by or associated with Mazda.
