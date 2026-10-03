# Round-four parts

Interior replacements, colour variants and NA-only body parts, all modelled
after real aftermarket or factory options. Generic names only, no logos.

| Id | Part | Cars | Panel |
| --- | --- | --- | --- |
| SW01 | Classic wood-rim wheel, slotted alloy spokes | ND, NA | cabin · steering wheel |
| SW02 | Deep-dish suede wheel (78 mm dish) | ND, NA | cabin · steering wheel |
| SW03 | Flat-bottom leather wheel | ND, NA | cabin · steering wheel |
| SW04 | Quick-release race wheel | ND, NA | cabin · steering wheel |
| BS01 | Carbon fixed-back buckets with harness slots | ND, NA | cabin · seats |
| BS02 | Reclining sports seats, headrests on chrome posts | ND, NA | cabin · seats |
| DT55 | Quick-release bumper fasteners | ND, NA | front |
| DT56 / DT57 | Racing stripes in gloss black / accent colour | ND, NA | top · racing stripes |
| DT58 | Side stripes in gloss black | ND, NA | sides · side stripes |
| DT59 | Gloss black mirror caps | ND, NA | sides · mirrors |
| DT60 | Body-colour aero mirrors | ND, NA | sides · mirrors |
| DT61 | Carbon fender flares | ND, NA | sides · flares |
| DT49, DT07, DT51, DT46 | NA versions of the aero mirrors, bonnet pins, tow strap and wind deflector | NA | as on the ND |
| HT40 / HT41 | Hardtop, body colour / carbon | NA | top · hardtop |
| FG40 | Mesh grille insert in the nose intake | NA | front |
| HD40 | Carbon bonnet (hood slot) | NA | Aero tab |
| FA43 / FA44 | Front lip, body colour / carbon | NA | Aero tab |
| RA45 / RA46 | Carbon ducktail / tall painted ducktail | NA | Aero tab |
| RA48 | Body-colour side extensions | NA | Aero tab |
| RA49 | Carbon track valance (rear diffuser slot) | NA | Aero tab |
| RB42 | Chrome style bar | NA | Aero tab |
| EX42 / EX43 | Rolled-edge chrome and 30° slash-cut titanium tips | NA | Aero tab |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r4.py
```

New geometry is in `blender/parts_r4.py`. The variants call the `na_kit` and
`nd_extras` builders with a different material or size. The build writes
`blender/build/r4_report.json` (bbox, triangles and materials per file),
which is where the catalogue entries came from.

## Notes

- **Groups.** A `group` on a catalogue entry makes its parts exclusive:
  stripe colours, steering wheels, seats, mirrors (caps and aero heads),
  flares and hardtops. In the panel, picking one takes the others off.
  `resolveModConflicts` applies the same rule to links.
- **Steering wheels** are built on each car's column axis (centre, axis and
  rim radius measured from the stock wheel) and hide the stock wheel node.
- **Seats.** On the ND they hide `CabinSeats`, the seat mesh CarModel
  splits out of the cabin tub at load. The validator accepts that name even
  though it is not an asset node. On the NA they hide the seats node.
- **The hardtop** is lofted from the windscreen header back to the rear deck
  with a tinted rear-window film. It is exclusive with the roll bars and the
  wind deflector: if both are picked, the hardtop wins.
- **HD40 is derived from the base mesh.** It offsets the stock bonnet surface
  into a 2 mm skin. See `ATTRIBUTION.md`.
- **New contract material.** `MOD_Wood` (class `mod_wood`, never tinted) is
  used for the wood rim.
