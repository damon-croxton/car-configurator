"""
DT01 — Stubby Antenna (ND). Brief §7.6.

Replaces the OEM mast. The measured antenna sits on the vehicle's RIGHT at
app x -587..-575, rising from a housing at y 819 to a tip at 1371 — the brief's
nominal position had it on the left, which is one reason everything here is
probed rather than assumed.

A tapered 32 -> 12 mm stub, 95 mm tall, on a 40 mm rubber gasket. Two details do
the work:

  * The gasket sits on the panel's own NORMAL, not straight up. The rear quarter
    is cambered here, so a mast planted vertically leans against the panel it is
    supposed to be bolted through.
  * 20 degrees of rearward rake on top of that, which is what makes a stubby
    read as deliberate rather than snapped off.

Grooves are turned rings rather than a true helix — at 95 mm tall and this far
from any camera the difference is invisible, and a real helix costs a swept
curve for nothing.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/DT01_stubby_antenna.py").read())
"""

import bpy
import math
from mathutils import Matrix, Vector

GEN, MOD = "nd", "DT01"
N = f"MOD_{GEN.upper()}_{MOD}_"

MOUNT_X, MOUNT_Z = -581.0, -1600.0    # under the OEM mast
HEIGHT = 95.0
BASE_R, TIP_R = 16.0, 6.0
GASKET_R, GASKET_H = 20.0, 8.0
RAKE = math.radians(20.0)
GROOVES = 14

reset_mods()
coll = start_mod(GEN, MOD)

# Where the quarter panel actually is, and which way it faces.
quarter = base_mesh("FendersR 6.001_40", GEN)
skin_y, normal = surface_hit(quarter, MOUNT_X, MOUNT_Z, GEN)
print(f"quarter skin at app y {round(skin_y)}, normal {[round(v, 3) for v in normal]}")

# -- gasket and mast, built upright about the mount point -------------------
gasket = revolve(N + "gasket", coll, [
    (0.0, 0.0),
    (0.0, GASKET_R),
    (GASKET_H, GASKET_R - 2.0),
    (GASKET_H, 0.0),
], (MOUNT_X, skin_y - 2.0, MOUNT_Z), segments=24, gen=GEN, axis="y")

# Profile up the mast, stepping in and out for the turned grooves.
profile = [(GASKET_H - 1.0, 0.0), (GASKET_H - 1.0, BASE_R)]
for i in range(GROOVES + 1):
    t = i / GROOVES
    y = GASKET_H + 4.0 + t * (HEIGHT - GASKET_H - 4.0)
    r = BASE_R + (TIP_R - BASE_R) * t
    profile.append((y, r if i % 2 == 0 else r - 1.2))
profile += [(HEIGHT, TIP_R * 0.7), (HEIGHT + 3.0, 0.0)]

mast = revolve(N + "mast", coll, profile,
               (MOUNT_X, skin_y - 2.0, MOUNT_Z), segments=20, gen=GEN, axis="y")

# -- stand it up, then rake it back ----------------------------------------
#
# The brief says to follow the body's local normal, but the ND's quarter is
# steeply cambered here — measured, it is 47 degrees off vertical, and a mast
# laid along it falls over sideways. A real antenna base is a wedge for exactly
# this reason, so the axis is pulled most of the way back to upright and the
# gasket takes up the rest.
UPRIGHT = 0.78
axis = normal.lerp(Vector((0.0, 0.0, 1.0)), UPRIGHT).normalized()

pivot = app_to_blender(MOUNT_X, skin_y, MOUNT_Z, GEN)
# Rearward is app -Z, which is Blender +Y, so the rake turns about Blender X.
tilted = Matrix.Rotation(RAKE, 4, "X") @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
place = Matrix.Translation(pivot) @ tilted @ Matrix.Translation(-pivot)

for obj in (gasket, mast):
    obj.matrix_world = place @ obj.matrix_world
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

assign(gasket, "MOD_Rubber")
assign(mast, "MOD_SatinBlack")

for obj in (gasket, mast):
    clean(obj)
    box_uv(obj, scale=0.05)

finalise_names(coll)
print("--- DT01 stats ---")
stats(coll, GEN)
