# Authored-body conform: postmortem and learnings

Written at the end of a long session that tried to move the MX-5 configurator
from "procedural car + compose authored nodes on top" to "authored GLB is the
permanent body, procedural code only builds bolt-on mods." The code-side
architecture change (Tasks 1–6 below) is done and reasonably solid. The
asset-side work (Task 7 — actually conforming the ND source model) went
through several rounds of bugs, each fixed, each revealing the next, and by
the end it was clear the underlying approach had outgrown what this was
supposed to be: a quick proof of concept. This document is the record of why,
so the next attempt doesn't repeat it.

## Headline lesson

**A real car source model has many materials per visual "zone," and this
app's architecture assumes one.** `carModel.ts` recolors an entire node
(`Body_Main`, `Bumper_Front`, `Lights_Tail`, ...) with a single flat material
by traversing every mesh under it and overwriting `mesh.material`. That's
fine for a body shell that really is one paint color everywhere. It is wrong
for:
- A front bumper that has a painted fascia *and* a black grille mesh *and*
  chrome trim *and* a body-colored lower lip, all as one merged raw object.
- A taillight that has a red lens, a clear reverse-light section, and an
  amber indicator, originally three different materials.
- Side skirts that are body-colored on this trim level, but got bucketed into
  `Body_Trim` (a "always dark plastic" node by convention) instead of
  `Body_Misc` (paint-synced).

Every one of the user's last-round complaints — black side skirts, painted-over
grille, single-color taillights, painted-over exhaust/diffuser — traces back
to this same mismatch: the classification step picks *one bucket* for a merged
object, and the material step paints *the whole bucket* one color. Real
per-panel painting needs either (a) much finer-grained node classification
(one node per actual paintable panel, not one node per merged raw object), or
(b) material-slot-level overrides that only touch the "body paint" slot within
a multi-material mesh and leave chrome/glass/black-plastic slots alone. This
app does neither. Retrofitting either onto the current node-bucket contract is
a real redesign, not a bug fix.

## What was attempted, and where it stands

**Code architecture (Tasks 1–6, `src/three/`, `scripts/`)** — done, typechecks,
builds clean:
- `nodeNames.ts`: added `BODY_MISC` / `BUMPER_FRONT` / `BUMPER_REAR`.
- `proceduralMx5.ts` → `proceduralMods.ts`: stripped to bolt-on aero only
  (lip, skirts, diffuser, wing, hood overlay, exhaust, roll bar); all body-shell
  procedural code deleted.
- `carModel.ts`: rewritten to load the authored GLB directly, no procedural
  fallback, no compose-onto-procedural step. Fixed a real ordering bug where
  `indexNodes()` ran before `attachMods()`, so newly-attached aero nodes were
  never indexed and `selectVariant()` silently failed to hide non-default
  variants — this is why every aero mod looked "stuck on" in one round.
- `Viewport.tsx` / `sceneManager.ts`: removed the "PROCEDURAL MESH" badge.
- `validate-asset.mjs`: rewritten from a coverage-percentage report to a
  hard-fail sanity check (`Suspension_Node` and `Wheel_*`/`Rim`/`Tire`
  required, dimension/ground-plane checks kept).
- Added a debug-only "reference model" toggle (`sceneManager.toggleReference()`,
  a button in `Viewport.tsx`) that loads a raw, unclassified comparison model.
  This turned out to be the single most useful thing built all session — it's
  what let the user actually pinpoint the remaining problems precisely instead
  of me guessing from descriptions.
- `bloom: false` by default (was `true` — too intense per user).

**Asset conform (Task 7)** — the ND body was reconformed multiple times this
session, and is still not right at end of session:
1. First pass: split the *already-merged* `Body_Main` with a guessed Y-axis
   plane cut to make `Bumper_Front`/`Bumper_Rear`. **Wrong** — cut straight
   through doors/hood/fender geometry that shouldn't have been split.
