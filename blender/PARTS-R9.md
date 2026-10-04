# Round-nine parts

| Id | Part | Cars | Panel |
| --- | --- | --- | --- |
| NB01 | Black vinyl nose bra | NA | front |
| RA51 | Low-mount carbon wing (110 mm lower, 1200 mm span) | NA | Aero tab · rear wing |
| DT78 | Carbon-vinyl bonnet wrap | ND, NA | top · bonnet wrap |
| DT79 | Accent-colour bonnet wrap | ND, NA | top · bonnet wrap |
| W22 | Six Y-spoke wheel | ND, NA | Wheels tab |
| W23 | Twelve-spoke wheel | ND, NA | Wheels tab |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r9.py
```

New geometry is in `blender/parts_r9.py`. `na_kit.build_gt_wing` takes
`drop`, `half` and `scale`, and `parts_r6.bonnet_wrap` takes a material.
The build writes `blender/build/r9_report.json`.

## Notes

- **Nose bra.** It's laid on the bumper by rays from ahead and slightly
  above (direction (0, -0.45, -1)), so the front face and the nose top are
  both hit squarely. It comes in three pieces that frame the oval
  parking-lamp openings (|x| 350-550 from about 580 mm up) and stop above
  the intake, plus a band across the bonnet's leading 170 mm. The film sits
  1.5 mm clear on a dense grid so the curved nose can't show through.
- **Bonnet wraps** (DT67, DT78, DT79) form the `bonnet_wrap` group. All are
  exclusive with stripes, vented bonnets and the NACA ducts.
- **Wheels** reuse W07's tyre, barrel and brakes, and have icons rendered
  with `audit_nd_mods.py --icons`.
