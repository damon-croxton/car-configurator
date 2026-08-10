"""
FA03 — Race Splitter with support rods (ND). Brief §7.3.

The point of a splitter is that it is FLAT and LEVEL. Following the bumper's
curve downward makes it a valance, which is a different part. So the plate sits
on a horizontal plane at app y = 150 — just under the front bumper's lowest
point, measured at 168 — and projects forward of the nose at z 1958 to a leading
edge at 2055.

The plan outline follows the bumper's footprint and then runs straight across
the front with radiused corners, which is what separates a splitter from a
rectangle bolted to a car.

Support rods run from the plate's top face up into the bumper. They must
intersect BOTH — a rod floating between two surfaces is the single most common
way this part goes wrong — so they are deliberately long enough to bury their
top ends in bumper material.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/FA03_race_splitter.py").read())
"""

import bpy

GEN, MOD = "nd", "FA03"
N = f"MOD_{GEN.upper()}_{MOD}_"

PLATE_Y = 150.0          # bumper's lowest point is 168; the plate tucks under
THICK = 12.0
ROD_X = 420.0
ROD_Z = 1890.0

reset_mods()
coll = start_mod(GEN, MOD)

# Plan outline, app (x, z): straight radiused leading edge, sides following the
# bumper back toward the arches.
OUTLINE = [
    (-820, 1950), (-700, 2035), (0, 2055), (700, 2035), (820, 1950),
    (800, 1780), (700, 1690), (-700, 1690), (-800, 1780),
]

verts, faces = [], []
n = len(OUTLINE)
for y in (PLATE_Y + THICK / 2.0, PLATE_Y - THICK / 2.0):
    for x, z in OUTLINE:
        verts.append(app_to_blender(x, y, z, GEN)[:])
for i in range(n):
    j = (i + 1) % n
    faces.append([i, j, n + j, n + i])
faces.append(list(range(n - 1, -1, -1)))
faces.append(list(range(n, 2 * n)))

mesh = bpy.data.meshes.new(N + "plate")
mesh.from_pydata(verts, [], faces)
mesh.validate()
mesh.update()
plate = bpy.data.objects.new(N + "plate", mesh)
put(plate, coll)

# Rods, plus a washer disc where each meets the plate. They run from inside the
# plate up to y 470, which is well inside the bumper's 175..644 band at this
# station, so both ends are genuinely buried rather than touching.
rods = []
for x in (ROD_X, -ROD_X):
    side = "L" if x > 0 else "R"
    rods.append(block(N + f"rod_{side}", coll,
                      (x, (PLATE_Y + 470.0) / 2.0, ROD_Z),
                      (11.0, 470.0 - PLATE_Y, 11.0), gen=GEN))
    rods.append(revolve(N + f"washer_{side}", coll, [
        (-14.0, 0.0), (-14.0, 26.0), (-8.0, 26.0), (-8.0, 0.0),
    ], (x, PLATE_Y + THICK / 2.0, ROD_Z), segments=16, gen=GEN))

bpy.ops.object.select_all(action="DESELECT")
for r in rods:
    r.select_set(True)
bpy.context.view_layer.objects.active = rods[0]
bpy.ops.object.join()
hardware = bpy.context.active_object
hardware.name = hardware.data.name = N + "rods"

assign(plate, "MOD_CarbonWeave")
assign(hardware, "MOD_Alloy")

for obj in (plate, hardware):
    clean(obj)
    box_uv(obj, scale=0.05)
bevel_smooth(plate, width=0.0015, segments=1)

for obj in (plate, hardware):
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- FA03 stats ---")
stats(coll, GEN)
