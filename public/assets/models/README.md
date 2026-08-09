# Car model

One model, used as-is:

```
mx5_sketchfab/
├── scene.gltf
├── scene.bin
├── textures/
└── license.txt
```

"2016 Mazda MX-5 Miata" by Galaxy Car Showroom, from Sketchfab, licensed
[CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/). See `license.txt`
and `ATTRIBUTION.md` in the repo root.

**It is unmodified, and it stays that way.** The app loads `scene.gltf` and
displays it. It does not split it, rename its nodes, replace its materials,
hide parts of it, or reposition anything inside it. The only transform applied
is a uniform scale, a 180° yaw and a placement of the model root — done in
`src/three/carModel.ts`, computed from its bounding box — so it appears at
real-world size standing on the ground plane facing the camera presets.

Every mesh here carries exactly one material, so `src/data/surfaceClasses.json`
can classify every surface by material name alone. That table is what lets the
app touch the model without altering it:

- **Body colour** sets `.color` on the one material classed `body_paint`.
- **Rim finish** sets colour/metalness/roughness on materials classed `rim` —
  tyres and centre-cap badges are excluded.
- **Wheel size, ride height, camber and track** work by re-parenting the wheel
  meshes onto pivots at their ground contact patches, then scaling, rotating
  and sliding those pivots. World transforms are preserved, so nothing moves on
  screen when it happens, and no vertex is edited.

No Blender step was needed for any of it.

Roof, aero and interior controls, and the wheel *style* selector, change the
URL and the spec sheet only — the model has one roof state, no aero parts, one
interior and one rim design.

Unlike the HDRIs, this asset is committed to the repo rather than fetched at
build time (see the exception in `.gitignore`) — it is the one thing the app
cannot run without.
