# ND catalogue refinement

Reviewed all 61 shipped ND assets: 24 body/accessory variants and 37 wheel
options. Each has an isolated geometry render or a render against its mounting
surface. The production viewer is used for combined fitment and materials.

## Changes

| Parts | Correction |
| --- | --- |
| FA03 race splitter | Rounded bumper-following footprint, thin plate, angled tubular stays and mounting hardware |
| FA05 / FA06 | Curved fitted canards; forward-facing tow eye with a shaft and socket |
| RA02 wing | Curved airfoil, shaped endplates, swept uprights and feet fitted to the boot |
| RA04 / RA04B | Underbody tray, downward strakes, separate outer extensions and exhaust clearance |
| EX01 / EX02 / EX06 | Rolled thin-wall tips with genuinely recessed bores; reduced twin-tip size |
| EX03 | Four open titanium tips in two symmetric pairs; removed the off-centre stacked arrangement and fake backing plate |
| RB01 / RB02 | Moved hoops behind the seats, forward of the rear window; RB02 now has a diagonal and harness crossbar |
| BP01 / BP03 | Exact bounded vent cuts; welded skin before thickness; preserved the bonnet perimeter and continuous shading |
| BP04 | Thin carbon replacement skin retaining the original shut lines |
| DT01 / DT02 | Smaller antenna and delete cap with fitted mounting surfaces |
| DT07 / DT08 | Low-profile pins, retaining clips and curved tethers; rounded fabric tow loop |
| W01 / W04 / W05 / W07 / W09 | Curved tapered spokes, smaller hubs, stepped barrels, four lugs and inset brakes |
| WS01 / WS02 | Recessed brakes; corrected WS02's inward-facing rim orientation |
| Carbon finishes | Darker woven texture and restrained resin reflections, including the existing carbon skirts and boot lip |

The existing street lip, satin skirts and body-colour spoiler remain the mild
options. The 30 sourced wheel-pack designs retain their geometry and textures;
they remain intentionally low polygon count, so close-up silhouette detail is
limited. Their brake meshes now follow the same visibility toggle as the other
wheel mods. The high-resolution WS02 comparison wheel remains a large asset.
Mutually exclusive extras now keep the latest choice: selecting the antenna
delete disables the stubby antenna instead of removing both rendered mods.

These are generic visual concepts fitted to this particular reference asset,
not vendor replicas or engineering-certified vehicle parts. For context, the
[Verus ND canard documentation](https://www.verus-engineering.com/shop/a0105a-dive-plane-canard-kit-miata-mx5-nd-383)
describes canards as part of a coordinated splitter/diffuser package. No vendor
geometry, photographs or textures are bundled in these models.

## Rebuild and inspect

Run each command with Blender 5.2 in background/factory-startup mode:

1. `--python blender/build_nd_details.py` rebuilds 24 assets and checks panel apertures.
2. `--python blender/build_nd_street.py` rebuilds the existing five-piece street kit.
3. `--python blender/fix_nd_sourced_brakes.py` fixes the two sourced wheels in place; the transformation is idempotent.
4. Run `blender/sync_nd_detail_catalogue.py` with Python to refresh measured bounds and material names.
5. `--python blender/audit_nd_mods.py -- --after` renders every shipped asset.
6. `node scripts/validate-mod.mjs`, `npm run lint`, then `npx vite build`.
7. `node scripts/check-mod-selection.mjs` checks conflict resolution and stock reset.

Use `audit_nd_mods.py -- --icons --only=W01,W04,W05,W07,W09,WS01,WS02` to refresh
the affected wheel-picker thumbnails from the current models.

Reports and renders are written to ignored `blender/build/`. The builder asserts
zero loose vertices and zero edges shared by more than two faces. It also probes
the bonnet at the cowl and beside/between vents, checking that the original skin
survives and the vent openings remain clear. The asset validator checks the
entire catalogue's bounds, naming, normals, UVs, materials and budgets.

Viewer checks cover the combined aero build at -20 mm, rear exhaust/diffuser
clearance, both roof states, individual bonnet finishes, procedural and sourced
wheels, brake visibility, and returning to the original build.
