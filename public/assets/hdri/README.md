# Environment maps

Drop equirectangular `.hdr` files here using the filenames declared in
`src/data/materialsData.json` (`environments[].hdri`):

```
studio.hdr  sunset.hdr  urban_night.hdr  warehouse.hdr  salt_flats.hdr
```

They are loaded with three's RGBE loader through the shared `LoadingManager`,
so they contribute to the loading bar.

When a file is absent, `EnvironmentManager` builds a matching lighting rig in
code (graded sky dome + emissive softbox panels described by the environment's
`procedural` block) and pre-filters it with `PMREMGenerator`. That keeps the
repository free of binary assets while still producing real image-based
lighting — swap in HDRIs whenever you have them, no code changes needed.

## How these arrive

They are **not committed**. `src/data/assetManifest.json` declares each one and
`npm run assets` (also run by `prebuild` and by CI before the build) downloads
them here. `.gitignore` excludes `*.hdr`, so the repo stays light.

A failed fetch is non-fatal: `EnvironmentManager` falls back to its generated
lighting rig and the viewport shows a `GENERATED IBL` badge. To confirm which
path is live, look for that badge.

When a real HDRI does load, the per-environment `practicalScale` in
`materialsData.json` scales the key/fill/rim lights down — those intensities
were calibrated against the weaker generated rig and would otherwise
double-light the car.
