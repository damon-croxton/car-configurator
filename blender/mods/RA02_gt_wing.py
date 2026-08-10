"""
RA02 — GT Wing, boot-mounted (ND). Brief §7.4.

The first body-mounted bolt-on, so the thing being proved is that a mod exported
in absolute app coordinates lands where it was modelled and touches the car
exactly where it should.

Element: 240 chord, 22 thick, 1400 span, 8 degrees angle of attack, centred at
app (0, 1320, -1700). The section is cambered — thicker and more curved on top —
and the whole thing sits trailing-edge-high, because a rear wing is an inverted
aerofoil and getting that backwards is the most visible way to be wrong.

Span is capped at body width minus 150 (ND is 1940 wide, so 1790 max); 1400 is
comfortably inside it.

Fixing: the uprights run from base plates lying FLAT ON the boot lid up to the
element's underside, and their height is measured by ray-casting the boot rather
than taken from the brief's nominal 240 — the brief's figure assumes a different
datum and would leave them hanging.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/RA02_gt_wing.py").read())
"""

import bpy
import math
from mathutils import Vector

GEN, MOD = "nd", "RA02"
N = f"MOD_{GEN.upper()}_{MOD}_"

SPAN = 1400.0
CHORD = 240.0
THICK = 22.0
AOA = math.radians(8.0)
Y_MID = 1320.0
Z_LE = -1580.0            # leading edge; trailing ends up near -1818
UPRIGHT_X = 330.0
ENDPLATE_X = SPAN / 2.0

reset_mods()
coll = start_mod(GEN, MOD)

# -- element ----------------------------------------------------------------
# (chord fraction, half-thickness) — cambered: fuller on top than underneath.
SECTION = [
    (0.00,  0.0), (0.05,  7.0), (0.15, 10.5), (0.30, 11.0), (0.50, 10.0),
    (0.70,  7.5), (0.90,  3.5), (1.00,  0.8),
    (1.00, -0.8), (0.90, -2.5), (0.70, -4.0), (0.50, -4.5), (0.30, -4.0),
    (0.15, -2.5), (0.05, -1.5),
]


# The section above peaks at 11 up and 4.5 down, i.e. 15.5 total. Scale it so
# the element is the specified 22 mm thick — a wing that measures right in plan
# and is two thirds too thin in section reads as a shelf.
SECTION_SCALE = THICK / 15.5


def section_point(frac, v):
    """Chord fraction + normal offset -> app (y, z), rotated to the AoA."""
    u = frac * CHORD
    v = v * SECTION_SCALE
    z = Z_LE - (u * math.cos(AOA) - v * math.sin(AOA))
    y = Y_MID + (u * math.sin(AOA) + v * math.cos(AOA))
    return y, z


verts, faces = [], []
for x in (-ENDPLATE_X, ENDPLATE_X):
    for frac, v in SECTION:
        y, z = section_point(frac, v)
        verts.append(app_to_blender(x, y, z, GEN)[:])
n = len(SECTION)
for i in range(n):
    j = (i + 1) % n
    faces.append([i, j, n + j, n + i])
faces.append(list(range(n - 1, -1, -1)))          # end caps
faces.append(list(range(n, 2 * n)))

mesh = bpy.data.meshes.new(N + "element")
mesh.from_pydata(verts, [], faces)
mesh.validate()
mesh.update()
element = bpy.data.objects.new(N + "element", mesh)
put(element, coll)

# -- where the boot actually is, at each upright ----------------------------
boot = base_mesh("Boot 6.001_157", GEN)
BASE_Z = -1700.0
deck = {x: surface_y(boot, x, BASE_Z, GEN) for x in (UPRIGHT_X, -UPRIGHT_X)}
print("boot deck height at the uprights:", deck)

# -- uprights, base plates, endplates ---------------------------------------
parts = []
for x in (UPRIGHT_X, -UPRIGHT_X):
    top = section_point(0.5, -4.5)[0]                     # element underside
    bottom = deck[x]
    height = top - bottom
    mid_y = bottom + height / 2.0
    up = block(N + f"upright_{'L' if x > 0 else 'R'}", coll,
               (x, mid_y, BASE_Z - 20.0), (14.0, height, 150.0), gen=GEN)
    # Taper 150 chord at the base to 90 at the top, per the brief. A constant
    # 150 slab reads as a pedestal holding the wing up rather than as a strut.
    for v in up.data.vertices:
        app = blender_to_app(up.matrix_world @ v.co, GEN)
        t = max(0.0, min(1.0, (app[1] - bottom) / height))
        z = (BASE_Z - 20.0) + (app[2] - (BASE_Z - 20.0)) * (1.0 - 0.40 * t)
        v.co = app_to_blender(app[0], app[1], z, GEN)
    up.data.update()
    parts.append(up)
    # Base plate lying flat on the lid, 1 mm proud so it never z-fights.
    parts.append(block(N + f"baseplate_{'L' if x > 0 else 'R'}", coll,
                       (x, bottom + 5.0, BASE_Z - 20.0),
                       (90.0, 8.0, 180.0), gen=GEN))

# Endplates centred on the element's own mid-height, not on a nominal one, so
# the aerofoil sits in the middle of them rather than grazing the top edge.
plate_y = (section_point(0.5, 11.0)[0] + section_point(0.5, -4.5)[0]) / 2.0
for x in (ENDPLATE_X, -ENDPLATE_X):
    parts.append(block(N + f"endplate_{'L' if x > 0 else 'R'}", coll,
                       (x, plate_y, Z_LE - CHORD / 2.0),
                       (6.0, 180.0, 300.0), gen=GEN))

bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
frame = bpy.context.active_object
frame.name = frame.data.name = N + "frame"

assign(element, "MOD_AccentPaint")
assign(frame, "MOD_GlossBlack")

for obj in (element, frame):
    clean(obj)
    box_uv(obj, scale=0.05)
bevel_smooth(frame, width=0.0015, segments=1)

for obj in (element, frame):
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- RA02 stats ---")
stats(coll, GEN)
