"""
BP03 — NACA-Duct Bonnet (ND). Brief §7.5.

A NACA inlet is not a hole with walls; it is a shape. The floor sinks gradually
while the walls simultaneously diverge, and it is that combination that makes it
work aerodynamically and makes it read as a NACA duct rather than a trench. So
this sinks the OEM surface rather than cutting it: the duct is displaced into the
panel, which keeps the surrounding skin continuous and the shut lines untouched.
Only the last 60 mm becomes a real through-hole, which is where the air goes.

Duct (app mm): 380 long on the centreline, z 1050..1430, tapering 20 -> 190 wide,
flush -> 45 deep. Bonnet is x +/-721, y 582..864, z 423..1800.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/BP03_naca_bonnet.py").read())
"""

import bpy
from mathutils import Vector

GEN, MOD = "nd", "BP03"
PANEL = f"MOD_{GEN.upper()}_{MOD}_panel"
LIP = f"MOD_{GEN.upper()}_{MOD}_lip"

Z0, Z1 = 1050.0, 1430.0          # duct front and rear, app z
LENGTH = Z1 - Z0
W_FRONT, W_REAR = 20.0, 190.0    # full widths
DEPTH = 45.0
THROAT = 60.0                    # rear section that becomes a through-hole
PANEL_THICK = 4.0

reset_mods()
coll = start_mod(GEN, MOD)

panel = panel_from_base("Hood 6.001_120", PANEL, coll, GEN)


def t_of(app):
    """
    0 at the duct mouth, 1 at the throat; None outside the duct's length.

    App +Z is the nose, so the mouth is at the HIGH z end and the throat at the
    low one: a NACA duct swallows air travelling backwards over the bonnet and
    dumps it rearward. Getting this the wrong way round produces something that
    looks vaguely right in a top view and is unmistakably backwards in profile.
    """
    if not (Z0 <= app[2] <= Z1):
        return None
    return (Z1 - app[2]) / LENGTH


def half_width(t):
    return 0.5 * (W_FRONT + (W_REAR - W_FRONT) * t)


def in_duct(app, margin=0.0):
    t = t_of(app)
    if t is None:
        return False
    return abs(app[0]) <= half_width(t) + margin


# Refine a band wider than the duct, so the walls have geometry to curve through
# and the surrounding surface has room to blend back to flush.
refined = refine_faces(
    panel,
    lambda app: (Z0 - 90) <= app[2] <= (Z1 + 90) and abs(app[0]) <= W_REAR / 2 + 90,
    cuts=7, gen=GEN,
)
print(f"refined {refined} faces around the duct")

# Where the untouched skin sits just behind the throat — the lip is placed off
# this rather than off the bonnet's overall maximum, which is up at the cowl.
_probe = app_to_blender(0.0, 2000.0, Z0 - 45.0, GEN)
_hit, _loc, _n, _i = panel.ray_cast(panel.matrix_world.inverted() @ _probe, Vector((0, 0, -1)))
if not _hit:
    raise RuntimeError("no bonnet surface behind the throat")
SKIN_Y = blender_to_app(panel.matrix_world @ _loc, GEN)[1]
print(f"skin behind throat: app y {SKIN_Y}")


def sink(app):
    """
    How far down this point goes.

    Along the duct the floor descends as t^1.3 — slow at the mouth, steepening
    toward the throat, which is the characteristic NACA ramp. Across it the
    floor is flat in the middle and turns up hard at the walls, so
    1 - (v/half)^4 rather than a cosine, which would round the whole section
    into a gutter.
    """
    t = t_of(app)
    if t is None:
        return 0.0
    half = half_width(t)
    v = abs(app[0]) / half
    if v > 1.0:
        return 0.0
    return -DEPTH * (t ** 1.3) * (1.0 - v ** 4)


print(f"sank {displace(panel, sink, GEN)} verts into the duct")

# The throat: a real opening, at the low-z (rearward) end. An inlet that does
# not go anywhere reads as fake.
#
# Cut it as a straight rectangle rather than following the duct's taper. Face
# deletion works on whole faces, so a tapering boundary on a grid comes out as a
# visible sawtooth — and a real NACA throat is a clean rectangular mouth anyway.
opened = delete_faces(
    panel,
    lambda app: abs(app[0]) <= W_REAR / 2 - 6 and app[2] <= Z0 + THROAT,
    GEN,
)
print(f"opened the throat: {opened} faces")

solidify(panel, PANEL_THICK, GEN)

# A lipped surround around the throat.
#
# Face deletion leaves an edge that follows the panel's own topology, so the
# mouth is slightly ragged however finely it is refined. The same frame that
# fixed BP01's apertures fixes it here, and a lipped NACA mouth is what the real
# part has anyway — the overhanging rear edge is what catches the light and
# reads as a duct rather than a dent. Both cubes are closed volumes, so unlike
# the panel itself they boolean perfectly well.
S, _o = _frame(GEN)
mmv = lambda v: v / S / 1000.0
centre = app_to_blender(0.0, SKIN_Y - 22.0, Z0 + THROAT / 2, GEN)

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(centre.x, centre.y, centre.z))
lip = bpy.context.active_object
lip.name = lip.data.name = LIP
lip.scale = (mmv(W_REAR + 22.0), mmv(THROAT + 26.0), mmv(58.0))
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(centre.x, centre.y, centre.z))
hollow = bpy.context.active_object
hollow.name = "_naca_hollow"
hollow.scale = (mmv(W_REAR - 12.0), mmv(THROAT + 4.0), mmv(120.0))
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

boolean(lip, hollow, "DIFFERENCE")
bpy.data.objects.remove(hollow, do_unlink=True)
put(lip, coll)

assign(panel, "MOD_BodyPaint")
assign(lip, "MOD_SatinBlack")

for obj in (panel, lip):
    clean(obj)
bevel_smooth(lip, width=mmv(1.0), segments=1)
box_uv(panel, scale=0.05)
box_uv(lip, scale=0.05)

for obj in (panel, lip):
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- BP03 stats ---")
stats(coll, GEN)
