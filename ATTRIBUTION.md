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
| `sunset` | Venice Sunset | https://polyhaven.com/a/venice_sunset |
| `urban_night` | Dikhololo Night | https://polyhaven.com/a/dikhololo_night |
| `warehouse` | Autoshop 01 | https://polyhaven.com/a/autoshop_01 |
| `salt_flats` | Kloofendal 43d Clear | https://polyhaven.com/a/kloofendal_43d_clear |
| `mountain_pass` | Golden Gate Hills | https://polyhaven.com/a/golden_gate_hills |

Downloaded at 1K. We consume them through `PMREMGenerator`, which pre-filters to
a small cubemap, so higher resolutions cost bandwidth for detail the renderer
discards. All six now render as the actual visible background as well as the
lighting — see the note in `README.md` on `backgroundMode`.

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
it.** The replacement bonnets and boot lid start from this model's own panels,
the boot spoilers are its rear deck lifted, the side skirts are its rocker sill
extended, and the front lip is its lower bumper trim extended — so that each
matches the car's shut lines exactly rather than being modelled freehand. CC-BY
permits that and requires the change be stated, which is what this paragraph
does. Derived mods carry `derivedFromBaseMesh: true` in
`src/data/modsData.json`; mods without that flag are original geometry built
from primitives.

Required credit: *This work is based on "2016 Mazda MX-5 Miata"
(https://sketchfab.com/3d-models/2016-mazda-mx-5-miata-922ff6fec90340ed8cf5aabe38dd1ad2)
by Galaxy Car Showroom, licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: the bonnet surface was
reused as the basis for a vented replacement panel.*

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

Its materials are named `Material_71`, `Material_230` and so on, which say
nothing about what they are — so unlike the ND, this model's surface table was
built by inspecting which objects use each material. See
`src/data/surfaceClasses.json`.

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
| Used as | `WS01` / `WS01D` (rim only — the tyre, disc, caliper and lug nuts are original geometry, same as every other wheel mod) |
| Modified | Yes. Rescaled and re-origined to the car's contact-patch convention; two branded elements removed to satisfy the mod brief's "no trademarked names, badges or logos" rule — a WORK Wheels(R) logo decal (a separate small mesh, deleted outright) and a MEISTER wordmark baked into the centre-cap texture (texture stripped, replaced with a flat colour matching the rest of the polished face; the cap's own geometry is untouched). Materials renamed into the app's `MOD_*` contract; their original PBR values (metalness, roughness) were kept, not replaced. |

Required credit: *This work is based on "Meister L1 3P"
(https://sketchfab.com/3d-models/meister-l1-3p-b4d1f40355b745049fe5990674b5910e)
by Wilbruh (https://sketchfab.com/mirz1911) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: rescaled, two branded
elements removed, materials renamed.*

`WS01`/`WS01D` are catalogued under `category: "test"` — a full-resolution vs.
decimated comparison pair, deliberately kept out of the normal control panel
(`optionalMods()` filters the category out) until a decimation ratio is chosen.
Reachable at `?mods=WS01` or `?mods=WS01D`.

---

## Trademarks

"Mazda", "MX-5" and "Miata" are trademarks of Mazda Motor Corporation. This is
an unaffiliated, non-commercial personal project. A Creative Commons licence on
a 3D model covers that model's copyright only — it grants no trademark or
industrial-design rights, which are separate and are not the model author's to
license. Nothing here is endorsed by or associated with Mazda.
