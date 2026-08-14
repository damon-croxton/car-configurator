"""
FA06 — Tow Hook, and FA05 — Dive Planes (ND). Brief §7.3.

Two small front-end bolt-ons, both anodised and both recolourable, so they share
a script.

FA06: a tapered shaft with a real eye. The eye is an annulus revolved about the
lateral axis rather than a block with a boolean hole — a spun ring has the hole
by construction and cannot fail the way a boolean can.

FA05: two canards per side on the bumper corners. The brief is explicit that the
inboard edge must be coincident with the bumper, so they are modelled oversized
and pushed 6 mm into the body: a canard with daylight behind it is worse than
one that intersects.

Front bumper measures x +/-857, y 175..644, z 1371..1958.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/FA05_front_details.py").read())
"""

import bpy
import math

GEN = "nd"


def tow_hook():
    mod = "FA06"
    n = f"MOD_{GEN.upper()}_{mod}_"
    reset_mods()
    coll = start_mod(GEN, mod)

    # Right-hand corner of the bumper, protruding forward and slightly out.
    x, y, z = -440.0, 415.0, 1975.0

    shaft = block(n + "shaft", coll, (x, y, z - 55.0), (26.0, 34.0, 150.0), gen=GEN)
    # Taper it toward the eye.
    for v in shaft.data.vertices:
        app = blender_to_app(shaft.matrix_world @ v.co, GEN)
        if app[2] > z - 55.0:
            v.co = app_to_blender(x + (app[0] - x) * 0.72, y + (app[1] - y) * 0.72, app[2], GEN)
    shaft.data.update()

    eye = revolve(n + "eye", coll, [
        (-11.0, 22.5), (11.0, 22.5), (11.0, 44.0), (-11.0, 44.0),
    ], (x, y, z + 22.0), segments=24, gen=GEN)

    boss = revolve(n + "boss", coll, [
        (-14.0, 0.0), (-14.0, 30.0), (2.0, 30.0), (2.0, 0.0),
    ], (x, y, z - 132.0), segments=16, gen=GEN)

    bpy.ops.object.select_all(action="DESELECT")
    for o in (shaft, eye, boss):
        o.select_set(True)
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.join()
    hook = bpy.context.active_object
    hook.name = hook.data.name = n + "hook"

    assign(hook, "MOD_AccentPaint")
    clean(hook)
    box_uv(hook, scale=0.05)
    bevel_smooth(hook, width=0.0012, segments=1)
    activate(hook)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    finalise_names(coll)
    print("--- FA06 stats ---")
    stats(coll, GEN)


def canards():
    mod = "FA05"
    n = f"MOD_{GEN.upper()}_{mod}_"
    reset_mods()
    coll = start_mod(GEN, mod)

    bumper = base_mesh("BumperF 6.003_111", GEN)
    Z = 1720.0          # far enough back that the corner still has real width
    WIDTH, BURY = 190.0, 25.0

    parts = []
    for sign in (1, -1):
        side = "L" if sign > 0 else "R"
        for i, y in enumerate((480.0, 410.0)):     # 70 mm vertical gap
            # Measured, not assumed. The bumper is 857 wide at its widest and
            # only about 600 at z 1790, so a canard placed off the overall
            # bounding box hangs in mid-air instead of biting into the corner.
            skin = surface_x(bumper, y, Z, GEN, side=sign)
            centre = skin + sign * (WIDTH / 2.0 - BURY)
            plate = block(n + f"plane_{side}{i}", coll,
                          (centre, y, Z), (WIDTH, 6.0, 85.0),
                          gen=GEN, rotate_x=math.radians(12.0))
            # Upturned outer edge, which is what makes it read as a canard
            # rather than a tab.
            lip_from = abs(centre) + WIDTH / 2.0 - 40.0
            for v in plate.data.vertices:
                app = blender_to_app(plate.matrix_world @ v.co, GEN)
                if abs(app[0]) > lip_from:
                    v.co = app_to_blender(app[0], app[1] + 12.0, app[2], GEN)
            plate.data.update()
            parts.append(plate)
            print(f"  canard {side}{i}: skin x {round(skin)}, plate centred {round(centre)}")

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    set_ = bpy.context.active_object
    set_.name = set_.data.name = n + "planes"

    assign(set_, "MOD_CarbonWeave")
    clean(set_)
    box_uv(set_, scale=0.05)
    bevel_smooth(set_, width=0.0010, segments=1)
    activate(set_)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    finalise_names(coll)
    print("--- FA05 stats ---")
    stats(coll, GEN)


which = globals().get("WHICH", "FA06")
tow_hook() if which == "FA06" else canards()
