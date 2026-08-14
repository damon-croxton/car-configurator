"""
RA04 — Rear Diffuser, trim finish, and RA04B — Rear Diffuser, carbon finish
(ND). Brief §7.4. Same two-variant pattern as RA06/RA06B: both option ids
(oem_diffuser, track_diffuser) already exist in carData's rearDiffuser list.

Unlike the panels lifted from the boot lid or the sill, the ND has no diffuser
insert to derive this from — it is new geometry, mounted against a measured
surface rather than assumed. The valance underside (`BumperR 6.002_147`) sits
270..300mm off the ground across x -300..300; the panel starts there and kicks
up toward the trailing edge, which is what makes it a diffuser rather than a
flat tray.

A 40mm-wide slot at x -354..-220 clears the measured exhaust tip position
(EX01/EX02's own centreline) for the panel's rear half — cut for the whole
depth would be simpler but wastes the one place a viewer's eye actually goes.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/RA04_rear_diffuser.py").read())
"""

import bpy

GEN = "nd"
Z_FRONT, Z_REAR = -1790.0, -1945.0
Y_FRONT, Y_REAR = 260.0, 330.0
HALF_W_REAR, HALF_W_FRONT = 560.0, 520.0
STRAKE_X = (0.0, 280.0, -280.0, 560.0, -560.0)
CUT_X = (-354.0, -220.0)
ROWS, COLS = 6, 10


def build(mod_id, panel_material, strake_material):
    n = f"MOD_{GEN.upper()}_{mod_id}_"
    reset_mods()
    coll = start_mod(GEN, mod_id)

    # -- base panel: a grid, so a rectangular notch can be cut out cleanly ----
    verts, faces = [], []
    grid = []
    for r in range(ROWS + 1):
        t = r / ROWS
        z = Z_FRONT + (Z_REAR - Z_FRONT) * t
        y = Y_FRONT + (Y_REAR - Y_FRONT) * t
        half_w = HALF_W_FRONT + (HALF_W_REAR - HALF_W_FRONT) * t
        row = []
        for c in range(COLS + 1):
            u = c / COLS
            x = -half_w + 2 * half_w * u
            row.append(len(verts))
            verts.append(app_to_blender(x, y, z, GEN)[:])
        grid.append(row)

    for r in range(ROWS):
        t_mid = (r + 0.5) / ROWS
        for c in range(COLS):
            u_mid = (c + 0.5) / COLS
            half_w = HALF_W_FRONT + (HALF_W_REAR - HALF_W_FRONT) * t_mid
            x_mid = -half_w + 2 * half_w * u_mid
            # Only cut the exhaust notch in the rear half, where the tip is.
            if t_mid > 0.5 and CUT_X[0] <= x_mid <= CUT_X[1]:
                continue
            a, b = grid[r][c], grid[r][c + 1]
            d, e = grid[r + 1][c], grid[r + 1][c + 1]
            faces.append([a, b, e, d])

    mesh = bpy.data.meshes.new(n + "panel")
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    panel = bpy.data.objects.new(n + "panel", mesh)
    put(panel, coll)
    solidify(panel, 10.0, GEN)

    # -- strakes: vertical fins along the panel's length -----------------
    strakes = []
    for x in STRAKE_X:
        strakes.append(block(
            n + f"strake_{round(x)}", coll,
            (x, (Y_FRONT + Y_REAR) / 2.0 + 20.0, (Z_FRONT + Z_REAR) / 2.0),
            (10.0, 90.0, abs(Z_REAR - Z_FRONT) - 20.0),
            gen=GEN,
        ))
    bpy.ops.object.select_all(action="DESELECT")
    for s in strakes:
        s.select_set(True)
    bpy.context.view_layer.objects.active = strakes[0]
    bpy.ops.object.join()
    fins = bpy.context.active_object
    fins.name = fins.data.name = n + "strakes"

    assign(panel, panel_material)
    assign(fins, strake_material)

    for obj in (panel, fins):
        clean(obj)
        box_uv(obj, scale=0.05)
        activate(obj)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    finalise_names(coll)
    print(f"--- {mod_id} stats ---")
    stats(coll, GEN)
    return coll


which = globals().get("WHICH", "RA04")
if which == "RA04":
    build("RA04", "MOD_SatinBlack", "MOD_SatinBlack")
else:
    build("RA04B", "MOD_CarbonWeave", "MOD_SatinBlack")
