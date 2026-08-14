"""
EX03 — Quad Centre-Exit (ND). Brief §7.7.

Same hollow-tube technique as EX01/EX02/EX06: each tip is a revolved profile
with a separate dark sleeve so there is a real bore to see into, not a solid rod
with a cap. Four tips in a 2x2 arrangement, offset from the measured OEM
centreline (app x -287) rather than the vehicle centreline the brief's "quad
centre-exit" name implies — the ND's own tips are not centred either.

Sits in a gloss-black surround valance, since a quad exit needs its own cutout
in the bumper and this app cannot cut the base mesh — the surround is what
reads as "this bumper was built for this exhaust" without editing the asset.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/EX03_quad_exit.py").read())
"""

import bpy

GEN, MOD = "nd", "EX03"
N = f"MOD_{GEN.upper()}_{MOD}_"

CX, CY = -287.0, 229.0
TIP_FRONT = -1740.0
TIP_R = 38.0
OFFSETS = [(-95.0, 32.5), (95.0, 32.5), (-95.0, -32.5), (95.0, -32.5)]

reset_mods()
coll = start_mod(GEN, MOD)

tips, sleeves = [], []
for i, (ox, oy) in enumerate(OFFSETS):
    x, y = CX + ox, CY + oy
    wall = TIP_R - 5.0
    tips.append(revolve(N + f"tip_{i}", coll, [
        (0.0,   20.0),
        (-18.0, TIP_R),
        (-90.0, TIP_R),
        (-90.0, wall),
        (-18.0, wall),
        (0.0,   17.0),
    ], (x, y, TIP_FRONT), segments=24, gen=GEN, axis="z"))
    sleeves.append(revolve(N + f"sleeve_{i}", coll, [
        (-19.0, 0.0),
        (-19.0, wall),
        (-90.0, wall),
        (-90.0, 0.0),
    ], (x, y, TIP_FRONT), segments=24, gen=GEN, axis="z"))

bpy.ops.object.select_all(action="DESELECT")
for t in tips:
    t.select_set(True)
bpy.context.view_layer.objects.active = tips[0]
bpy.ops.object.join()
quad = bpy.context.active_object
quad.name = quad.data.name = N + "tips"

bpy.ops.object.select_all(action="DESELECT")
for s in sleeves:
    s.select_set(True)
bpy.context.view_layer.objects.active = sleeves[0]
bpy.ops.object.join()
bores = bpy.context.active_object
bores.name = bores.data.name = N + "sleeves"

# Surround valance: a flat backing plate set behind the tips, wide enough to
# read as a panel the bumper was built for rather than four holes cut in open
# air. The tips protrude past its front face, so no cutout is needed — nothing
# ever looks through the plate to see it should be hollow.
surround = block(N + "surround", coll,
                 (CX, CY, TIP_FRONT + 60.0), (520.0, 200.0, 15.0), gen=GEN)

pipe = revolve(N + "pipe", coll, [
    (0.0, 0.0), (0.0, 55.0), (280.0, 55.0), (280.0, 0.0),
], (CX, CY, TIP_FRONT), segments=24, gen=GEN, axis="z")

assign(quad, "MOD_Titanium")
assign(bores, "MOD_SatinBlack")
assign(surround, "MOD_GlossBlack")
assign(pipe, "MOD_SatinBlack")

for obj in coll.objects:
    clean(obj)
    box_uv(obj, scale=0.05)
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- EX03 stats ---")
stats(coll, GEN)
