# Kickoff prompt — paste into Claude Code (Blender MCP connected)

Everything below the line is the prompt. It assumes you are in
`C:\Users\Damon\car-configurator` with Blender running and the MCP bridge live.

---

You are acting as a senior automotive hard-surface artist and technical artist,
building swappable mod assets for the MX-5 configurator in this repo (NA Mk1 and
ND Mk4).

Read `./mx5-mod-modelling-brief.md` in full before you do anything else. It is
the spec: axis convention, world origin, **measured** anchor coordinates, naming,
the material contract, geometry standards, the mod catalogue with per-mod
recipes, the build order and the verification checklist. Follow it literally. If
it conflicts with your instinct, follow the brief and flag the conflict.

Also read `CONFORM_POSTMORTEM.md` before touching anything in Tier 3. It is the
record of a previous attempt to derive geometry from these same base assets, and
why it failed on the third rebuild.

## The three things most likely to trip you up

1. **The coordinate system is the app's, not a vehicle datum.** +X is vehicle
   LEFT, +Y up, +Z forward, origin at the car's bounding-box centre on the ground
   — which is *not* mid-wheelbase. In Blender the nose points −Y. Do not derive
   this by hand: call `mx5_lib.load_reference(gen)`, which places the base car in
   Blender exactly as the app places it, and model against what you see.
2. **The app recolours by material *name* → surface class, never by slot index.**
   Name a mod's paint material `MOD_BodyPaint` and the existing paint picker
   recolours it with zero new code. The table is already in
   `src/data/surfaceClasses.json` under `mods`.
3. **Nothing may edit the base car assets.** A "REPLACE" mod adds its own
   geometry and hides named base nodes. If a part cannot be hidden cleanly by
   node name, that mod cannot be built.

## What already exists — do not rebuild it

- `scripts/measure-asset.mjs` — replays `CarModel.frame()` and reports where
  everything actually is, in app space, in millimetres. Already run; output is
  `blender/anchors.json`. Re-run it if an asset changes.
- `scripts/validate-mod.mjs` — the automated half of the §9 checklist. Verified
  working against a throwaway fixture: it catches off-contract names, unapplied
  transforms, wrong bounding boxes, unclassified materials, over-budget triangle
  counts, missing UVs/normals, and **parts that float clear of their anchor**.
- `src/data/modsData.json` — the catalogue schema, seeded with the `TEST` entry
  the Phase 0 cube must satisfy.
- `src/data/surfaceClasses.json` → `mods` — the material contract.

## How to work

Work through **§10 Build order** in the brief, in order. It starts with Phase 0,
which is pipeline only — no mod geometry at all — and ends with a throwaway cube
that goes end to end: built by a Blender script, exported, validated, loaded by
the app, visible in the right place, and recoloured by the existing paint picker.
Until that cube works, building a wheel is guesswork.

**Write build scripts to files and have Blender execute the file:**

```python
exec(open(r"C:/Users/Damon/car-configurator/blender/mods/W01_race7spoke.py").read())
```

That keeps the MCP payload to one line regardless of script size, and leaves a
committed, diffable, re-runnable artefact. Never hand-edit geometry in the
viewport — the result is unreproducible and the next anchor correction destroys
it.

### Per-mod loop (do not skip steps)

1. Restate the mod's fixing points and key dimensions in your own words, citing
   the measured anchors you will use. If the recipe is ambiguous for this
   specific base mesh, say so and propose a resolution rather than guessing.
2. Write `blender/mods/<ID>_<name>.py`. Explicit numeric coordinates read from
   `anchor()`; no magic values.
3. Run it, then `stats()`.
4. Export, add the `modsData.json` entry, run `node scripts/validate-mod.mjs <ID>`.
   **Fix every failure before step 5** — steps 3–4 are free and step 5 is not.
5. Render three viewport screenshots (front-3/4, rear-3/4, top) **with the
   reference car visible**, and look at them. Critique the result against the
   brief: silhouette, proportion, anything floating, whether edges catch light.
6. Load it in the running app and screenshot it there. The Blender viewport is
   not the renderer that ships.
7. Commit the build script, the `.glb` and the catalogue entry together, then
   move on.

## Non-negotiables

- **Nothing floats.** Every mod has named fixing points. Wing uprights merge into
  the boot lid and into the wing element. Wheel spokes physically bridge the hub
  face to the inner face of the rim lip. Splitter rods intersect both the
  splitter plate and the bumper. Roll bar tubes terminate in footplates. If a
  joint won't intersect, the mod isn't finished — and `validate-mod.mjs` will say
  so.
- **Material names are a contract.** Use the §3 table verbatim. No `Material.001`.
- **Bolt-ons sit 0.5–1 mm proud** of their host surface. Never coplanar
  (z-fighting), never gapped.
- **Applied transforms, applied modifiers, correct normals, bevelled hard edges,
  UVs on everything.**
- **Wheel origin is the contact patch**, not the hub face, and wheels are modelled
  for the left side only.
- **No trademarked names, badges or logos in any geometry.** (The existing
  `carData.json` wheel-style display names are a pre-existing decision — leave
  them, don't add to them.)

## Run unattended

Work continuously through the build order without checking in between mods. The
permissions in `.claude/settings.json` cover the Blender MCP tools, the two
validation scripts, the dev server and git. Batch your questions: if something
needs a decision, note it, keep building everything that does not depend on the
answer, and raise the whole list at the next phase boundary.

## Stop and ask only for

- The base mesh is missing, mis-scaled, or oriented differently from §1.
- A measured anchor moved more than 30 mm, or a named node no longer exists.
- `Tube003_Material #123_0` on the NA turns out to be a roll bar (§1.2) — the
  `RB` category then needs re-scoping.
- A mod needs a `CarConfig` field that does not exist and Phase 3 hasn't happened.
- You are about to exceed a tri budget by more than 2×.
- Anything would require editing a base car asset. That is never the answer.

## Start here

Report the environment: Blender version; whether `blender/anchors.json` matches
the current assets (re-run `measure-asset.mjs` and diff); scene unit scale; and
confirm `load_reference('nd')` puts the car nose toward Blender −Y with its
bounding box matching §1.2. Then begin Phase 0 step 2 and keep going.

Do **not** stop to have anchor deltas confirmed — they are measured, committed
and reproducible. Report anything that disagrees with the brief and carry on.
