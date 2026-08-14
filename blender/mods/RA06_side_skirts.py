"""
RA06 — Side Skirts, trim finish, and RA06B — Side Skirts, carbon finish (ND).
Brief §7.4. carData `sideSkirts`: oem_extensions -> "trim", carbon_extenders ->
"carbon"; both are real catalogue ids already, so this is two mod ids in one
family the same way W01/W07/W04 split across wheelStyle ids.

The OEM rocker sill's own body-paint skin (`Skirts 6.003_57`) is the donor,
extended down and out from its lower edge rather than modelled freehand — the
brief's warning here is that both ends must terminate flush into the arch
openings, and taking the panel's own shape makes that automatic: the arches are
where the donor panel itself ends.

Measured: sill spans x +/-855, with its lower edge running y 167..181 for
z -600..600 (the straight run between the arches) before curving away.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/RA06_side_skirts.py").read())
"""

import bpy

GEN = "nd"
BAND_TOP = 230.0      # above this, no displacement — matches the OEM sill exactly
DROP, FLARE = 60.0, 25.0
LEFT_X = 855.0 * 0.9   # sample x for probing the sill's own straight-run height


def build(mod_id, material):
    n = f"MOD_{GEN.upper()}_{mod_id}_"
    reset_mods()
    coll = start_mod(GEN, mod_id)

    sill = panel_from_base("Skirts 6.003_57", n + "skirt", coll, GEN)

    refine_faces(sill, lambda app: app[1] <= BAND_TOP, cuts=1, gen=GEN)

    for v in sill.data.vertices:
        app = blender_to_app(sill.matrix_world @ v.co, GEN)
        t = max(0.0, min(1.0, (BAND_TOP - app[1]) / (BAND_TOP - 167.0)))
        t2 = t * t
        sign = 1.0 if app[0] > 0 else -1.0
        v.co = app_to_blender(
            app[0] + sign * FLARE * t2,
            app[1] - DROP * t2,
            app[2],
            GEN,
        )
    sill.data.update()

    solidify(sill, 10.0, GEN)

    assign(sill, material)
    clean(sill)
    box_uv(sill, scale=0.05)
    activate(sill)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    finalise_names(coll)
    print(f"--- {mod_id} stats ---")
    stats(coll, GEN)
    return coll


which = globals().get("WHICH", "RA06")
if which == "RA06":
    build("RA06", "MOD_SatinBlack")
else:
    build("RA06B", "MOD_CarbonWeave")
