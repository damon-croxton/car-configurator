# App and ND modelling review

Reviewed 12 September 2026, starting from `91495d9`.

Follow-up: the first modelling pass is now implemented on `testing`. See
[ND street kit](blender/ND-STREET-KIT.md) for the replacement assets, rebuild
instructions and comparison control. The observations below describe the
earlier versions reviewed before that work.

## Branches

`testing` is the reusable development branch, created from current `main`.
The old `claude/mazda-mx5-3d-configurator-i1pitj` branch was 53 commits behind
`main`, with zero unique commits, and was deleted from GitHub.
Production remains on `main`; the existing Pages workflow only automatically
deploys pushes to `main`. A testing branch is not yet a separate hosted preview.

## Assessment

The stock ND, configurable paint, camera views, share links and data-driven
parts catalogue provide a useful foundation. The next priority should be the
quality of a small ND kit rather than catalogue expansion.

The viewer inspection covered the stock ND and the Club Lip, OEM Extensions
and OEM Ducktail combination, including a rear-camera reload of the shared
configuration. This is a focused review, not an exhaustive test of every part,
device or generation. No replacement models were built in this review.

## Why the existing body mods look unconvincing

- `blender/mods/FA01_front_lip.py` duplicates the lower bumper trim and stretches
  its lower band down 55 mm and forward 25 mm. It preserves donor topology,
  which does not establish a convincing accessory lip shape or end treatment.
- `blender/mods/RA06_side_skirts.py` stretches a duplicate sill down 60 mm and
  out 25 mm, and makes the entire duplicate black/carbon. In the viewer it
  reads as a deep curtain beneath the door rather than a slim accessory.
- `blender/mods/RA05_boot_spoilers.py` deletes faces from a duplicate boot lid
  and lifts the surviving strip. The ducktail variant uses 260 mm of depth and
  85 mm of rise. The rear view shows uneven folds and an awkward deck transition.
  Solidifying and smoothing this inherited topology has not produced a clean
  spoiler surface.
- `blender/mods/FA03_race_splitter.py` uses a nine-point outline and rectangular
  support rods. `RA04_rear_diffuser.py` builds a shallow grid with block fins.
  These are useful layout prototypes; their construction omits the controlled
  profiles and attachment details needed for close-up realism. These two were
  inspected in source, not individually validated in the viewer.

## Recommended first modelling pass

Build one restrained ND street kit: front lip, slim side extensions and a low
boot spoiler. Finish those before adding another wing, widebody or bonnet.

1. Gather front, side, rear and close-up product references for each part,
   matching the ND body variant. Distinguish measured dimensions from estimates.
2. Keep the base car file intact as a fit reference. Author clean independent
   accessory geometry. Sampling its surface for mounting points is useful;
   stretching its existing panel topology into the whole accessory is not a
   reliable design method.
3. Establish silhouettes and cross-sections first. Include return edges, a
   closed underside, tapered ends and credible attachment surfaces. Add small
   bevels where highlights need to turn smoothly.
4. Check fit in the running app at stock and lowered stance, including wheel
   clearance, both sides, underside views and close-ups. Avoid floating joints,
   coplanar overlap and visible intersections.
5. Tune materials only after shape and fit pass. Carbon needs consistent weave
   scale/direction and restrained highlights; black plastic must retain enough
   surface detail to show its shape.
6. Compare stock and modified builds at identical camera and lighting settings.
   Approve visual quality as a separate gate from asset-file validation.

Useful manufacturer references (visual research, not a claim that our generic
parts reproduce these products):

- [Mazda Roadster accessory styling kit](https://www.mazda.co.jp/cars/passenger/roadster/accessories/driving-pleasure-collection/)
- [AutoExe ND-05 styling kit](https://autoexe-store.com/en/products/styling-kit-roadster-nd-05-en)

## App improvements, in priority order

1. **Make selections accurately describe the render.** RF and Recaro selections
   imply geometry that the current soft-top/cabin asset does not supply. Mark
   unsupported options consistently or withhold them until modelled. The aero
   panel's existing 3D badges are a useful starting point.
2. **Improve comparison.** Add a temporary stock/modified comparison that
   preserves camera and lighting, plus close-up views for individual aero parts.
3. **Resolve wheel/brake fit.** The UI already states that mod brakes sit proud
   of the wheel face. Fix axial placement and clearance before presenting them
   as finished. Replace tyre width/sidewall multipliers with meaningful sizes
   when the geometry and catalogue can support them.
4. **Make specification confidence explicit.** `src/config/summary.ts` invents
   prices from weight/downforce and assigns every aftermarket wheel the same
   price. Power and downforce are summed from catalogue entries. Label these as
   estimates or omit unsupported figures; do not suggest simulation results.
   Additional toggle parts are also absent from the itemised summary.
5. **Move development controls out of the main experience.** The roof-island
   debug button and continuous render statistics are visible in the main view.
6. **Refresh documentation and checks.** README still says aero and wheel styles
   are inert and describes outdated wheel sizing. The modelling brief also has
   obsolete statements about a loader not existing. The smoke script hard-codes
   a Linux browser path and prints FAIL without setting a failing exit code.
7. **Add checks for testing.** Current CI deploys `main` but has no testing-branch
   validation job. Add type checking, build and useful asset/interaction checks;
   decide separately whether a hosted testing preview is useful.

## Verification

- `npm run lint`: passed (TypeScript checking).
- `npx vite build`: passed using existing local assets; emitted a large-bundle
  warning (approximately 1.16 MB main JavaScript before gzip). The asset fetch
  prebuild was not part of this check.
- `validate-mod.mjs` for FA01, RA06 and RA01: all passed. RA06 has no declared
  bounding box, which the validator reports without failing. Their visual
  shortcomings despite passing demonstrate why screenshot review is required.
- Browser review loaded stock and selected modified ND geometry. The inspected
  console contained a shader precision warning and no returned error entries.
- The existing automated smoke suite was not run; its Linux executable path
  does not match this Windows workspace. Mobile and full catalogue coverage
  remain untested.
