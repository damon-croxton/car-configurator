"""
RB02 — Double-Hoop Roll Bar + Harness Bar (ND). Brief §7.9.

Two hoops 140 mm apart, tied together by short spacer tubes at the crown and by
a full-width harness bar across the rear hoop at the height a belt actually
wants — around y 950, roughly shoulder height for a seated driver.

Same universal rules as RB01: 38 mm OD, every tube end on a footplate, deck
heights probed rather than assumed. Same roof-down caveat too.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/RB02_double_hoop.py").read())
"""

import bpy

GEN, MOD = "nd", "RB02"
N = f"MOD_{GEN.upper()}_{MOD}_"

TUBE_R = 19.0
HOOP_X = 470.0
# The cabin tub only offers a surface between roughly z -950 and -1090 at this
# x; outside that band the mesh has gaps and a probe returns nothing. Both hoops
# are placed inside it so every footplate lands on real geometry.
FRONT_Z = -950.0
REAR_Z = -1090.0         # 140 mm behind the front hoop
HOOP_TOP = 1120.0
BEND = 250.0
HARNESS_Y = 950.0
STAY_Z = -1150.0
PLATE = (100.0, 6.0, 100.0)

reset_mods()
coll = start_mod(GEN, MOD)

cabin = base_mesh("M_Interior_Max_19", GEN)


def deck(app_x, app_z, fallback=760.0):
    """
    Lowest cabin surface at this station, searching a small neighbourhood.

    The tub is not watertight — a ray straight down can pass through a gap and
    report nothing at all. Nudging the station by a few centimetres finds the
    same deck, which is far better than an assumed height under a footplate.
    """
    hits = []
    for dz in (0.0, -30.0, 30.0, -60.0, 60.0):
        for start in (830.0, 800.0, 780.0):
            try:
                hits.append(surface_y(cabin, app_x, app_z + dz, GEN, from_y=start))
            except RuntimeError:
                continue
        if hits:
            break
    if not hits:
        print(f"  ! no deck near ({app_x}, {app_z}) — falling back to {fallback}")
        return fallback
    return min(hits)


decks = {(x, z): deck(x, z) for x in (HOOP_X, -HOOP_X) for z in (FRONT_Z, REAR_Z)}
stay_decks = {x: deck(x * 0.89, STAY_Z) for x in (HOOP_X, -HOOP_X)}
print("hoop decks:", decks)
print("stay decks:", stay_decks)

parts = []

# -- the two hoops ----------------------------------------------------------
for z in (FRONT_Z, REAR_Z):
    base_y = min(decks[(HOOP_X, z)], decks[(-HOOP_X, z)])
    parts.append(sweep(N + f"hoop_{'f' if z == FRONT_Z else 'r'}", coll, rounded_path([
        (-HOOP_X, base_y, z),
        (-HOOP_X, HOOP_TOP, z),
        (HOOP_X, HOOP_TOP, z),
        (HOOP_X, base_y, z),
    ], BEND), TUBE_R, segments=14, gen=GEN))

# -- crown spacers tying the hoops together --------------------------------
for x in (HOOP_X, -HOOP_X):
    parts.append(sweep(N + f"spacer_{'L' if x > 0 else 'R'}", coll,
                       [(x, HOOP_TOP - 40.0, FRONT_Z), (x, HOOP_TOP - 40.0, REAR_Z)],
                       TUBE_R * 0.75, segments=10, gen=GEN))

# -- harness bar, full width across the rear hoop --------------------------
parts.append(sweep(N + "harness", coll,
                   [(-HOOP_X, HARNESS_Y, REAR_Z), (HOOP_X, HARNESS_Y, REAR_Z)],
                   TUBE_R, segments=12, gen=GEN))

# -- rear stays and every footplate ----------------------------------------
for x in (HOOP_X, -HOOP_X):
    side = "L" if x > 0 else "R"
    parts.append(sweep(N + f"stay_{side}", coll,
                       [(x, HOOP_TOP - 190.0, REAR_Z), (x * 0.89, stay_decks[x], STAY_Z)],
                       TUBE_R, segments=12, gen=GEN))
    for z in (FRONT_Z, REAR_Z):
        parts.append(block(N + f"plate_{side}_{'f' if z == FRONT_Z else 'r'}", coll,
                           (x, decks[(x, z)] + PLATE[1] / 2.0, z), PLATE, gen=GEN))
    parts.append(block(N + f"plate_stay_{side}", coll,
                       (x * 0.89, stay_decks[x] + PLATE[1] / 2.0, STAY_Z), PLATE, gen=GEN))

bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
cage = bpy.context.active_object
cage.name = cage.data.name = N + "cage"

assign(cage, "MOD_AccentPaint")
clean(cage)
box_uv(cage, scale=0.05)
activate(cage)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- RB02 stats ---")
stats(coll, GEN)
