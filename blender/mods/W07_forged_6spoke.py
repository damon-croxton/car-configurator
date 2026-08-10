"""
W07 — Forged 6-Spoke Concave (ND, 17x9 ET25). Brief §7.2.

Same conventions as W01 — contact-patch origin, left-hand side, 641 mm outer
diameter measured off the asset — with two deliberate differences that are the
whole character of the design:

  * ET25 rather than ET35, so the hub face sits 10 mm further inboard and there
    is visibly more barrel outside the spoke face.
  * The spokes are genuinely CONCAVE. Their face is pulled ~34 mm inboard at the
    hub and rises to meet the lip plane at the rim, following (1-t)^1.6. Six wide
    flat-topped spokes with that curve is the shape people recognise; six flat
    slabs at a constant depth is a different wheel entirely.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/W07_forged_6spoke.py").read())
"""

import bpy

GEN, MOD = "nd", "W07"
N = f"MOD_{GEN.upper()}_{MOD}_"

PATCH = (734.0, 0.0, 1194.0)
TYRE_R = 320.5
AXLE = (PATCH[0], TYRE_R, PATCH[2])

RIM_R = 215.9
HALF_W = 114.3
FACE_X = 25.0            # ET25 — more dish than W01
SPOKES = 6
R_IN, R_OUT = 66.0, 213.0
CONCAVE = 34.0           # how far the spoke face is pulled in at the hub

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

rim = revolve(N + "rim", coll, [
    (HALF_W,        RIM_R),
    (HALF_W - 7,    RIM_R - 6),
    (HALF_W - 18,   RIM_R - 11),
    (20,            RIM_R - 33),
    (-HALF_W + 18,  RIM_R - 11),
    (-HALF_W + 7,   RIM_R - 6),
    (-HALF_W,       RIM_R),
    (-HALF_W,       RIM_R - 4),
    (HALF_W,        RIM_R - 4),
], AXLE, segments=56, gen=GEN)

hub = revolve(N + "hub", coll, [
    (FACE_X,      27.05),
    (FACE_X + 8,  27.05),
    (FACE_X + 8,  100.0),
    (FACE_X,      100.0),
], AXLE, segments=48, gen=GEN)

# A prominent cap — one of the design's signatures.
cap = revolve(N + "cap", coll, [
    (FACE_X + 8,   0.0),
    (FACE_X + 20,  0.0),
    (FACE_X + 20,  52.0),
    (FACE_X + 8,   60.0),
], AXLE, segments=32, gen=GEN)

# -- spokes: wide, flat-topped, and concave ---------------------------------
mid_r = (R_IN + R_OUT) / 2.0
spoke = block(N + "spokes", coll,
              (AXLE[0] + FACE_X + 34, AXLE[1] + mid_r, AXLE[2]),
              (58.0, R_OUT - R_IN, 76.0), gen=GEN)

for v in spoke.data.vertices:
    app = blender_to_app(spoke.matrix_world @ v.co, GEN)
    r = app[1] - AXLE[1]
    t = max(0.0, min(1.0, (r - R_IN) / (R_OUT - R_IN)))
    # Concavity: deepest at the hub, flush with the lip plane at the rim.
    x = app[0] - CONCAVE * (1.0 - t) ** 1.6
    # Taper the width toward the rim, and chamfer the outer corners.
    z = AXLE[2] + (app[2] - AXLE[2]) * (1.0 - 0.24 * t)
    v.co = app_to_blender(x, app[1], z, GEN)
spoke.data.update()
spokes = radial_copies(spoke, SPOKES, AXLE, GEN)

lug = revolve(N + "lugs", coll, [
    (FACE_X + 8,   0.0),
    (FACE_X + 16,  0.0),
    (FACE_X + 16,  9.0),
    (FACE_X + 8,   11.0),
], (AXLE[0], AXLE[1] + 50.0, AXLE[2]), segments=6, gen=GEN)
lugs = radial_copies(lug, 4, AXLE, GEN)

disc = revolve(N + "disc", coll, [
    (FACE_X - 24, 44.0),
    (FACE_X - 24, 142.0),
    (FACE_X - 46, 142.0),
    (FACE_X - 46, 44.0),
], AXLE, segments=40, gen=GEN)

caliper = block(N + "caliper", coll,
                (AXLE[0] + FACE_X - 35, AXLE[1] + 4.0, AXLE[2] - 154.0),
                (58.0, 132.0, 46.0), gen=GEN)

for obj, material in (
    (rim, "MOD_Rim"), (spokes, "MOD_Rim"), (hub, "MOD_Rim"), (cap, "MOD_Rim"),
    (lugs, "MOD_Chrome"), (tyre, "MOD_Tyre"), (disc, "MOD_Chrome"),
    (caliper, "MOD_CaliperPaint"),
):
    assign(obj, material)

for obj in coll.objects:
    clean(obj)
    box_uv(obj, scale=0.05)
bevel_smooth(spokes, width=0.002, segments=1)
bevel_smooth(caliper, width=0.002, segments=1)

for obj in coll.objects:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- W07 stats ---")
stats(coll, GEN)
