"""
RB01 — Single-Hoop Roll Bar (ND). Brief §7.9.

38 mm OD tube throughout. The brief's universal rule for this category is that
every tube end terminates in a footplate and a tube ending in mid-air is an
automatic fail, so both hoop legs and both rear stays land on 100x100x6 plates,
and the deck height under each is ray-cast rather than assumed.

Placed behind the door aperture, which ends at app z -760, so the hoop sits at
z -820 clear of the seats. It rises to y 1100 — above the seat backs, below the
folded soft-top line the brief specifies.

Note the hoop occupies the same space the soft top does when the roof is UP; the
ND stows its top behind the seats, so this is a roof-down part. Recorded in the
catalogue entry rather than papered over.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/RB01_single_hoop.py").read())
"""

import bpy

GEN, MOD = "nd", "RB01"
N = f"MOD_{GEN.upper()}_{MOD}_"

TUBE_R = 19.0            # 38 mm OD
HOOP_X = 470.0
# Station chosen by probing, not by eye. At z -820 the cabin mesh is thin over
# the soft-top well and reports a "deck" of 853 from one ray height and nothing
# at all from any other; at -950 it reads a stable 797 whatever height the ray
# starts from. Planting a hoop on the first would have it standing on the well
# cover — which reads fine until the roof goes down.
HOOP_Z = -950.0
HOOP_TOP = 1120.0
BEND = 250.0
STAY_Z = -1150.0         # where the rear stays plant
PLATE = (100.0, 6.0, 100.0)

reset_mods()
coll = start_mod(GEN, MOD)

# -- find the deck under each tube end -------------------------------------
# Cast from below the roof lining: the ND's lining is part of the interior tub
# (see ROOF_LINING_WIP.md), so a ray started up at 2400 would hit that and
# report a "floor" a metre too high.
cabin = base_mesh("M_Interior_Max_19", GEN)


def deck(app_x, app_z, fallback=760.0):
    """
    Lowest surface the cabin mesh offers at this station.

    Probed from several heights and the lowest taken, because the tub has
    stacked surfaces in places — a single cast can land on a seat back or a
    well cover and call it the floor.
    """
    hits = []
    for start in (830.0, 800.0, 780.0):
        try:
            hits.append(surface_y(cabin, app_x, app_z, GEN, from_y=start))
        except RuntimeError:
            continue
    if not hits:
        print(f"  ! no deck under ({app_x}, {app_z}) — falling back to {fallback}")
        return fallback
    return min(hits)


hoop_deck = {x: deck(x, HOOP_Z) for x in (HOOP_X, -HOOP_X)}
stay_deck = {x: deck(x * 0.89, STAY_Z) for x in (HOOP_X, -HOOP_X)}
print("deck under hoop legs:", hoop_deck, "under stays:", stay_deck)

# -- main hoop --------------------------------------------------------------
base_y = min(hoop_deck.values())
hoop = sweep(N + "hoop", coll, rounded_path([
    (-HOOP_X, base_y, HOOP_Z),
    (-HOOP_X, HOOP_TOP, HOOP_Z),
    (HOOP_X, HOOP_TOP, HOOP_Z),
    (HOOP_X, base_y, HOOP_Z),
], BEND), TUBE_R, segments=14, gen=GEN)

# -- rear stays, running back and down at about 40 degrees ------------------
stays = []
for x in (HOOP_X, -HOOP_X):
    top = (x, HOOP_TOP - 190.0, HOOP_Z)
    foot = (x * 0.89, stay_deck[x], STAY_Z)
    stays.append(sweep(N + f"stay_{'L' if x > 0 else 'R'}", coll,
                       [top, foot], TUBE_R, segments=12, gen=GEN))

# -- footplates: one under every tube end ----------------------------------
plates = []
for x in (HOOP_X, -HOOP_X):
    plates.append(block(N + f"plate_hoop_{'L' if x > 0 else 'R'}", coll,
                        (x, hoop_deck[x] + PLATE[1] / 2.0, HOOP_Z), PLATE, gen=GEN))
    plates.append(block(N + f"plate_stay_{'L' if x > 0 else 'R'}", coll,
                        (x * 0.89, stay_deck[x] + PLATE[1] / 2.0, STAY_Z), PLATE, gen=GEN))

bpy.ops.object.select_all(action="DESELECT")
for p in stays + plates:
    p.select_set(True)
bpy.context.view_layer.objects.active = stays[0]
bpy.ops.object.join()
rest = bpy.context.active_object
rest.name = rest.data.name = N + "stays"

# Powder-coated colours are the norm on these, so make it recolourable.
assign(hoop, "MOD_AccentPaint")
assign(rest, "MOD_AccentPaint")

for obj in (hoop, rest):
    clean(obj)
    box_uv(obj, scale=0.05)
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bevel_smooth(rest, width=0.0012, segments=1)

finalise_names(coll)
print("--- RB01 stats ---")
stats(coll, GEN)
