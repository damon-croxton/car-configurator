"""
W05 — Classic Mesh (ND, 16x8 ET35). Brief §7.2, adapted.

Matches `bbs_mesh` in carData.json — "Three-piece cross-mesh with polished step
lip", spokeCount 12 — rather than the brief's nominal 8, the same kind of
deviation W04 already makes: build to what the catalogue actually specifies,
not the brief's illustrative number.

The brief's instruction for this design is exact: build one wedge of mesh and
circular-array it, never model individual struts. One wedge here is a radial
spoke plus a diagonal brace running to the next spoke's root, which is what
actually reads as a lattice rather than a spoked wheel with lines on it.

Same conventions as every wheel: contact-patch origin, left-hand side, outer
diameter matched to the measured ND tyre (641 mm), not the 205/45R17 spec.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/W05_classic_mesh.py").read())
"""

import bpy
import math
from mathutils import Matrix

GEN, MOD = "nd", "W05"
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
FACE_X = 30.0
SPOKES = 12
R_IN, R_OUT = 60.0, 210.0

reset_mods()
coll = start_mod(GEN, MOD)

tyre = revolve(N + "tyre", coll, tyre_profile(RIM_R, TYRE_R, HALF_W, RIM_SCALE), AXLE, segments=56, gen=GEN)

for v in tyre.data.vertices:
    app = blender_to_app(tyre.matrix_world @ v.co, GEN)
    if app[1] < 8:
        v.co = app_to_blender(app[0], 0.0, app[2], GEN)
tyre.data.update()

# Stepped outer lip, ~15mm visible per the brief.
rim = revolve(N + "rim", coll, [
    (HALF_W,        RIM_R),
    (HALF_W - 15,   RIM_R - 5),
    (HALF_W - 22,   RIM_R - 11),
    (25,            RIM_R - 32),
    (-HALF_W + 18,  RIM_R - 11),
    (-HALF_W + 7,   RIM_R - 6),
    (-HALF_W,       RIM_R),
    (-HALF_W,       RIM_R - 4),
    (HALF_W,        RIM_R - 4),
], AXLE, segments=56, gen=GEN)

hub = revolve(N + "hub", coll, [
    (FACE_X,      27.05),
    (FACE_X + 8,  27.05),
    (FACE_X + 8,  96.0),
    (FACE_X,      96.0),
], AXLE, segments=48, gen=GEN)

cap = revolve(N + "cap", coll, [
    (FACE_X + 8,   0.0),
    (FACE_X + 16,  0.0),
    (FACE_X + 16,  44.0),
    (FACE_X + 8,   50.0),
], AXLE, segments=32, gen=GEN)

# -- mesh wedge: one radial spoke + one diagonal brace, arrayed 12x ---------
step_deg = 360.0 / SPOKES
spoke_mid_r = (R_IN + R_OUT) / 2.0

spoke = block(N + "spoke_unit", coll,
              (AXLE[0] + FACE_X + 4, AXLE[1] + spoke_mid_r, AXLE[2]),
              (16.0, R_OUT - R_IN, 20.0), gen=GEN)

# Diagonal brace: a thin bar from the spoke's mid-radius out to the NEXT
# spoke's position at the rim, built by rotating a radial bar half a step and
# tilting it — this is the crosshatch that makes it read as mesh, not spokes.
brace = block(N + "brace_unit", coll,
              (AXLE[0] + FACE_X + 2, AXLE[1] + (R_IN + R_OUT * 1.05) / 2.0, AXLE[2]),
              (10.0, (R_OUT * 1.05 - R_IN), 14.0), gen=GEN)
brace_pivot = app_to_blender(*AXLE, gen=GEN)
brace.matrix_world = (
    Matrix.Translation(brace_pivot)
    @ Matrix.Rotation(math.radians(step_deg * 0.5), 4, "X")
    @ Matrix.Translation(-brace_pivot)
    @ brace.matrix_world
)
activate(brace)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.object.select_all(action="DESELECT")
spoke.select_set(True); brace.select_set(True)
bpy.context.view_layer.objects.active = spoke
bpy.ops.object.join()
wedge = bpy.context.active_object
wedge.name = wedge.data.name = N + "spokes"
spokes = radial_copies(wedge, SPOKES, AXLE, GEN)

lug = revolve(N + "lugs", coll, [
    (FACE_X + 8,   0.0),
    (FACE_X + 16,  0.0),
    (FACE_X + 16,  9.0),
    (FACE_X + 8,   11.0),
], (AXLE[0], AXLE[1] + 50.0, AXLE[2]), segments=6, gen=GEN)
lugs = radial_copies(lug, 4, AXLE, GEN)

disc = revolve(N + "disc", coll, [
    (FACE_X - 22, 44.0),
    (FACE_X - 22, 136.0),
    (FACE_X - 42, 136.0),
    (FACE_X - 42, 44.0),
], AXLE, segments=40, gen=GEN)

caliper = block(N + "caliper", coll,
                (AXLE[0] + FACE_X - 32, AXLE[1] + 4.0, AXLE[2] - 148.0),
                (56.0, 128.0, 44.0), gen=GEN)

for obj, material in (
    (rim, "MOD_Rim"), (spokes, "MOD_Rim"), (hub, "MOD_Rim"), (cap, "MOD_Rim"),
    (lugs, "MOD_Chrome"), (tyre, "MOD_Tyre"), (disc, "MOD_Chrome"),
    (caliper, "MOD_CaliperPaint"),
):
    assign(obj, material)

for obj in coll.objects:
    clean(obj)
    box_uv(obj, scale=0.05)
bevel_smooth(spokes, width=0.0012, segments=1)

for obj in coll.objects:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

scale_wheel_face(coll, RIM_SCALE, AXLE, GEN)

finalise_names(coll)
print("--- W05 stats ---")
stats(coll, GEN)
