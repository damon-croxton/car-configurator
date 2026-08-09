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

Downloaded at 1K. We consume them through `PMREMGenerator`, which pre-filters to
a small cubemap, so higher resolutions cost bandwidth for detail the renderer
discards.

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

---

## Trademarks

"Mazda", "MX-5" and "Miata" are trademarks of Mazda Motor Corporation. This is
an unaffiliated, non-commercial personal project. A Creative Commons licence on
a 3D model covers that model's copyright only — it grants no trademark or
industrial-design rights, which are separate and are not the model author's to
license. Nothing here is endorsed by or associated with Mazda.
