# Body mods for the NB and NC

The shared body parts, rebuilt against the NB and NC models' own panels. File
names match the ND/NA versions, under `public/assets/mods/nb/` and `nc/`.

| Group | Ids |
| --- | --- |
| Racing stripes (white, black, accent) | DT43, DT56, DT57 |
| Side stripes (white, black, accent) | DT44, DT58, DT77 |
| Offset stripe (white, black, accent) | DT62, DT63, DT69 |
| Pinstripes | DT66 |
| Boot rack (chrome, black) | DT45, DT65 |
| Flares (satin, carbon, riveted, body colour) | DT53, DT61, DT70, DT71 |
| Roundels and door plate | RN01, RN02, RN03 |
| Rally lamps (open, covered) | DL01, DL02 |
| Bonnet wrap (satin, carbon, accent) | DT67, DT78, DT79 |
| Skid plate, mud flaps, NACA ducts | SP01, DT30, DT72 |
| Wide-body overfenders | WB01, WB02, WB03 |
| Wide-body lip, skirts, diffuser, ducktails | WB10, WB11, WB12, WB13, WB14 |
| Double-element and time-attack wings | RA60, RA61 |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_nbnc.py
```

It imports the shipped NB/NC models, rebuilds the ray-cast helper meshes
(`prepare_nb_nc.make_helpers()`: the joined paint shells plus bonnet, boot,
nose and door crops), then runs the same builders as the ND/NA rounds. Each
car's numbers (axle stations, deck spans, wing and rack positions) live in
the `nb` and `nc` rows of the `GEN_CFG` / `CFG` tables in `nd_extras.py` and
`parts_r5.py`, `parts_r6.py`, `parts_r7.py` and `parts_r10.py`.

## Notes

- **Cropped panels have cracks.** The helper crops leave hairline gaps
  between faces, so deck rays now step a millimetre or two past a miss
  (`nd_extras.deck_hit`), and stripes only run where all their columns land.
- **Flare ends.** The NC's arches run out sooner than the NA's, so its flare
  arc is 10–165°. Where the smoothed lip falls just inside the opening, the
  flare looks a little further out for skin to sit on.
- **Anchors** are the real panels in each car's glb: NB bonnet `Object_47.001`,
  boot `Object_48`, nose `Object_49`, tail `Object_45.001`, doors
  `Object_50`/`Object_51`, arches `Object_52.001`/`Object_46`/`Object_53`;
  NC shell `Object_54.002`, rear deck `Object_56.002`, tail `Object_60.001`.
- `na_review.review(..., gen='nb')` now renders the NB/NC source collections.
