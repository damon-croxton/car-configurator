"""
RA05 — OEM+ Lip Spoiler, and RA01 — Ducktail Spoiler (ND). Brief §7.4.

Both are the boot lid's own rear strip, lifted. Taking the surface rather than
modelling one is what guarantees the thing the brief calls the single most
common failure here: a visible step at the front edge. The lift ramps from zero
at the strip's leading edge, so the front row of vertices is still exactly the
boot lid and the join is seamless by construction, not by eye.

  RA05: 140 mm of strip, 35 mm rise, plus a slight upward flick at the ends.
  RA01: 260 mm of strip, 85 mm rise — the same curve carried further.

The ramp is t^2, which has zero slope where it meets the panel. A linear ramp
would leave a crease along the leading edge.

Boot lid measures x +/-604, y 756..918, z -1864..-1308.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/RA05_boot_spoilers.py").read())
"""

import bpy

GEN = "nd"
TRAIL_Z = -1864.0        # boot lid's trailing edge


def build(mod_id, depth, rise, flick, thickness):
    n = f"MOD_{GEN.upper()}_{mod_id}_"
    reset_mods()
    coll = start_mod(GEN, mod_id)

    front_z = TRAIL_Z + depth
    lip = panel_from_base("Boot 6.001_157", n + "lip", coll, GEN)

    # Trim to the strip FIRST, then refine only what survives. Refining before
    # trimming quadruples geometry that is about to be deleted; combined with
    # cuts=3 that reached 20k triangles against a 1.5k budget.
    delete_faces(lip, lambda app: app[2] > front_z, GEN)
    refine_faces(lip, lambda app: True, cuts=1, gen=GEN)

    def lift(app):
        t = (front_z - app[2]) / depth
        if t <= 0.0:
            return 0.0
        t = min(1.0, t)
        # Ends flick up a little more than the centre, which is what stops a
        # lip reading as a shelf laid across the boot.
        edge = (abs(app[0]) / 604.0) ** 2 * flick
        return (rise + edge) * t * t

    print(f"{mod_id}: lifted {displace(lip, lift, GEN)} verts")
    solidify(lip, thickness, GEN)

    assign(lip, "MOD_BodyPaint")
    clean(lip)
    box_uv(lip, scale=0.05)
    # No bevel. It doubled the triangle count for edges that are not there to
    # catch light: this is a smooth-shaded curved panel whose only hard edge is
    # the trailing one, and Solidify already gives that real thickness.
    for p in lip.data.polygons:
        p.use_smooth = True
    lip.data.update()
    activate(lip)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    finalise_names(coll)
    print(f"--- {mod_id} stats ---")
    stats(coll, GEN)
    return coll


which = globals().get("WHICH", "RA05")
if which == "RA05":
    build("RA05", depth=140.0, rise=35.0, flick=14.0, thickness=8.0)
else:
    build("RA01", depth=260.0, rise=85.0, flick=10.0, thickness=10.0)
