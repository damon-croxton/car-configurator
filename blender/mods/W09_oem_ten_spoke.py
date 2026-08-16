"""
W09 — OEM 16" Sport Ten-Spoke (ND). Extends the brief's numbering; not in its
catalogue, because the brief only specifies aftermarket designs. `carData.json`
already lists a second factory wheel — `oem_16_silver`, "Factory Sport
ten-spoke, lightest OEM option" — that has never had geometry, so selecting it
has always silently shown the same 17" Design wheel regardless. That is one
more instance of the exact inertness the mod pipeline exists to fix, README's
"Known limitations" included.

Factory-flavoured on purpose: thin flat spokes, modest 25mm lip depth (the
catalogue's own figure, shallower than any aftermarket design here), simple
cap, close-to-flush dish. Nothing about it should look aftermarket.

Same conventions as every wheel: contact-patch origin, left-hand side, outer
diameter matched to the measured ND tyre (641mm).

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/W09_oem_ten_spoke.py").read())
"""

import bpy

GEN, MOD = "nd", "W09"
N = f"MOD_{GEN.upper()}_{MOD}_"

PATCH = (734.0, 0.0, 1194.0)
TYRE_R = 320.5
AXLE = (PATCH[0], TYRE_R, PATCH[2])

RIM_R = 215.9            # theoretical bead-seat radius
# See W01_race_7spoke.py: the OEM asset's own rim reads out to ~258mm, not a
# bare 17in bead-seat conversion. Corrected by scaling the finished face
# afterward (scale_wheel_face) rather than reworking every absolute spoke
# number in this file.
RIM_SCALE = 258.0 / RIM_R
HALF_W = 114.3
FACE_X = 38.0          # closer to flush than any aftermarket design here
SPOKES = 10
R_IN, R_OUT = 60.0, 208.0

reset_mods()
coll = start_mod(GEN, MOD)

tyre = revolve(N + "tyre", coll, tyre_profile(RIM_R, TYRE_R, HALF_W, RIM_SCALE), AXLE, segments=56, gen=GEN)

for v in tyre.data.vertices:
    app = blender_to_app(tyre.matrix_world @ v.co, GEN)
    if app[1] < 8:
        v.co = app_to_blender(app[0], 0.0, app[2], GEN)
tyre.data.update()

# Shallow 25mm lip — the catalogue's own lipDepth figure for this wheel.
rim = revolve(N + "rim", coll, [
    (HALF_W,        RIM_R),
    (HALF_W - 6,    RIM_R - 5),
    (HALF_W - 16,   RIM_R - 10),
    (25,            RIM_R - 30),
    (-HALF_W + 18,  RIM_R - 11),
    (-HALF_W + 7,   RIM_R - 6),
    (-HALF_W,       RIM_R),
    (-HALF_W,       RIM_R - 4),
    (HALF_W,        RIM_R - 4),
], AXLE, segments=56, gen=GEN)

hub = revolve(N + "hub", coll, [
    (FACE_X,      27.05),
    (FACE_X + 7,  27.05),
    (FACE_X + 7,  92.0),
    (FACE_X,      92.0),
], AXLE, segments=48, gen=GEN)

# Simple domed cap, no aftermarket flourish.
cap = revolve(N + "cap", coll, [
    (FACE_X + 7,   0.0),
    (FACE_X + 13,  0.0),
    (FACE_X + 13,  34.0),
    (FACE_X + 7,   38.0),
], AXLE, segments=32, gen=GEN)

# Thin, flat, barely tapered — this is what separates a factory wheel from an
# aftermarket one more than any other single choice.
mid_r = (R_IN + R_OUT) / 2.0
spoke = block(N + "spokes", coll,
              (AXLE[0] + FACE_X + 2, AXLE[1] + mid_r, AXLE[2]),
              (14.0, R_OUT - R_IN, 30.0), gen=GEN)
for v in spoke.data.vertices:
    app = blender_to_app(spoke.matrix_world @ v.co, GEN)
    t = max(0.0, min(1.0, (app[1] - AXLE[1] - R_IN) / (R_OUT - R_IN)))
    z = AXLE[2] + (app[2] - AXLE[2]) * (1.0 - 0.14 * t)   # modest taper only
    v.co = app_to_blender(app[0], app[1], z, GEN)
spoke.data.update()
spokes = radial_copies(spoke, SPOKES, AXLE, GEN)

lug = revolve(N + "lugs", coll, [
    (FACE_X + 7,   0.0),
    (FACE_X + 14,  0.0),
    (FACE_X + 14,  9.0),
    (FACE_X + 7,   11.0),
], (AXLE[0], AXLE[1] + 50.0, AXLE[2]), segments=6, gen=GEN)
lugs = radial_copies(lug, 4, AXLE, GEN)

disc = revolve(N + "disc", coll, [
    (FACE_X - 20, 44.0),
    (FACE_X - 20, 130.0),
    (FACE_X - 38, 130.0),
    (FACE_X - 38, 44.0),
], AXLE, segments=40, gen=GEN)

caliper = block(N + "caliper", coll,
                (AXLE[0] + FACE_X - 28, AXLE[1] + 4.0, AXLE[2] - 140.0),
                (50.0, 118.0, 40.0), gen=GEN)

for obj, material in (
    (rim, "MOD_Rim"), (spokes, "MOD_Rim"), (hub, "MOD_Rim"), (cap, "MOD_Rim"),
    (lugs, "MOD_Chrome"), (tyre, "MOD_Tyre"), (disc, "MOD_Chrome"),
    (caliper, "MOD_CaliperPaint"),
):
    assign(obj, material)

for obj in coll.objects:
    clean(obj)
    box_uv(obj, scale=0.05)
bevel_smooth(spokes, width=0.001, segments=1)

for obj in coll.objects:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

scale_wheel_face(coll, RIM_SCALE, AXLE, GEN)

finalise_names(coll)
print("--- W09 stats ---")
stats(coll, GEN)
