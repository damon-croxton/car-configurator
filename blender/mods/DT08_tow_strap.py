"""
DT08 — Tow Strap, rear (ND). Brief §7.6.

A 45 mm woven band doubled into a loop, hanging from a bolt boss under the rear
bumper. The brief asks for natural sag rather than a straight bar, so the loop
is a hand-placed curve: it leaves the boss, falls, bellies out at the bottom and
comes back up, which is what a webbing loop does under its own weight.

Built as a ribbon — two rows of vertices 45 mm apart following the curve, then
solidified 3 mm — rather than a swept tube. A tube squashed flat still catches
light like a cylinder, and webbing does not.

Rear bumper measures x +/-856, y 191..753, z -1957..-1303, so the boss is buried
in it and the loop hangs clear below.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/DT08_tow_strap.py").read())
"""

import bpy

GEN, MOD = "nd", "DT08"
N = f"MOD_{GEN.upper()}_{MOD}_"

X = -480.0               # vehicle right, clear of the exhaust at -287
HALF_W = 22.5            # 45 mm band

# (y, z) down the loop and back up. Deliberately asymmetric — a strap that has
# hung on a car for a while is not a perfect arc.
LOOP = [
    (262.0, -1896.0),
    (208.0, -1897.0),
    (162.0, -1903.0),
    (131.0, -1915.0),
    (128.0, -1929.0),
    (156.0, -1940.0),
    (206.0, -1945.0),
    (262.0, -1947.0),
]

reset_mods()
coll = start_mod(GEN, MOD)

verts, faces = [], []
for y, z in LOOP:
    verts.append(app_to_blender(X - HALF_W, y, z, GEN)[:])
    verts.append(app_to_blender(X + HALF_W, y, z, GEN)[:])
for i in range(len(LOOP) - 1):
    a = i * 2
    faces.append([a, a + 1, a + 3, a + 2])

mesh = bpy.data.meshes.new(N + "strap")
mesh.from_pydata(verts, [], faces)
mesh.validate()
mesh.update()
strap = bpy.data.objects.new(N + "strap", mesh)
put(strap, coll)
solidify(strap, 3.0, GEN, offset=0.0)

# Bolt boss at the top, where the loop disappears into the bumper.
boss = revolve(N + "boss", coll, [
    (0.0, 0.0), (0.0, 16.0), (-18.0, 16.0), (-18.0, 0.0),
], (X, 262.0, -1892.0), segments=16, gen=GEN, axis="z")

assign(strap, "MOD_AccentPaint")
assign(boss, "MOD_Chrome")

for obj in (strap, boss):
    clean(obj)
    box_uv(obj, scale=0.05)
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- DT08 stats ---")
stats(coll, GEN)
