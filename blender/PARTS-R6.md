# Round-six parts

Harnesses, more colour and style variants, nose and flank details, two
more wheels and NA mud flaps. All follow real accessory types, with generic
names and no logos.

| Id | Part | Cars | Panel |
| --- | --- | --- | --- |
| HN01 | 4-point harnesses in the accent colour (requires BS01) | ND, NA | cabin |
| GK04 | Cue-ball shift knob | ND, NA | cabin · gear knob |
| DT64 | Chrome bullet mirrors | ND, NA | sides · mirrors |
| DT65 | Black boot luggage rack | ND, NA | top · boot rack |
| DT66 | Twin coachline pinstripes | ND, NA | sides · side stripes |
| DT67 | Satin black bonnet wrap | ND, NA | top |
| DT69 | Red (accent) offset stripe | ND, NA | top · racing stripes |
| DL02 | Rally lamps with stone covers | ND, NA | front · rally lamps |
| SP01 | Alloy skid plate | ND, NA | front |
| DT30 | NA version of the rally mud flaps | NA | sides |
| W14 | Turbofan wheel | ND, NA | Wheels tab |
| W15 | Deep-dish six-spoke wheel | ND, NA | Wheels tab |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r6.py
```

New geometry is in `blender/parts_r6.py`. The variants call `parts_r5` and
`nd_extras` builders with a different material or cover (`boot_rack` now
takes a material). The build writes `blender/build/r6_report.json`.

## Notes

- **`requires` is enforced.** `resolveModConflicts` drops any part whose
  `requires` is not fitted, so HN01 goes when the carbon buckets go,
  including when BS02 replaces them in the seats group. In the panel,
  fitting the harness also fits the buckets, and removing the buckets
  removes the harness.
- **Harnesses** follow BS01's layout from `parts_r4.bucket_seats`. The
  shoulder straps come from the harness slots down the pad to a buckle in the
  lap, and the lap straps come up from the side mounts.
- **Bonnet wrap.** The film sits 0.8 mm clear on a 61 x 73 grid, so the
  bonnet's tight curves can't show through. It is exclusive with the
  stripes, which would sit under it, and with vented or replacement
  bonnets. On the NA each row stops at the bonnet's notches round the
  pop-up headlights.
- **Pinstripe heights** avoid each car's fender features. On the ND they run
  at y 590, between the side-marker garnish and the shoulder crease at
  y 640. On the NA they run at y 585, above the side-marker hole.
- **The skid plate** hangs below any front lip (y 136 on the ND, 202 on the
  NA), on brackets up to the bumper's lower edge.
- **NA mud flaps** use the ND's DT30 outline, hung from the lowest body
  surface 390 mm behind the front wheels and 380 mm behind the rears.
- **Wheels** reuse W07's tyre, barrel and brakes. The turbofan's twenty
  swept slots are cut from a lathed disc with exact booleans.
