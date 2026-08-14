"""
DT02 — Antenna Delete Plug (ND). Brief §7.6.

Trivial, but the brief is right that it's what people actually pick. A domed
disc conformed to the quarter panel at the same measured mount point as DT01
(app x -581, on the vehicle's right), 4mm proud, body-coloured.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/DT02_antenna_delete.py").read())
"""

import bpy

GEN, MOD = "nd", "DT02"
N = f"MOD_{GEN.upper()}_{MOD}_"

MOUNT_X, MOUNT_Z = -581.0, -1600.0
RADIUS, PROUD = 18.0, 4.0

reset_mods()
coll = start_mod(GEN, MOD)

quarter = base_mesh("FendersR 6.001_40", GEN)
skin_y, _normal = surface_hit(quarter, MOUNT_X, MOUNT_Z, GEN)

plug = revolve(N + "plug", coll, [
    (0.0, 0.0),
    (0.0, RADIUS),
    (PROUD * 0.7, RADIUS * 0.7),
    (PROUD, 0.0),
], (MOUNT_X, skin_y - 1.0, MOUNT_Z), segments=24, gen=GEN, axis="y")

assign(plug, "MOD_BodyPaint")
clean(plug)
box_uv(plug, scale=0.05)
activate(plug)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- DT02 stats ---")
stats(coll, GEN)