2. Second pass: went back to the raw source's real separate parts (`Chassis`,
   `BumperF`, `DoorL`, `FenderFL`, `Hood`, `Boot`, ...) and classified each
   directly. Better methodology, but:
   - Ground-height calibration used a wrong heuristic ("chassis's own lowest
     vertex = ground"), which is **not true** — the rocker sill sits above
     ground clearance, the *tire* touches the ground. This is very likely
     still wrong in the final build the user has (see Known remaining issues).
   - A bulk `transform_apply()` call included both a reparented top-level
     object and its nested children (`Glass`/`DoorGlass`/`Interior`, which
     in the raw file are parented to `Chassis` as a plain object-parent, not
     to a bone) in one operation. Applying a parent and child's transform
     together in Blender double-applies the parent's contribution to the
     child. This is what caused the reference model's "floating
     windscreen/windows/sill" the user spotted.
   - After fixing that, a full rebuild was done for glass/interior/lights/roof
     too, for internal consistency. Late in that rebuild, an object-level
     `scale = (0.01, 0.01, 0.01)` was left un-baked on every rebuilt node
     (Blender's viewport composes object scale + mesh data fine, so it looked
     correct on screen; the exporter needs it actually applied to mesh
     vertices, and hadn't been told to for these specific objects). Caught
     immediately by `validate-asset.mjs` reporting ~100x-inflated bounds
     before it went anywhere further.
3. Final state at end of session (uploaded to neither the repo's committed
   history — the GLB isn't git-tracked — nor re-pushed to the GitHub release):
   local `public/assets/models/mx5_nd.glb` passes `validate-asset.mjs` and
   looks structurally complete, but the user's last screenshot shows it is
   **still wrong**: chassis sitting flat on the ground plane (no ride height),
   a duplicate floating boot-lid panel, an unexplained rectangular box poking
   out the back, and the material-bucket painting problems described above.

## Known remaining issues (as of last screenshot, unfixed)

- **Ride height / ground clearance**: the body's lowest point was grounded to
  world Z=0, same as the tire contact patch. It should sit some realistic
  clearance *above* Z=0 (rocker sill / splitter height, roughly 100–150mm for
  this class of car), with the *wheel* being the thing that touches the
  ground. This was diagnosed correctly late in the session but the fix (adding
  that clearance back in) was never applied before the session ended.
- **Duplicate boot-lid panel floating above the boot**: raw `Boot` had 4
  sub-parts, joined blindly. At least one of those 4 is very likely an
  alternate/LOD/open-state variant that should not have been merged in
  alongside the closed-boot geometry. Needs visual inspection per sub-part
  before joining, not a blind prefix-match join.
- **Rectangular object poking out the back**: unidentified — likely another
  raw sub-part (in `BumperChassisR` or similar) that's structural/hidden in
  the source scene but ended up exposed once merged into a visible node.
  Needs the same per-sub-part visual triage as the boot lid.
- **Material painting problems** (see Headline lesson above): side skirts
  black instead of body-colored, grille/exhaust/diffuser/windscreen-surround
  painted over, taillights collapsed to one flat color. Root cause is
  architectural (one material per node bucket), not a classification mistake
  that can be fixed by moving a part to a different bucket.

## Process mistakes worth naming plainly

- **I trusted a raw source file's structure without visually verifying each
  assumption.** The raw model turned out to have a non-obvious internal
  convention (every meaningful part parented to its own single-bone "helper"
  armature at 0.01 scale, almost certainly a 3ds Max unit-conversion artifact
  carried through export) that silently broke naive `matrix_world` reads.
  Every numeric assumption built on top of an unverified read compounded.
- **I kept reaching for numeric/heuristic shortcuts** (assume lowest-vertex-Z
  is ground, assume a bounding-box overlap check proves alignment) **instead
  of visually confirming early.** The screenshot pipeline in this sandboxed
  browser was broken for most of the session (0 FPS, no compositing) which
  pushed me toward numeric proxies; once it started working, direct visual
  comparison found real problems numeric checks had missed or misjudged in
  both directions.
- **I published (GitHub Release + local manifest hash) before the user had
  independently confirmed the result was correct**, twice, and both times it
  wasn't. The reference-model toggle should have existed *before* the first
  publish, not built reactively after two rounds of "this is wrong."
- **Scope crept steadily upward.** What began as "add three new node buckets"
  turned into rebuilding the entire body from raw parts, then rebuilding
  glass/interior/lights/roof too for consistency, each expansion justified in
  the moment but never re-checked against "is this still a quick proof of
  concept." The user's closing message is the right call: this should have
  stayed small.

## Recommendation for the fresh start

- Decide up front whether per-panel body painting is actually required for
  the proof of concept. If yes, the node contract needs to be panel-grained
  (or the app needs material-slot-level overrides), not bucket-grained — this
  is a design decision to make deliberately, not discover by accident.
- Get one authored body loading and looking right (position, scale, ground
  contact, stock colors, no procedural anything) *before* adding any
  classification into sub-buckets. Ride height / ground-plane correctness is
  worth a single, dedicated, visually-verified pass on its own — don't infer
  it from mesh-local bounds heuristics.
- Build the raw-vs-conformed comparison view *first*, before doing any
  conform work, not after two rounds of guessing. It's cheap to build and it
  is the only reliable way to catch this class of bug.
- Treat every raw source file as untrusted structurally, not just visually —
  check parenting, check for non-armature "helper" objects, check units,
  before writing any transform-correction code against it.
- Re-scope aggressively. If a "quick proof of concept" is the goal, resist
  each incremental "well, since I'm already in here..." expansion.
