# Attribution

Third-party assets used by this project. Every entry here is mirrored in
`src/data/assetManifest.json`, which is what the build fetches and what the
in-app **Asset credits** panel (spec sheet) renders — so this file and the
running site cannot drift apart.

Everything not listed below is generated in code (`src/three/proceduralMx5.ts`,
`proceduralWheel.ts`, `textures.ts`, and the procedural lighting rigs in
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

## Car model — not yet added

<!-- TEMPLATE. Fill this in *before* committing any manifest entry for a car
     model. CC-BY is only satisfied if all four fields are present, and the
     licence additionally requires stating that the work was modified. -->

| Field | Value |
| --- | --- |
| Title | _pending_ |
| Author | _pending_ |
| Source | _pending_ |
| Licence | _pending_ |
| Modified | Yes — reoriented, rescaled to real ND dimensions, split and renamed to this project's scene-graph contract, and re-exported as GLB via `scripts/blender/conform_mx5.py`. |

---

## Trademarks

"Mazda", "MX-5" and "Miata" are trademarks of Mazda Motor Corporation. This is
an unaffiliated, non-commercial personal project. A Creative Commons licence on
a 3D model covers that model's copyright only — it grants no trademark or
industrial-design rights, which are separate and are not the model author's to
license. Nothing here is endorsed by or associated with Mazda.
