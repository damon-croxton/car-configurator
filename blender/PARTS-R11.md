# Round eleven: Zunsport-style grille mesh

Zunsport's grille kits are woven diamond stainless mesh, black or bare, cut
to each front opening and fitted just inside it.

| Id | Part | Cars | Where |
| --- | --- | --- | --- |
| ZG01 | Black mesh grille | ND, NA, NB, NC | front · grille mesh |
| ZG02 | Stainless mesh grille | ND, NA, NB, NC | front · grille mesh |

The ND gets its main mouth and both lower corner grilles; the NA, NB and NC
their main mouth (their side holes are fog lamps). The NA's plain mesh
insert (FG40) joins the same group, so only one is fitted at a time.

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r11.py
```

Geometry is in `blender/parts_r11.py`.

## Notes

- **Openings** are traced by casting rays at the bumper from ahead, row by
  row, following each opening's centre (the ND's corner grilles slant). The
  ND traces against its outer bumper skin only, so the grille frame and bars
  count as things inside the mouth.
- **Depth.** The mesh follows the bumper's plan curve, taken from the lips
  above and below the opening, 8 mm back from them, and comes forward
  wherever needed to sit 3 mm in front of anything already in the opening.
  That need is spread over neighbouring rows before smoothing, so thin bars
  can't poke through between rows.
- **The weave** is a 128 px alpha-masked texture (one 14 mm tile: a diamond
  across, two up) on a 1 mm slab with world-scale planar UVs. Its material is
  `MOD_Mesh.901` (black) or `.902` (stainless), still the `MOD_Mesh` contract
  material once the suffix is dropped, without touching the plain MOD_Mesh
  other mods share. `parts_r11.mask_alpha` sets alpha mode MASK after export,
  with a 0.3 cutoff: the wires cover about 30% of a tile, which is what
  distant mip levels average to, so far off the mesh reads dark rather than
  vanishing.
- `na_review.review(..., color_type="TEXTURE")` shows the weave in reviews.

## Overfender fixes (WB01-03)

- **Round outline.** The edge where each overfender meets the body is one
  circle per arch, about a centre at or below the hub, so the outline on the
  body is a clean round arc rather than following wherever the panel runs
  out. Each arch tries bands of 150 down to 80 mm over the top and centres
  0-120 mm below the hub, and keeps the widest circle that still covers
  nearly the whole arch on panel facing the side (|normal.x| > 0.4). The
  flare runs as far round as that circle allows, and its ends are pulled back
  until the panel under them clearly faces the side, so they stop short of
  the headlamps, bumper corners and sill instead of folding over them.
- **Constant section.** The cross-section is the same all the way round;
  only where the band is narrower than 110 mm does it scale.
- **Holes in the panel** (side-marker lamps, shut lines) are filled from the
  neighbouring stations, and dips (a ray into a lamp recess) are taken out,
  so the flare never dents.
- **Bolts** run along a flat mounting flange at the outer edge, where the
  flare fixes to the body, on the panel's normal.
