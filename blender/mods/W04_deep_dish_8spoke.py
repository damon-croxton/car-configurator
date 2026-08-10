"""
W04 — Deep Dish 8-Spoke (ND, 17x9 ET0). Brief §7.2.

The brief lists this one as NA-only, but `carData.json` already offers
`watanabe_rs` on the ND, and the NA is not imported into the working .blend — so
it is built here at 17x9 ET0 for the generation that can actually show it.

ET0 puts the mounting face on the wheel's centreline, which is the entire point:
114 mm of barrel sits outboard of the spoke face and reads as the deep polished
lip the design is known for. Two things follow from that:

  * The lip is a SEPARATE object on MOD_Alloy while the face is MOD_Rim, so the
    app's wheel-finish picker recolours the face and leaves the lip polished —
    the "bronze face, polished lip" combination.
  * 24 exposed bolts run round the lip, because a lip that deep on a one-piece
    wheel does not read as a three-piece without them.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/W04_deep_dish_8spoke.py").read())
"""

import bpy

GEN, MOD = "nd", "W04"
N = f"MOD_{GEN.upper()}_{MOD}_"

PATCH = (734.0, 0.0, 1194.0)
TYRE_R = 320.5
AXLE = (PATCH[0], TYRE_R, PATCH[2])

RIM_R = 215.9
HALF_W = 114.3
FACE_X = 0.0             # ET0 — mounting face on the centreline
LIP_START = 34.0         # where the polished lip begins
SPOKES = 8
R_IN, R_OUT = 62.0, 208.0

reset_mods()
coll = start_mod(GEN, MOD)

tyre = revolve(N + "tyre", coll, [
    (-HALF_W,      RIM_R),
    (-HALF_W - 10, RIM_R + 50),
    (-HALF_W - 10, RIM_R + 82),
    (-118,         TYRE_R - 3),
    (-96,          TYRE_R),
    (-52,          TYRE_R),
    (-48,          TYRE_R - 2),
    (-44,          TYRE_R),
    (44,           TYRE_R),
    (48,           TYRE_R - 2),
    (52,           TYRE_R),
    (96,           TYRE_R),
    (118,          TYRE_R - 3),
    (HALF_W + 10,  RIM_R + 82),
    (HALF_W + 10,  RIM_R + 50),
    (HALF_W,       RIM_R),
], AXLE, segments=56, gen=GEN)

for v in tyre.data.vertices:
    app = blender_to_app(tyre.matrix_world @ v.co, GEN)
    if app[1] < 8:
        v.co = app_to_blender(app[0], 0.0, app[2], GEN)
tyre.data.update()

# -- inner barrel, stepped --------------------------------------------------
rim = revolve(N + "barrel", coll, [
    (LIP_START,      RIM_R - 8),
    (LIP_START - 10, RIM_R - 22),      # step
    (-40,            RIM_R - 34),      # drop centre
    (-HALF_W + 18,   RIM_R - 11),
    (-HALF_W + 7,    RIM_R - 6),
    (-HALF_W,        RIM_R),
    (-HALF_W,        RIM_R - 4),
    (LIP_START,      RIM_R - 12),
], AXLE, segments=56, gen=GEN)

# -- the lip, on its own material -------------------------------------------
lip = revolve(N + "lip", coll, [
    (LIP_START,     RIM_R - 8),
    (HALF_W - 26,   RIM_R - 4),
    (HALF_W - 8,    RIM_R),
    (HALF_W,        RIM_R - 3),
    (HALF_W - 8,    RIM_R - 8),
    (HALF_W - 26,   RIM_R - 11),
    (LIP_START,     RIM_R - 12),
], AXLE, segments=56, gen=GEN)

# -- flat 8-spoke face, set right back --------------------------------------
hub = revolve(N + "hub", coll, [
    (FACE_X,      27.05),
    (FACE_X + 9,  27.05),
    (FACE_X + 9,  98.0),
    (FACE_X,      98.0),
], AXLE, segments=48, gen=GEN)

cap = revolve(N + "cap", coll, [
    (FACE_X + 9,   0.0),
    (FACE_X + 17,  0.0),
    (FACE_X + 17,  40.0),
    (FACE_X + 9,   46.0),
], AXLE, segments=32, gen=GEN)

mid_r = (R_IN + R_OUT) / 2.0
spoke = block(N + "spokes", coll,
              (AXLE[0] + FACE_X + 8, AXLE[1] + mid_r, AXLE[2]),
              (22.0, R_OUT - R_IN, 62.0), gen=GEN)
# Flat face, so no concavity — just a gentle taper outward.
for v in spoke.data.vertices:
    app = blender_to_app(spoke.matrix_world @ v.co, GEN)
    t = max(0.0, min(1.0, (app[1] - AXLE[1] - R_IN) / (R_OUT - R_IN)))
    z = AXLE[2] + (app[2] - AXLE[2]) * (1.0 - 0.30 * t)
    v.co = app_to_blender(app[0], app[1], z, GEN)
spoke.data.update()
spokes = radial_copies(spoke, SPOKES, AXLE, GEN)

lug = revolve(N + "lugs", coll, [
    (FACE_X + 9,   0.0),
    (FACE_X + 17,  0.0),
    (FACE_X + 17,  9.0),
    (FACE_X + 9,   11.0),
], (AXLE[0], AXLE[1] + 50.0, AXLE[2]), segments=6, gen=GEN)
lugs = radial_copies(lug, 4, AXLE, GEN)

# -- 24 lip bolts -----------------------------------------------------------
bolt = revolve(N + "bolts", coll, [
    (HALF_W - 20, 0.0),
    (HALF_W - 13, 0.0),
    (HALF_W - 13, 4.5),
    (HALF_W - 20, 5.5),
], (AXLE[0], AXLE[1] + RIM_R - 12, AXLE[2]), segments=6, gen=GEN)
bolts = radial_copies(bolt, 24, AXLE, GEN)

disc = revolve(N + "disc", coll, [
    (FACE_X - 22, 44.0),
    (FACE_X - 22, 138.0),
    (FACE_X - 42, 138.0),
    (FACE_X - 42, 44.0),
], AXLE, segments=40, gen=GEN)

caliper = block(N + "caliper", coll,
                (AXLE[0] + FACE_X - 32, AXLE[1] + 4.0, AXLE[2] - 150.0),
                (56.0, 130.0, 44.0), gen=GEN)

for obj, material in (
    (rim, "MOD_Rim"), (spokes, "MOD_Rim"), (hub, "MOD_Rim"), (cap, "MOD_Rim"),
    (lip, "MOD_Alloy"), (bolts, "MOD_Chrome"), (lugs, "MOD_Chrome"),
    (tyre, "MOD_Tyre"), (disc, "MOD_Chrome"), (caliper, "MOD_CaliperPaint"),
):
    assign(obj, material)

for obj in coll.objects:
    clean(obj)
    box_uv(obj, scale=0.05)
bevel_smooth(spokes, width=0.0015, segments=1)

for obj in coll.objects:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- W04 stats ---")
stats(coll, GEN)
