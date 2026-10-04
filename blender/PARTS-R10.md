# Round ten: wide-body kit and wings

## The style

Rocket Bunny / Pandem kits exist for both the NA and the ND. They are
bolt-on, not cut-and-weld:

- **Overfenders** stand out about 50 mm a side at the front and 60 mm at
  the rear. Each runs from the bumper corner (front) or the door (rear) down
  to the sill, so from the side it reads as a separate, much wider arch.
  Exposed bolts or rivets run round the opening.
- **The rest of the kit** is a front lip and side skirts widened to meet the
  flares, a rear diffuser and a tall ducktail.
- **Wheels** are pushed out (spacers, low offset) to fill the new arches.

The earlier riveted overfenders (DT70) are a mild version that hugs the arch
top. The kit below is the full width.

| Id | Part | Cars | Where |
| --- | --- | --- | --- |
| WB01 | Wide-body overfenders, body colour, chrome bolts | ND, NA | sides · flares |
| WB02 | Wide-body overfenders, carbon | ND, NA | sides · flares |
| WB03 | Wide-body overfenders, satin black | ND, NA | sides · flares |
| WB10 | Wide-body front lip: carbon splitter with end fences | ND, NA | Aero · front lip |
| WB11 | Wide-body side skirts stepping 50 mm out | ND, NA | Aero · side skirts |
| WB12 | Wide-body diffuser with tall strakes | ND, NA | Aero · rear diffuser |
| WB13 / WB14 | Wide-body ducktail, body colour / carbon | ND, NA | Aero · rear wing |
| RA60 | Double-element GT wing | ND, NA | Aero · rear wing |
| RA61 | Time-attack wing (chassis-mount, tall uprights) | ND, NA | Aero · rear wing |
| RA62 | NA swan-neck wing | NA | Aero · rear wing |

Presets: **ND Wide-Body** and **NA Wide-Body**.

## Rebuild

```bash
blender --background --factory-startup --python blender/build_r10.py
```

Geometry is in `blender/parts_r10.py`.

## Notes

- **Overfender shape.** Each flare sweeps from 26° below hub height ahead of
  the wheel to 26° below it behind (59 stations), with a section that rises
  off the panel within 40 mm to a broad outer face. That face stands 55 mm
  proud at the front and 65 mm at the rear, then a return lip turns it back
  in at the opening. The band, up to 150 mm, shrinks wherever the panel runs
  out. Every section point sits on the panel at its own radius, and the mesh
  is oriented by signed volume.
- **Track widening.** `flags.trackWidening` is now honoured: CarModel moves
  each wheel outboard by the widest fitted part's figure, per axle (45 mm
  front, 55 mm rear for WB01-03), on top of the spacer slider.
- **Wings** come from one builder for both cars (`wing(ident, style)`),
  placed from each boot's deck and rear edge. The time-attack uprights foot
  at the rear edge; the swan-neck's hook over the leading edge onto the top
  surface.
- **Build-script fix.** The wheel check in build_r5-r10 looked at the first
  letter only, so "WB01" was exported about the wheel origin. It now needs
  `W` followed by digits.
