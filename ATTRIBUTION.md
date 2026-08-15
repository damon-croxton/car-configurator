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
"Sourced wheel tests"), not only via `?mods=`.

| Field | Value |
| --- | --- |
| Title | RAYS GramLights 57DR |
| Author | ilvskf ([sketchfab.com/ilvskf](https://sketchfab.com/ilvskf)) |
| Source | https://sketchfab.com/3d-models/rays-gramlights-57dr-71a90d6c2d0a444d9d2ca7e3cf715c76 |
| Licence | [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Used as | `WS02` / `WS02D` (rim only — tyre, disc, caliper and lug nuts are original geometry) |
| Modified | Yes. The source model's rotational axis is Blender Y, not the app's X convention, so every mesh is rotated 90° about Z before the usual rescale/re-origin to the contact-patch convention. Two branding meshes removed outright (a black sticker and a yellow/gold sticker, both off-axis badges). Materials renamed into the app's `MOD_*` contract, split `MOD_Rim`/`MOD_SatinBlack` by each mesh's own metallic factor. `WS02` is the raw 267,926-tri export (down from 338,167 raw once the two branding meshes are stripped); `WS02D` is a 95%-decimated pass at 17,116 tris for comparison. |

Required credit: *This work is based on "RAYS GramLights 57DR"
(https://sketchfab.com/3d-models/rays-gramlights-57dr-71a90d6c2d0a444d9d2ca7e3cf715c76)
by ilvskf (https://sketchfab.com/ilvskf) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: rotated to the app's
axial convention, two branded elements removed, materials renamed, one
variant decimated.*

`WS02` is 15x the normal wheel triangle budget and is deliberately kept as an
oversized comparison asset (`oversizeApproved: true` in `modsData.json`, an
8+ MB `.glb`) rather than shipped as the only option — `WS02D` is the
practical version. Both are catalogued under `category: "wheel_sourced"` and
selectable in the panel (Wheels tab → "Sourced wheel tests"), same as `WS01`;
the three are mutually exclusive, enforced by the panel itself rather than by
the catalogue's `incompatibleWith` alone (see the comment on
`toggleSourcedWheel` in `ControlPanel.tsx` for why: a symmetric
`incompatibleWith` between two simultaneously-selected mods filters both out,
not just one).

| Field | Value |
| --- | --- |
| Title | Wheels |
| Author | Wasi204 ([sketchfab.com/hafizzwaseem88](https://sketchfab.com/hafizzwaseem88)) |
| Source | https://sketchfab.com/3d-models/wheels-2feccdb562f5417c8dff4d5b5623de50 |
| Licence | [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Used as | `WP01`-`WP13` so far (13 of a 30-wheel pack; `Wheel_14`-`Wheel_30` remain in `Models/wheels/` for later) |
| Modified | Yes, but less than WS01/WS02: this source is a complete self-contained assembly per wheel — rim, tyre and an already-modelled disc+caliper — so no tyre/disc/caliper/lug geometry was built from primitives around it. Each `Wheel_NN` sat on an arbitrary display-tray rotation in the source scene; that placement was undone (measuring in the wheel's own local frame, not raw import-world space) before the usual rescale to the app's `TYRE_R` and re-origin to the contact-patch convention. Nothing was rotated, cut or retextured beyond that — no trademarked names or badges were present to remove. The pack turned out not to be uniformly authored: most wheels needed a 180-degree turn to put the finished face outward rather than the disc's hub-mount back, but three (`WP06`, `WP07`, `WP13`) already sat the right way round — the first three exports (`WP01`-`WP03`) shipped backwards before that was caught (by looking at the result, not by any automated check) and fixed. |

Required credit: *This work is based on "Wheels"
(https://sketchfab.com/3d-models/wheels-2feccdb562f5417c8dff4d5b5623de50)
by Wasi204 (https://sketchfab.com/hafizzwaseem88) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Modified: rescaled and
re-origined to the contact-patch convention, display-tray placement removed.*

Unlike every other mod, `WP01`-`WP13` keep their source materials
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
