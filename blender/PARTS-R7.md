# Round-seven parts

Exterior bodywork and wheels. All follow real accessory types, with
generic names and no logos.

| Id | Part | Cars | Panel |
| --- | --- | --- | --- |
| DT70 | Riveted overfenders, body colour, 60 mm wide and up to 45 mm proud | ND, NA | sides · flares |
| DT71 | Body-colour fender flares | ND, NA | sides · flares |
| DT72 | Twin NACA bonnet ducts | ND, NA | top |
| FA45 | Carbon dive planes on the front bumper corners | NA | front |
| RA50 | Carbon rear spats on the rear bumper flanks | NA | rear |
| DT73 | Round brake-cooling ducts in the front bumper corners | NA | front |
| W16 | Classic five-spoke wheel | ND, NA | Wheels tab |
| W17 | Ten-spoke forged wheel | ND, NA | Wheels tab |
| W18 | Steel wheel with oval vents and a chrome cap | ND, NA | Wheels tab |
| W19 | Three-piece multi-spoke with a wide lip and assembly bolts | ND, NA | Wheels tab |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r7.py
```

New geometry is in `blender/parts_r7.py`. `nd_extras.fender_flares` now
takes `width`, `swell` and `rivets`. The build writes
`blender/build/r7_report.json`.

## Notes

- **Overfenders.** A 60 mm band crosses enough panel curvature that the old
  two-reference section folded. Wide flares sample the panel at every
  section point and run the underside back along it. The concave 11-point
  end caps can fool the normal recalculation, so the mesh is oriented by its
  signed volume. Flares 40 mm wide or less are built exactly as before.
- **NACA ducts** are films in the NACA planform: narrow at the front and
  flaring rearward. They sit outboard of the stripes' path (x ±380 on the
  ND, ±360 on the NA) and are exclusive with the bonnet wrap and vented
  bonnets.
- **Brake ducts** are laid on the NA bumper's curved lower corners point by
  point, using the face normal at the centre. A rigid ring sank into the
  curve.
- **Wheels** reuse W07's tyre, barrel and brakes. The steel wheel's six oval
  vents are cut with exact booleans. The multi-spoke's 32 assembly bolts sit
  on its wide chrome lip.
