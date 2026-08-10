# ND roof lining — work in progress

Paused mid-task. This is the state, the reasoning, and what is left.

## The problem

Setting the ND roof to **Down** hides the roof part (canvas, stitching decal,
rear window, frame) but leaves an inner shell floating over the cabin.

The shell is roof lining that the artist modelled **as part of the interior
tub**, not as part of the roof. So it is not reachable by hiding the roof part,
and it is not reachable by material class either — it shares
`M_Interior_Max` with the seats, dashboard, steering wheel and door cards.

I initially claimed the leftover shape was just the studio backdrop showing
through the open cabin, on the strength of tinting `interior_main` magenta and
seeing no change. **That was wrong.** The user spotted real geometry; the
island analysis below confirms it.

## What the geometry actually is

`Object_39` (mesh data `Object_16`, material `M_Interior_Max`) is **768
disconnected loose parts**, not one welded mesh. Among them:

| verts | x | y | z | what |
|---|---|---|---|---|
| 144 | ±0.69 | −1.29 … −0.51 | 0.71 … 1.08 | roof lining, full cabin width |
| 144 | ±0.70 | −1.29 … −0.68 | 0.56 … 0.78 | rear bulkhead — keep |

The soft top occupies z 0.69 … 1.09, so the first island sits in exactly the
same volume. (Those figures are Blender-space; the app works in its own scaled
world space after `frame()`.)

**A trap worth remembering:** the first implementation welded vertices *by
position* before finding connected components. That fused parts that merely
touch, so the lining came out glued to the whole 2809-triangle cabin tub and
the size filter binned it. Connectivity must be **topological** (shared vertex
indices), which is what Blender's "loose parts" means. `splitIntoIslands()`
takes a `weld` argument that defaults to `0` for exactly this reason — do not
turn it on without re-checking the island count against Blender.

## What was built

- `src/three/islands.ts` — split a geometry into loose parts, a stable
  `islandKey()`, and `partitionGeometry()` which divides triangles into two
  geometries **carrying every attribute** (UVs and normals must survive, or the
  interior loses its texture mapping).
- `CarModel.indexCabin()` — decomposes the cabin meshes once per load and
  caches it, along with which parts sit inside the roof volume and each
  triangle's world height. Everything downstream reads the cache, which is why
  the debug toggle is instant rather than ~2 s.
- `CarModel.rebuildLining()` — splits the nominated triangles into their own
  mesh, which then follows the roof's visibility. No vertex is edited and the
  asset file is untouched.
- **Debug view** in the viewport ("Debug: roof islands"): colours every
  candidate part, click in the 3D view or the list to isolate, tick to add to
  the lining set, and a height-cut slider.

## Current state

`src/data/surfaceClasses.json` → `models.nd.roofLining`:

- `hideWithRoof` — **13 parts** confirmed by eye and hidden with the roof.
  Verified: 411 draw calls / 172k tris roof-up → 397 / 165k roof-down, and the
  car reads as a proper roadster.
- `cutAboveY` — **still `null`**. Not yet chosen.

Parts are stored as `islandKey()` values (`triangleCount@x,y,z` in local
space), **not list indices**. Indices depend on the sort order and the
candidate filter; change either and stored indices would silently hide the
wrong geometry.

## What is left

1. **Choose the height cut.** Parts `#2` and `#7` are lining at the top and
   A-pillar trim further down, so no whole-part rule separates them. Isolate
   each, drag the slider until the pillar trim survives and the lining goes,
   then write the number into `cutAboveY`.
2. **Check behind the seats.** The rear bulkhead island (144 tri, lower down)
   was not in the batch. Confirm nothing is left floating there.
3. Consider whether the debug view should ship or be stripped once the numbers
   are settled. It is currently always available.

## Resuming

```bash
npm run dev      # port 3000 — live code
```

⚠️ **Use port 3000, not 4173.** `npm run preview` serves the last `npm run
build` from `dist/`, which goes stale the moment anything changes. An hour was
lost to reviewing a frozen build on 4173 and wondering why new features were
missing.

Open <http://localhost:3000/?roof=st_down&cam=profile>, click **Debug: roof
islands**, and the 13 stored parts come back pre-ticked.

## Why this is not being done in Blender

Splitting the lining out in Blender is easy — it is already a loose part. The
**re-export** is the risk, not the split:

- The whole classification system is keyed on material names. Blender's glTF
  exporter can rename, merge or re-suffix materials, silently breaking paint,
  rims, roof and interior on the ND.
- The asset stops being byte-identical to the Sketchfab download, so
  `ATTRIBUTION.md`'s "unmodified" claim would no longer hold.
- It reintroduces the Blender-export loop that `CONFORM_POSTMORTEM.md` is
  about.

The runtime split keeps the asset pristine and is deletable in one commit if it
turns out to be the wrong idea.

## The honest caveat

This asset was never built to have its roof removed. There may be no clean
answer here, only a least-bad one — and "the ND keeps its roof up" is a
legitimate outcome if the cut ends up looking worse than the compromise.
