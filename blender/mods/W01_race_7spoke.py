"""
W01 — Lightweight Race 7-Spoke (ND, 17x9 ET35). Brief §7.2.

The wheel that proves the pipeline, so the conventions matter more than the
styling:

  * Origin is the CONTACT PATCH, not the hub face. The app parents wheels to a
    pivot sitting on the ground and scales about it, so a wheel built this way
    inherits diameter, camber and track offset for free (brief §2.2).
  * Modelled for the LEFT side only. The right-hand instance is placed with
    rotation.y = pi, a rigid transform, so nothing has to mirror and no winding
    gets flipped.
  * Outer tyre diameter is 641 mm because that is what the ND's wheels MEASURE.
    The catalogue's 205/45R17 would be 616 — build to the asset, not the spec
    sheet, or every car with this wheel fitted changes ride height.

Wheel-local geometry, all app mm, axle at (734, 320.5, 1194):
  rim         17in -> 215.9 radius, 9in -> 228.6 wide, ET35
  tyre        320.5 outer radius, 260 wide, bead at the rim
  spokes      7, hub r68 -> rim r213, so they bridge both and merge at each end

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/W01_race_7spoke.py").read())
"""

import bpy
import math

GEN, MOD = "nd", "W01"
N = f"MOD_{GEN.upper()}_{MOD}_"

PATCH = (734.0, 0.0, 1194.0)          # contact patch: the export origin
TYRE_R = 320.5                        # measured, not from the tyre code
AXLE = (PATCH[0], TYRE_R, PATCH[2])

RIM_R = 215.9                         # 17 inch, theoretical bead-seat radius
HALF_W = 114.3                        # 9 inch
# The OEM asset's own rim measures its visible face out to ~258mm, not the
# 215.9mm a bare bead-seat conversion gives -- the metal reads further out
# and the tyre sidewall correspondingly shorter than that theoretical figure
# on every built wheel. Correcting RIM_R itself would leave the spokes (built
# to fixed absolute lengths, not a RIM_R-relative formula) short of a barrel
# that just grew, so the whole already-built face is scaled as one rigid
# unit afterward instead — see scale_wheel_face() in mx5_lib.py.
RIM_SCALE = 258.0 / RIM_R
ET = 35.0                             # hub face this far outboard of centreline
FACE_X = ET                           # +X is outboard on the left-hand wheel
SPOKES = 7

reset_mods()
coll = start_mod(GEN, MOD)

# -- tyre -------------------------------------------------------------------
# Circumferential grooves come free from the profile: stepping the tread radius
# down 2 mm and back gives real grooves all the way round for four extra rings,
# where modelling tread blocks would cost thousands of triangles nobody sees.
tyre = revolve(N + "tyre", coll, [
    (-HALF_W,      RIM_R),
    (-HALF_W - 10, RIM_R + 50),
    (-HALF_W - 10, RIM_R + 82),
    (-118,         TYRE_R - 3),
    (-96,          TYRE_R),
    (-52,          TYRE_R),
    (-48,          TYRE_R - 2),        # groove
    (-44,          TYRE_R),
    (44,           TYRE_R),
    (48,           TYRE_R - 2),        # groove
    (52,           TYRE_R),
    (96,           TYRE_R),
    (118,          TYRE_R - 3),
    (HALF_W + 10,  RIM_R + 82),
    (HALF_W + 10,  RIM_R + 50),
    (HALF_W,       RIM_R),
], AXLE, segments=56, gen=GEN)

# Flatten the contact patch. A perfectly round tyre reads as hovering even when
# it is touching, because nothing deforms.
for v in tyre.data.vertices:
    app = blender_to_app(tyre.matrix_world @ v.co, GEN)
    if app[1] < 8:
        v.co = app_to_blender(app[0], 0.0, app[2], GEN)
tyre.data.update()

