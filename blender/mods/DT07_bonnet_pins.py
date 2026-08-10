"""
DT07 — Bonnet Pins (ND). Brief §7.6.

Small, cheap, and the thing people actually fit. Two pins near the bonnet's
leading edge, each a base plate sitting flush on the panel, a post through it, a
locking pin through a cross-hole, and a lanyard to a second anchor plate.

Every plate height comes from ray-casting the bonnet at that exact station, so
the plates lie ON the curved panel instead of hovering at a nominal height —
this is a part whose entire job is to look bolted down.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/DT07_bonnet_pins.py").read())
"""

import bpy

GEN, MOD = "nd", "DT07"
N = f"MOD_{GEN.upper()}_{MOD}_"

PIN_X = 560.0
PIN_Z = 1650.0
ANCHOR_Z = PIN_Z - 120.0     # lanyard's far end

reset_mods()
coll = start_mod(GEN, MOD)

bonnet = base_mesh("Hood 6.001_120", GEN)
parts = []

for x in (PIN_X, -PIN_X):
    side = "L" if x > 0 else "R"
    skin = surface_y(bonnet, x, PIN_Z, GEN)
    anchor_skin = surface_y(bonnet, x, ANCHOR_Z, GEN)

    # Base plate, 1 mm proud of the panel so it never z-fights.
    parts.append(block(N + f"plate_{side}", coll,
                       (x, skin + 3.0, PIN_Z), (55.0, 6.0, 55.0), gen=GEN))
    # Post through it.
    parts.append(block(N + f"post_{side}", coll,
                       (x, skin + 24.0, PIN_Z), (10.0, 46.0, 10.0), gen=GEN))
    # Locking pin through the cross-hole near the top.
    parts.append(block(N + f"clip_{side}", coll,
                       (x, skin + 40.0, PIN_Z), (34.0, 4.0, 8.0), gen=GEN))
    # Second anchor plate, and the lanyard between the two.
    parts.append(block(N + f"anchor_{side}", coll,
                       (x, anchor_skin + 3.0, ANCHOR_Z), (24.0, 5.0, 24.0), gen=GEN))
    mid = (skin + anchor_skin) / 2.0 + 4.0
    parts.append(block(N + f"lanyard_{side}", coll,
                       (x, mid, (PIN_Z + ANCHOR_Z) / 2.0),
                       (3.0, 3.0, 120.0), gen=GEN))

bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
pins = bpy.context.active_object
pins.name = pins.data.name = N + "pins"

assign(pins, "MOD_AccentPaint")
clean(pins)
box_uv(pins, scale=0.05)
bevel_smooth(pins, width=0.0008, segments=1)
activate(pins)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- DT07 stats ---")
stats(coll, GEN)
