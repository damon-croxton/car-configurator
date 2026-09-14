# ND roof-down trim split

The source interior mesh (`Object_39`, material `M_Interior_Max`) includes roof
lining connected to the fixed windscreen header and A-pillar trim. Hiding its
whole connected parts would also remove the pillars. The previous whole-island
list additionally missed a roof rail and several one-to-six-triangle fragments.

`src/data/surfaceClasses.json` now identifies the upper faces in four shared
islands. `CarModel.rebuildLining()` partitions them along existing triangle
edges, retaining all 125 fixed faces in those islands. Fifteen roof faces move
to the existing roof-visibility mesh. Nine additional roof-only islands,
including rail sections and small seam fragments, follow the roof as complete
parts.

The passenger-side follow-up identified a separate four-triangle front rail
section (`4@-0.509,-0.339,-1.013`) and its two-triangle end cap
(`2@-0.521,-0.251,-0.991`). Both sit below the original upper-lining height check
and below the debug view's eight-triangle heuristic. They now follow the roof.
Their mirrored faces were already included in the opposite rail's hide rule.
The regression checks both front rail regions in world space and verifies
symmetry, while all 125 fixed shared header/pillar faces remain unchanged.

The original glTF is unchanged. No vertex moves, no new cut crosses a face, and
all vertex attributes, winding and materials are retained. Roof up restores
the complete source surface; roof down only hides the nominated roof geometry.
The split inherits the cabin transform, including lowered suspension settings.

Face offsets are scoped to stable island keys and refer to the original source
index buffer. If the source asset is replaced, re-audit these selections rather
than copying offsets into the new asset. Explicitly nominated tiny parts now
appear in the development roof-island view even below its heuristic size limit.

Validation:

```powershell
node scripts/check-roof.mjs
npm run lint
node scripts/check-mod-selection.mjs
node scripts/check-environments.mjs
npm run build
```

The geometry regression loads the real ND/NA assets with texture IO omitted.
It checks every rule against the original topology, exact conservation of all
attributes across both partitions, all 125 fixed shared faces, absence of upper
lining fragments, repeated toggles, stance, generation switching, and disposal
of replaced partitions. The local app was also inspected in profile, front
three-quarter, rear and cockpit views, with roof up and down. Review screenshots
are saved locally in `blender/build/roof-review/`.
