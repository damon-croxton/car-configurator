# ND aero expansion — September 2026

Ten original visual concepts, fitted to the existing ND reference car. These
are not scans, CAD replicas or measured manufacturer parts. Dimensions were
chosen for this viewer; no supplier fitment, mass or downforce is asserted.
Product photographs are references only and are not redistributed in the app.

| Asset / option | Shape reference and interpretation |
| --- | --- |
| FA20 / MSR-style Split Lip | [CarbonMiata MSR front lip](https://www.carbonmiata.com/shop/cm-fl7-nd-c-dry-carbon-mazda-spirit-racing-replica-front-lip-for-miata-nd-2530): two low carbon halves, central gap and curved corners. |
| FA21 / Three-piece Street Lip | [CarbonMiata three-piece lip](https://www.carbonmiata.com/shop/3-pieces-front-lip-for-miata-nd-1747): deeper satin shelf, separate corner sections and small centre ribs. |
| FA22 / Stacked Carbon Canards | [CarbonMiata canards](https://www.carbonmiata.com/shop?category=361&order=create_date+desc) and [MX5 Mania universal canards](https://mx5mania.com.au/products/canard-front-diffusers-universal): an original two-level arrangement fitted around the ND bumper ducts. Mutually exclusive with FA05. |
| RA20 / MSR-style Side Blades | [CarbonMiata MSR skirts](https://www.carbonmiata.com/shop/cm-rl7-nd-c-dry-carbon-mazda-spirit-racing-replica-side-skirts-for-miata-nd-2533): thin step with a raised rear shoulder and closed lower return. |
| RA21 / RS-style Sculpted Skirts | [CarbonMiata RS skirts](https://www.carbonmiata.com/shop/cm-sk4-nd-c-side-skirts-rs-type-for-miata-nd-1744): taller curved sill panel, with tapered ends. |
| RA22 / MSR-style Blade Spoiler | [CarbonMiata MSR spoiler](https://www.carbonmiata.com/shop/cm-ts20-nd-dc-dry-carbon-mazda-spirit-racing-replica-trunk-spoiler-for-miata-nd-2560): thin upright trailing blade, stepped lower centre and a boot-mounted flange. |
| RA23 / Touring Ducktail | [CarbonMiata TRD spoiler](https://www.carbonmiata.com/shop/trd-trunk-spoiler-for-miata-nd-1526) and [MX5 Mania fourth-style spoiler](https://mx5mania.com.au/products/carbon-fibre-4th-performance-style-boot-spoiler-nd-2015-current): a broader, taller original body-colour interpretation with rounded shoulders and tapered tips. |
| RA24 / Low Swan-neck Wing | [CarbonMiata swan-neck version 2](https://www.carbonmiata.com/shop/gt-wing-swan-neck-version-2-for-miata-nd-1774): low carbon airfoil, top-mounted supports, fitted feet and shaped endplates. Moved aft to clear the stock antenna. |
| RA25 / MP-style Street Diffuser | [MX5 Mania MP diffuser](https://mx5mania.com.au/products/abs-rear-diffuser-mp-style-nd-2015-current): fitted curved valance and four fins. The original concept adds symmetric exhaust clearances for the viewer's single, twin and quad tips. |
| RA26 / Carbon Rear Spats | [CarbonMiata rear add-ons](https://www.carbonmiata.com/shop/rear-mudguards-add-ons-for-miata-nd-1433): an original lower corner extension, fitted behind the wheels rather than a reproduction of the pictured mudguard. |

[MX5Things' ND catalogue](https://mx5things.com/collections/mazda-mx-5-2016-nd-st)
was also reviewed. Its listed accessories focus on lighting, controllers and
convenience equipment, so no invented MX5Things aero product is attributed here.

## Rebuild and verify

1. Run `python blender/sync_nd_aero_catalogue.py` to register the collection.
2. Run Blender in background mode with `blender/build_nd_aero_expansion.py`.
3. Run the catalogue sync again to record measured bounds and materials.
4. Run `node scripts/validate-mod.mjs`, `node scripts/check-mod-selection.mjs`
   and `node scripts/check-environments.mjs`.
5. Render `blender/audit_nd_mods.py -- --after --only=FA20,FA21,FA22,RA20,RA21,RA22,RA23,RA24,RA25,RA26`.
6. Inspect the two new presets in the actual viewer; Workbench previews do not
   show the runtime body colour or embedded carbon textures faithfully.

The build checks triangle budgets and loose/non-manifold edges. The base glTF
is unchanged. All ten are additive parts; the eight main choices use existing
shareable aero slots, while canards and rear spats use Additional parts.

The visual review led to thinner front mounting edges, a diffuser following
the actual lower bumper hem, and an aft wing position clear of the antenna.

Validation: all 71 ND catalogue assets pass `validate-mod.mjs`. The ten new
models total 1.69 MiB, with 1,216–4,704 triangles each. TypeScript, the production
build and the selection/environment regression checks pass. All six final
scenes were inspected in the viewer, along with the new aero families, both
roof states and the street diffuser with stock/twin/quad exhaust outlets.
