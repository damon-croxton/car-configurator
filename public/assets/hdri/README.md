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
