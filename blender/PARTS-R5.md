# Round-five parts

More cabin, nose and decal options, two classic wheel designs and NA ports
of ND-only extras. All follow real accessory types, with generic names and no
logos.

| Id | Part | Cars | Panel |
| --- | --- | --- | --- |
| GK01 | Weighted alloy ball shift knob | ND, NA | cabin · gear knob |
| GK02 | Wooden ball shift knob, chrome collar | ND, NA | cabin · gear knob |
| GK03 | Tall titanium shift knob | ND, NA | cabin · gear knob |
| FX01 | Fire extinguisher on a floor bracket ahead of the passenger seat | ND, NA | cabin |
| DL01 | Round rally driving lamps on the front bumper | ND, NA | front |
| RN01 / RN02 | Race roundels on both doors, white / accent colour | ND, NA | sides · roundels |
| DT62 / DT63 | Offset rally stripe, white / gloss black | ND, NA | top · racing stripes |
| BP42 | Carbon boot lid | NA | top |
| DT48, DT50, DT52, DT54 | NA versions of the fender vents, rear canards, rear bumper vents and racing fuel cap | NA | as on the ND |
| W12 | Classic eight-spoke wheel | ND, NA | Wheels tab |
| W13 | Pepperpot disc wheel | ND, NA | Wheels tab |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r5.py
```

New geometry is in `blender/parts_r5.py`. The NA ports reuse the
`nd_extras` builders, whose positions now come from `GEN_CFG` per car
(`fender_vent`, `rear_vent`, `canard`, `fuel`). The build writes
`blender/build/r5_report.json`.

## Notes

- **Shift knobs.** The ND's stock knob is part of its cabin mesh, so it
  can't be hidden. The new knobs are sized to enclose it: the ball has a
  27 mm radius and the stock knob is about 23 mm. The NA's knob and lever are
  one node (`Cylinder016`), which is hidden, so the new knob stands on its own
  collar out of the boot.
- **Roundels** bridge the NA door's seam. Each point takes the outermost hit
  among its neighbours and lifts along the side axis, so the seam can't show
  through the disc.
- **NA fender vents** sit between z 860 and 705, clear of the side-marker
  hole in the fender at about z 680.
- **NA fuel cap.** The NA model has no fuel door, so the cap goes where the
  real filler is: on the right rear quarter, ahead of the tail light.
- **Wheels** reuse W07's tyre, barrel and brakes with a new face, and export
  about the contact patch like every other wheel. The pepperpot windows are
  cut from a lathed disc with exact booleans.
- **BP42 and HD40** are both derived from the base mesh, thickened behind
  the stock outer surface so stripes, racks and spoilers still sit on them.
  See `ATTRIBUTION.md`.
