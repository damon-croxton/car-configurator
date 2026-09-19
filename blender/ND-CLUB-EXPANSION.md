# ND club collection

Ten new selectable parts, modeled for the existing ND reference car. The
original car files are unchanged. These are visual concepts, not product CAD;
the wheels use the stock weight baseline and aero parts have zero performance
deltas because their physical properties have not been measured.

| ID | Part | Fixing / shape |
| --- | --- | --- |
| W10 | Concave Split Five | Splayed paired spokes inspired by the WORK Emotion CR Kiwami; four lugs, stepped barrel, inset disc/caliper and valve |
| W11 | Retro Three Spoke | Three broad swept paddles and a separate polished lip |
| FA30 | Carbon Corner Splitters | Two bumper-fitted blades, open through the centre |
| RA30 | Race Side Steps | Wide carbon running blades with raised end fences |
| RA31 | Gurney Flap | Slim satin L-section following the curved boot edge |
| RA32 | Club Bridge Spoiler | Body-colour low airfoil, curved pedestals and surface-fitted feet |
| EX30 | Slash-cut Titanium Twins | Two angled annular outlets, recessed bores and joined collector pipes |
| EX31 | Rolled-edge Single | Large rolled outlet with recessed bore and silencer |
| DT30 | Rally Mud Flaps | Four shaped rubber panels; upper overlap into sill/bumper, metal fasteners |
| DT31 | Rear Tow Eye | Accent-colour ring, connected neck/shaft and bumper socket |

Wheels retain the measured 641 mm tyre diameter and export relative to the
front-left contact patch (734, 0, 1194) mm. Existing runtime controls handle
finish, tyre size, wheel size, track, camber and brake visibility. Body parts
follow the body ride height. EX30/EX31 hide the stock exhaust node. Mud flaps
and existing rear spats share mounting space, so the latest selection wins.

The supplier's [CR Kiwami design reference](https://www.work-wheels.co.jp/campaign/we/workemotion-kiwami.html)
informed only the five pairs of splayed spokes and recessed centre. The model
has no copied vendor mesh, logo or claimed product dimensions.

## Build and review

Use Blender 5.2 in background/factory-startup mode with `--python-exit-code 1`:

- `--python blender/build_nd_club_expansion.py` rebuilds all ten assets and updates their catalogue entries/bounds. Append `-- --only=W10,W11` to rebuild a subset.
- `--python blender/audit_nd_mods.py -- --after --only=W10,W11,FA30,RA30,RA31,RA32,EX30,EX31,DT30,DT31` renders individual fitment views.
- `--python blender/audit_nd_mods.py -- --icons --only=W10,W11` regenerates wheel picker thumbnails.
- `node scripts/validate-mod.mjs <ID>` validates each export.
- `node scripts/check-mod-selection.mjs` checks selectors and accessory conflicts.
- `node scripts/check-club-expansion.mjs` checks the development preview, wheel instances, saved URLs and six scenes in Chrome. `TEST_URL` and `BROWSER_CHANNEL` are configurable.

Initial checks: each export is under its triangle budget and below 0.5 MB;
Blender reports no loose vertices or edges shared by more than two faces.
Individual fitment renders and combined front/rear/top viewer screenshots are
written under ignored `blender/build/`. The low wing feet were moved inward
after a raycast detected an out-of-panel fixing position.

## People-free scenes

Venice Sunset and Shanghai Bund are replaced by Poly Haven's CC0
[Dikhololo Sunset](https://polyhaven.com/a/dikhololo_sunset) and
[Rooftop Night](https://polyhaven.com/a/rooftop_night). All six scene horizons
were visually inspected across 360 degrees with no visible people found.
Both replacement panoramas have matching HDR lighting and source-specific
filenames, preventing reuse of the old files from local/browser caches.
Saved `sunset` and `urban_night` links continue to work. Near buildings can
still bend under ground projection; the people that made this conspicuous are
absent from the selected images.
