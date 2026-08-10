"""
BP04 — Carbon Boot Lid (ND). Brief §7.5.

The simplest REPLACE panel in the catalogue, and useful precisely because it is:
it proves the panel technique on a second surface with no aperture surgery to
hide behind. The lid is the OEM boot surface given 4 mm of carbon thickness and
a return flange around the underside, so its shut lines, badge recess position
and rear tangent are the car's own.

Boot lid (app mm): x +/-604, y 756..918, z -1864..-1308. The badge sits on a
separate node (`Boot 6.002_158`), so there is no recess to fill here.

Ducktails and wings still mount to this — their anchors are unchanged, so it is
deliberately incompatible with nothing.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/BP04_carbon_boot.py").read())
"""

import bpy

GEN, MOD = "nd", "BP04"
PANEL = f"MOD_{GEN.upper()}_{MOD}_lid"
FLANGE = f"MOD_{GEN.upper()}_{MOD}_flange"

PANEL_THICK = 4.0
FLANGE_DEPTH = 6.0

reset_mods()
coll = start_mod(GEN, MOD)

lid = panel_from_base("Boot 6.001_157", PANEL, coll, GEN)
solidify(lid, PANEL_THICK, GEN)

# Return flange: the same surface again, pushed down and inset, so the lid reads
# as a moulded panel with a lip rather than a sheet of infinitely thin carbon
# when seen from behind at boot level.
flange = panel_from_base("Boot 6.001_157", FLANGE, coll, GEN)
displace(flange, lambda app: -FLANGE_DEPTH, GEN)
solidify(flange, 3.0, GEN)
activate(flange)
flange.scale = (0.985, 0.985, 1.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

assign(lid, "MOD_CarbonWeave")
assign(flange, "MOD_SatinBlack")

for obj in (lid, flange):
    clean(obj)
    box_uv(obj, scale=0.05)     # ~50 mm weave tile, consistent across panels
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)
print("--- BP04 stats ---")
stats(coll, GEN)