# -- rim barrel -------------------------------------------------------------
# Outer lip -> outer bead seat -> drop centre -> inner bead seat -> inner lip.
rim = revolve(N + "rim", coll, [
    (HALF_W,        RIM_R),
    (HALF_W - 7,    RIM_R - 6),
    (HALF_W - 18,   RIM_R - 11),
    (30,            RIM_R - 31),       # drop centre
    (-HALF_W + 18,  RIM_R - 11),
    (-HALF_W + 7,   RIM_R - 6),
    (-HALF_W,       RIM_R),
    (-HALF_W,       RIM_R - 4),
    (HALF_W,        RIM_R - 4),
], AXLE, segments=56, gen=GEN)

# -- hub face ---------------------------------------------------------------
# An annulus, so the 54.1 mm centre bore is there by construction rather than
# by boolean.
hub = revolve(N + "hub", coll, [
    (FACE_X,      27.05),
    (FACE_X + 7,  27.05),
    (FACE_X + 7,  104.0),
    (FACE_X,      104.0),
], AXLE, segments=48, gen=GEN)

cap = revolve(N + "cap", coll, [
    (FACE_X + 7,  0.0),
    (FACE_X + 14, 0.0),
    (FACE_X + 14, 46.0),
    (FACE_X + 7,  52.0),
], AXLE, segments=32, gen=GEN)

# -- spokes -----------------------------------------------------------------
# Straight and tapered, from the hub disc out to the rim's inner face. Each
# spans r68..r213 against a hub that reaches r104 and a barrel whose drop centre
# sits at r185, so both ends genuinely intersect rather than approaching.
#
# Their X extent matters as much as their length. The hub MOUNTING face sits at
# ET35, i.e. 79 mm inboard of the outer lip; putting the spoke face there too
# gives a wheel that looks like a deep dish. A real flat-face wheel carries its
# spokes forward from the recessed hub to sit near the lip plane, so these span
# x 40..92 and pick up both.
spoke = block(N + "spokes", coll,
              (AXLE[0] + FACE_X + 31, AXLE[1] + 140.0, AXLE[2]),
              (52.0, 145.0, 44.0), gen=GEN)
# Taper: narrow the outboard end, which is the top in local terms.
for v in spoke.data.vertices:
    app = blender_to_app(spoke.matrix_world @ v.co, GEN)
    if app[1] > AXLE[1] + 140.0:
        d = app[2] - AXLE[2]
        v.co = app_to_blender(app[0], app[1], AXLE[2] + d * 0.72, GEN)
spoke.data.update()
spokes = radial_copies(spoke, SPOKES, AXLE, GEN)

# Lug nuts, on a 100 mm PCD at 0/90/180/270.
lug = revolve(N + "lugs", coll, [
    (FACE_X + 7,   0.0),
    (FACE_X + 15,  0.0),
    (FACE_X + 15,  9.0),
    (FACE_X + 7,   11.0),
], (AXLE[0], AXLE[1] + 50.0, AXLE[2]), segments=6, gen=GEN)
lugs = radial_copies(lug, 4, AXLE, GEN)

# -- brake disc and caliper -------------------------------------------------
disc = revolve(N + "disc", coll, [
    (FACE_X - 24, 44.0),
    (FACE_X - 24, 140.0),
    (FACE_X - 46, 140.0),
    (FACE_X - 46, 44.0),
], AXLE, segments=40, gen=GEN)

caliper = block(N + "caliper", coll,
                (AXLE[0] + FACE_X - 35, AXLE[1] + 4.0, AXLE[2] - 152.0),
                (58.0, 132.0, 46.0), gen=GEN)

# -- materials, finish ------------------------------------------------------
assign(rim, "MOD_Rim")
assign(spokes, "MOD_Rim")
assign(hub, "MOD_Rim")
assign(cap, "MOD_Rim")
assign(lugs, "MOD_Chrome")
assign(tyre, "MOD_Tyre")
assign(disc, "MOD_Chrome")
assign(caliper, "MOD_CaliperPaint")

for obj in coll.objects:
    clean(obj)
    box_uv(obj, scale=0.05)
bevel_smooth(spokes, width=0.0015, segments=1)
bevel_smooth(caliper, width=0.002, segments=1)

for obj in coll.objects:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

scale_wheel_face(coll, RIM_SCALE, AXLE, GEN)

finalise_names(coll)
print("--- W01 stats ---")
stats(coll, GEN)
print("export origin (contact patch):", PATCH)
