"""
FA01 — OEM+ Front Lip (ND). Brief §7.3.

The true donor for this is `BumperF 6.001_109` — the OEM's own lower-lip trim
piece, not the wider painted fascia. Its measured bbox min y is 169, matching
what FA03's own independent probe found for "the bumper's lowest point": the
painted panel above it stops higher because there is an intake cutout there,
and this black trim piece is what fills below it.

So this is the same seamless panel-lift as the boot spoilers: extend the trim's
own lower edge down 55mm and forward 25mm with an 8-degree flare, ramped to zero
at y 230 so the join with the fixed upper portion of the same mesh is invisible
by construction, not by careful modelling.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/FA01_front_lip.py").read())
"""

import bpy

GEN, MOD = "nd", "FA01"
N = f"MOD_{GEN.upper()}_{MOD}_"

BAND_TOP = 230.0
BOTTOM = 169.0
DROP, FORWARD, FLARE = 55.0, 25.0, 10.0

reset_mods()
coll = start_mod(GEN, MOD)

lip = panel_from_base("BumperF 6.001_109", N + "lip", coll, GEN)
refine_faces(lip, lambda app: app[1] <= BAND_TOP, cuts=1, gen=GEN)

for v in lip.data.vertices:
    app = blender_to_app(lip.matrix_world @ v.co, GEN)
    t = max(0.0, min(1.0, (BAND_TOP - app[1]) / (BAND_TOP - BOTTOM)))
    t2 = t * t
    sign = 1.0 if app[0] > 0 else (-1.0 if app[0] < 0 else 0.0)
    v.co = app_to_blender(
        app[0] + sign * FLARE * t2,
        app[1] - DROP * t2,
        app[2] + FORWARD * t2,   # forward = +Z, toward the nose
        GEN,
    )
lip.data.update()

solidify(lip, 9.0, GEN)

assign(lip, "MOD_SatinBlack")
clean(lip)
box_uv(lip, scale=0.05)
activate(lip)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- FA01 stats ---")
stats(coll, GEN)
