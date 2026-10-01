# ND accessories (DT42-DT53)

Twelve ND "additional parts" (`CarConfig.extraMods`), so they need no new
panel controls. Every part is fitted by ray-casting the reference car; only
DT49 replaces anything, and it hides just the stock mirror heads.

| ID | Part | Material | Tris |
| --- | --- | --- | --- |
| DT42 | Headlight eyelids | Body paint | 2,288 |
| DT43 | Twin racing stripes, bonnet and boot | Stripe white | 4,864 |
| DT44 | Side stripes | Stripe white | 3,864 |
| DT45 | Boot luggage rack | Chrome, satin feet | 4,132 |
| DT46 | Wind deflector (roof-down part) | Mesh, satin frame | 564 |
| DT47 | F1 rain light | Red lens, satin housing | 288 |
| DT48 | Front fender vents | Carbon, satin recess | 1,616 |
| DT49 | Carbon aero mirrors (replaces the stock heads) | Carbon, mirror glass | 2,504 |
| DT50 | Rear bumper canards | Carbon | 392 |
| DT51 | Front tow strap | Accent paint, alloy | 460 |
| DT52 | Rear bumper vents | Carbon, satin recess | 1,408 |
| DT53 | Bolt-on fender flares | Satin black | 2,352 |

## Rebuild

```bash
blender --background --factory-startup --python blender/build_nd_extras.py
```

Geometry is in `blender/nd_extras.py`, on `na_kit`'s helpers pointed at the
ND with `na_kit.use('nd')`.

## Notes

- **Two new contract materials.** `MOD_StripeWhite` (class `mod_stripe`,
  never tinted) keeps stripes white on any paint. `MOD_LensRed` is classed
  `lens_red`, so the rain light lights with the tail-light switch.
- **Films** (stripes, eyelids) are thin closed slabs laid on the panel along
  its own normal, 0.6-1 mm clear of it.
- **Shut lines are real gaps.** The side stripe steps its rays a few
  millimetres along the car wherever one falls between fender and door.
- **Flares find the arch lip** by walking out from the hub at each angle
  until a ray from outside lands on a body panel (sills included, which the
  rear arch meets at its front-low corner), then lay a closed section over it.
- **DT49 and DT41 are exclusive**: the mirror caps fit the stock heads the
  aero mirrors remove. Whichever is picked last wins.
- **The roof lining is part of the cabin mesh**, so in Blender the deflector
  sits behind it. The app hides the lining with the roof down.
