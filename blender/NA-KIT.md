# NA kit

Independent accessories for the 1990 NA, one for every non-stock aero option
the NA offers, plus a tow hook and two accessories shared with the ND. Like
the ND street kit, the reference car is only ray-cast: no vertex is copied,
displaced, hidden or exported from it.

| ID | Part | Option | Material | Tris |
| --- | --- | --- | --- | --- |
| FA40 | Street front lip | `frontLip: club_lip` | Satin black | 3,626 |
| RA40 | Slim side extensions | `sideSkirts: oem_extensions` | Satin black | 3,632 |
| RA41 | Low boot spoiler | `rearWing: oem_ducktail` | Body paint | 1,940 |
| EX40 | Big-bore tip | `exhaust: big_bore_single` | Titanium, satin bore | 1,148 |
| RB40 | Style bar | `rollBar: style_bar` | Satin black | 1,168 |
| RB41 | Track roll hoop | `rollBar: track_hoop` | Satin black | 1,564 |
| FA41 | Carbon splitter | `frontLip: aggressive_splitter` | Carbon, alloy stays | 1,328 |
| RA42 | Carbon side extenders | `sideSkirts: carbon_extenders` | Carbon | 3,632 |
| RA43 | Rear valance with strakes | `rearDiffuser: oem_diffuser` | Satin black | 1,334 |
| RA44 | GT wing | `rearWing: gt_wing` | Carbon, satin uprights | 938 |
| BP41 | Louvred bonnet vents | `hood: painted_vented` | Body paint, satin recess | 3,648 |
| EX41 | Twin oval tips | `exhaust: twin_oval` | Chrome, alloy collector | 1,748 |
| FA42 | Tow hook | additional part | Accent paint | 756 |

Two accessories are built for **both** cars from the same code (`na_kit.use(gen)`
switches the helpers between references):

| ID | Part | ND tris | NA tris |
| --- | --- | --- | --- |
| DT40 | Windscreen sun strip | 2,192 | 2,192 |
| DT41 | Carbon mirror caps | 5,880 | 4,776 |

Wheels are not here: the NA shares every ND wheel mod, fitted to its own
tyre at load by `CarModel.fitWheel()` (see the README).

## Rebuild

```bash
blender --background --factory-startup --python blender/build_na_kit.py -- --render
```

Both references are imported into one scene (`NA_REF` and `ND_REF`
collections). Or, in a live session, `exec` the same file and call
`build(render=True)`. Geometry lives in `blender/na_kit.py`; review renders
(`blender/na_review.py`) land in `blender/build/`.

## Things the NA asset does differently

- **It is yawed 0, not 180.** `mx5_lib.app_to_blender()` and friends now read
  `yawDeg` and the x offset from `anchors.json`, so `gen="na"` works with every
  helper. The ND's numbers are unchanged.
- **It is not centred.** Wheels, bumpers and boot mirror about x = -8.5 mm, so
  symmetric parts are built about `na_kit.CX`.
- **The boot is coarse.** Deck height steps by a few millimetres between
  facets, so the spoiler is built on deck heights smoothed along the span and
  then lifted back wherever smoothing would sink it.
- **The silencer and tail pipe are one mesh** (`Cylinder003_Material #168_0`),
  so the stock tip cannot be hidden without losing the silencer. EX40 is a
  sleeve over the stock pipe with a dark bore cap just behind its end.
- **There is no roll bar in the asset.** `Tube003` reads as 1570 mm tall in
  `anchors.json`, but every one of its vertices sits at 1000-1100 mm by the
  windscreen header; the bounding box is stale. Both bars foot on the shelf
  behind the seat well (about 825 mm, from z -880 rearward).
- **The ND's windscreen has a cut-out** round the mirror mount, filled by a
  separate black frit part, so the sun strip ray-casts both and takes the
  front-most hit.
- **The NA silencer hangs below the rear bumper** (220 mm against 244), so
  RA43 is a valance blade behind it rather than a full diffuser tray.
