"""
EX02 — Twin Round Tips (ND), and EX06 — Twin Oval Tips.

Both are built here because they are the same part with a different mouth: two
tips off a shared muffler, straight-cut, hollow. Running them from one script
keeps the pair genuinely consistent — the brief's warning for this category is
that misaligned twin tips are instantly visible, and two scripts drift.

EX02: 90 mm round tips, 110 mm apart.
EX06: 120x80 mm oval tips, 150 mm apart, on a larger muffler. The oval comes
from squashing a round revolve, so the mouth stays a real hollow tube.

Both sit on the measured OEM centreline — app x -287, off-centre to the
vehicle's right — with the pair straddling it.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/EX02_twin_tips.py").read())
"""

import bpy

GEN = "nd"
CX, CY = -287.0, 229.0
TIP_FRONT = -1740.0


def build(mod_id, tip_r, spacing, squash, muffler_r, muffler_len):
    n = f"MOD_{GEN.upper()}_{mod_id}_"
    reset_mods()
    coll = start_mod(GEN, mod_id)

    tips, sleeves = [], []
    for i, offset in enumerate((-spacing / 2.0, spacing / 2.0)):
        side = "L" if offset > 0 else "R"
        x = CX + offset
        wall = tip_r - 6.0
        tips.append(revolve(n + f"tip_{side}", coll, [
            (0.0,    30.0),
            (-24.0,  tip_r),
            (-140.0, tip_r),
            (-140.0, wall),
            (-24.0,  wall),
            (0.0,    26.0),
        ], (x, CY, TIP_FRONT), segments=28, gen=GEN, axis="z"))
        sleeves.append(revolve(n + f"sleeve_{side}", coll, [
            (-26.0,  0.0),
            (-26.0,  wall),
            (-140.0, wall),
            (-140.0, 0.0),
        ], (x, CY, TIP_FRONT), segments=28, gen=GEN, axis="z"))

    pipe = revolve(n + "pipe", coll, [
        (0.0, 0.0), (0.0, 34.0), (300.0, 34.0), (300.0, 0.0),
    ], (CX, CY, TIP_FRONT), segments=20, gen=GEN, axis="z")

    muffler = revolve(n + "muffler", coll, [
        (0.0, 0.0), (0.0, muffler_r), (muffler_len, muffler_r), (muffler_len, 0.0),
    ], (CX, CY, TIP_FRONT + 300.0), segments=28, gen=GEN, axis="z")
    for v in muffler.data.vertices:
        app = blender_to_app(muffler.matrix_world @ v.co, GEN)
        v.co = app_to_blender(app[0], CY + (app[1] - CY) * 0.62, app[2], GEN)
    muffler.data.update()

    # Oval mouths: squash the tips vertically about the exhaust centreline, so
    # the bore stays a real tube rather than a flat plate with a dark decal.
    if squash != 1.0:
        for obj in tips + sleeves:
            for v in obj.data.vertices:
                app = blender_to_app(obj.matrix_world @ v.co, GEN)
                v.co = app_to_blender(app[0], CY + (app[1] - CY) * squash, app[2], GEN)
            obj.data.update()

    for obj in tips:
        assign(obj, "MOD_Chrome")
    for obj in sleeves + [pipe, muffler]:
        assign(obj, "MOD_SatinBlack")

    for obj in coll.objects:
        clean(obj)
        box_uv(obj, scale=0.05)
        activate(obj)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    finalise_names(coll)
    print(f"--- {mod_id} stats ---")
    stats(coll, GEN)
    return coll


if __name__ == "__main__" or True:
    which = globals().get("WHICH", "EX02")
    if which == "EX02":
        build("EX02", tip_r=45.0, spacing=110.0, squash=1.0, muffler_r=70.0, muffler_len=560.0)
    else:
        build("EX06", tip_r=60.0, spacing=150.0, squash=0.67, muffler_r=78.0, muffler_len=600.0)
