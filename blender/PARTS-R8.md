# Round-eight parts

Carbon front fenders, more mirror and decal variants, NA twin tips, and
two more wheels. All follow real accessory types, with generic names and no
logos.

| Id | Part | Cars | Panel |
| --- | --- | --- | --- |
| BP43 | Carbon front fenders (derived from the stock skins) | ND, NA | sides |
| DT74 | Twin-stalk carbon mirrors | ND, NA | sides · mirrors |
| DT75 | Accent-colour mirror caps | ND, NA | sides · mirrors |
| DT77 | Accent-colour side stripes | ND, NA | sides · side stripes |
| RN03 | Rally door plates | ND, NA | sides · roundels |
| EX44 | Twin titanium tips on an oval collector | NA | Aero tab · exhaust |
| W20 | Wire wheel with a knock-off spinner | ND, NA | Wheels tab |
| W21 | Seven twin-spoke wheel | ND, NA | Wheels tab |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r8.py
```

New geometry is in `blender/parts_r8.py`. `nd_extras.aero_mirrors` takes
`twin`, and `parts_r5.roundels` takes `plate=(width, height)` for the
rounded rally plates. The build writes `blender/build/r8_report.json`.

## Notes

- **Carbon fenders** replace only the paint skins: `FenderFL/FR` on the
  ND, and the one `f fender` node that covers both sides on the NA. Side
  markers and liners stay. The skins are thickened behind their outer
  surface, so flares, vents and stripes still sit on them. Both cars'
  attribution notes record the derivation.
- **NA twin tips.** The stock pipe can't be hidden (it is one mesh with the
  silencer), so an oval collector encloses it and splits into two 60 mm tips.
- **The wire wheel** laces 48 spokes alternately from two hub flanges, each
  leading or trailing 0.55 rad to the rim. Its spinner stands 6 mm proud of
  the tyre, as real knock-offs do.
