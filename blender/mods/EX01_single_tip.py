"""
EX01 — Single Round Tip Cat-Back (ND). Brief §7.7.

The tip position is measured, not centred. The ND's OEM tips sit at app
x -354..-220, y 198..259, z -1855..-1783 — that is, off-centre to the vehicle's
RIGHT, not symmetric about the centreline as the catalogue drawing implies. This
replaces them in place.

Every tip must be hollow. A solid rod with a dark cap reads as a toy, so the tip
is modelled as a real tube: the profile runs out along the outside, turns at the
mouth, and comes back down the bore, with a separate dark sleeve inside it.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/EX01_single_tip.py").read())
"""

import bpy

GEN, MOD = "nd", "EX01"
N = f"MOD_{GEN.upper()}_{MOD}_"

# Centreline of the system, taken from the measured OEM tip.
CX, CY = -287.0, 229.0
TIP_BACK = -1880.0        # rearmost point of the tip
TIP_FRONT = -1740.0       # 140 mm tip

reset_mods()
coll = start_mod(GEN, MOD)

# -- tip: a real tube, walls 6 mm ------------------------------------------
tip = revolve(N + "tip", coll, [
    (0.0,    30.0),                  # where it leaves the pipe
    (-24.0,  50.0),                  # flare
    (-140.0, 50.0),                  # outer, back to the mouth
    (-140.0, 44.0),                  # wall thickness at the mouth
    (-24.0,  44.0),
    (0.0,    26.0),
], (CX, CY, TIP_FRONT), segments=32, gen=GEN, axis="z")

# The dark bore. Without it you see straight through the tube to the sky.
sleeve = revolve(N + "sleeve", coll, [
    (-25.0,  0.0),
    (-25.0,  44.0),
    (-140.0, 44.0),
    (-140.0, 0.0),
], (CX, CY, TIP_FRONT), segments=32, gen=GEN, axis="z")

# -- pipe and muffler -------------------------------------------------------
pipe = revolve(N + "pipe", coll, [
    (0.0,   0.0),
    (0.0,   30.0),
    (320.0, 30.0),
    (320.0, 0.0),
], (CX, CY, TIP_FRONT), segments=24, gen=GEN, axis="z")

muffler = revolve(N + "muffler", coll, [
    (0.0,   0.0),
    (0.0,   70.0),
    (500.0, 70.0),
    (500.0, 0.0),
], (CX, CY, TIP_FRONT + 320.0), segments=28, gen=GEN, axis="z")

# Flatten it into an oval: 140 wide by ~90 tall, which is what actually fits
# between the floor and the valance.
for v in muffler.data.vertices:
    app = blender_to_app(muffler.matrix_world @ v.co, GEN)
    v.co = app_to_blender(app[0], CY + (app[1] - CY) * 0.62, app[2], GEN)
muffler.data.update()

assign(tip, "MOD_Chrome")
assign(sleeve, "MOD_SatinBlack")
assign(pipe, "MOD_SatinBlack")
assign(muffler, "MOD_SatinBlack")

for obj in coll.objects:
    clean(obj)
    box_uv(obj, scale=0.05)
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- EX01 stats ---")
stats(coll, GEN)
