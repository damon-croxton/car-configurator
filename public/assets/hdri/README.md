# Environment assets

Run `npm run assets` to fetch the licensed files declared in
`src/data/assetManifest.json`. CI and `npm run build` do this automatically.
HDR and WebP files are ignored by git. `--strict` makes fetch failures fail the
command; the default build permits runtime fallbacks.

Each scene has two assets:

- A 1K equirectangular HDR used by PMREM for lighting and reflections.
- A separate 8K WebP panorama used by `GroundedSkybox` for the visible scenery
  and floor. The fetcher converts the official tonemapped JPG with Sharp;
  source JPEG downloads are never sent to the viewer.

`environments[].panoramaHeight` controls ground-projection scale;
`panoramaRotation` rotates scenery and reflections together. No blur or opaque
floor obscures a loaded panorama. Contact shadows remain underneath the car.
The former floor-reflection control is no longer shown because a photographic
floor cannot be made reflective with a material slider.

If the panorama is missing, the unfiltered HDR source remains visible. If both
files are absent, the viewer uses a gradient, a floor and generated lighting.
If only the HDR is missing, the panorama is retained with generated lighting.
Scene requests use the latest selection, and replaced/stale textures and
PMREM render targets are disposed.

The `urban_night` URL id now uses Shanghai Bund. `salt_flats`, `warehouse` and
`mountain_pass` retain their URL ids but have photo-accurate picker names.
