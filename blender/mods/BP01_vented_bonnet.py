"""
BP01 — Vented Carbon Bonnet (ND). Brief §7.5.

Fixing points: this is a REPLACE panel. It is the OEM bonnet's own surface, so
its shut lines, hinge line and nose edge are correct by construction; the app
hides `Hood 6.001_120` and shows this instead. Nothing is derived by hand.

Key dimensions (app space, mm — see brief §1.3):
  bonnet          x +/-721, y 582..864, z 423..1800
  apertures       300 x 160, centred (+/-330, surface, 1180)
  louvres         5 blades per side, 310 x 45 x 4, 35 deg rearward-up, 32 pitch
  surround lip    10 wide, 5 proud, around each aperture

The blades are 310 wide against a 300 aperture, so each one lands 5 mm inside
the surround on both sides and is genuinely attached rather than floating —
that is the classic failure this mod is prone to.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/BP01_vented_bonnet.py").read())
"""

import bpy
import math
from mathutils import Vector

GEN = "nd"
MOD = "BP01"
PANEL = f"MOD_{GEN.upper()}_{MOD}_panel"
LOUVRES = f"MOD_{GEN.upper()}_{MOD}_louvres"
SURROUND = f"MOD_{GEN.upper()}_{MOD}_surround"

APERTURE_X = 330.0      # app mm from centreline
APERTURE_Z = 1180.0     # app mm, fore-aft centre
APERTURE_W = 300.0      # across the car
APERTURE_L = 160.0      # fore-aft
BLADES = 5
BLADE_PITCH = 32.0
BLADE_CHORD = 45.0
BLADE_THICK = 4.0
BLADE_OVERLAP = 10.0    # total, so 5 mm into the surround each side
BLADE_ANGLE = -35.0     # negative tilts the rear edge up
RECESS = 20.0           # blade leading edges below the skin
PANEL_THICK = 4.0

sweep_temporaries("_")
coll = start_mod(GEN, MOD)
S, _ = _frame(GEN)
mm = lambda v: v / S / 1000.0   # an app-space length -> Blender metres


# -- 1. the panel: the OEM bonnet, given real thickness ---------------------

src = base_mesh("Hood 6.001_120", GEN)
panel = src.copy()
panel.data = src.data.copy()
panel.name = PANEL
panel.data.name = PANEL
panel.parent = None
panel.matrix_world = src.matrix_world
put(panel, coll)

activate(panel)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


# -- 2. find the skin height at each aperture, by measuring not guessing ----

def surface_z(app_x, app_z):
    """Ray-cast straight down onto the panel and return the Blender z it hits."""
    p = app_to_blender(app_x, 2000.0, app_z, GEN)
    hit, loc, _n, _i = panel.ray_cast(panel.matrix_world.inverted() @ p, Vector((0, 0, -1)))
    if not hit:
        raise RuntimeError(f"no bonnet surface under app ({app_x}, {app_z})")
    return (panel.matrix_world @ loc).z


sides = (+APERTURE_X, -APERTURE_X)
skin = {x: surface_z(x, APERTURE_Z) for x in sides}
print("skin height at apertures (Blender z):", {k: round(v, 4) for k, v in skin.items()})


# -- 3. cut the apertures ---------------------------------------------------
#
# By face deletion, not by boolean. The bonnet is an open single-skin shell with
# several boundary loops, so "inside" is undefined for it and the EXACT solver
# returns the cutter volume rather than the difference. Deleting the faces whose
# centres fall inside the aperture footprint is deterministic, and Solidify's
# rim fill then gives the opening a real 4 mm wall. The edge follows the
# bonnet's own topology so it is slightly ragged — which is precisely what the
# surround lip in step 5 is for, on the real part as much as on this one.

import bmesh

# The OEM bonnet is 868 triangles across 1442 x 1376 mm — roughly 40 mm faces.
# Deleting those wholesale gives an aperture accurate only to +/-20 mm, with a
# stepped edge that smooth shading smears into a visible crease. So refine the
# mesh first — but only in a band around each aperture. Subdividing the whole
# panel costs 44k triangles once Solidify doubles it, which is 3.7x the budget
# for detail that appears nowhere.

MARGIN = 80.0   # how far around each aperture to refine

def in_band(app, half_w, half_l):
    return any(abs(app[0] - x) <= half_w and abs(app[2] - APERTURE_Z) <= half_l
               for x in sides)

bm = bmesh.new()
bm.from_mesh(panel.data)
bm.faces.ensure_lookup_table()

near = [f for f in bm.faces
        if in_band(blender_to_app(panel.matrix_world @ f.calc_center_median(), GEN),
                   APERTURE_W / 2 + MARGIN, APERTURE_L / 2 + MARGIN)]
edges = {e for f in near for e in f.edges}
bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=3, use_grid_fill=True)
bm.faces.ensure_lookup_table()
print(f"apertures: refined {len(near)} faces around the vents")

doomed = [f for f in bm.faces
          if in_band(blender_to_app(panel.matrix_world @ f.calc_center_median(), GEN),
                     APERTURE_W / 2, APERTURE_L / 2)]

bmesh.ops.delete(bm, geom=doomed, context="FACES")
bm.to_mesh(panel.data)
bm.free()
panel.data.update()
print(f"apertures: removed {len(doomed)} faces")

sol = panel.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness = mm(PANEL_THICK)
sol.offset = -1.0                      # thicken downward, keep the outer skin
sol.use_rim = True
sol.use_rim_only = False
apply_modifier(panel, sol.name)


# -- 4. louvre blades -------------------------------------------------------

blade_meshes = []
for x in sides:
    for i in range(BLADES):
        z_app = APERTURE_Z + (i - (BLADES - 1) / 2.0) * BLADE_PITCH
        centre = app_to_blender(x, 0.0, z_app, GEN)
        bpy.ops.mesh.primitive_cube_add(
            size=1.0, location=(centre.x, centre.y, skin[x] - mm(RECESS)))
        blade = bpy.context.active_object
        blade.name = f"_blade_{'L' if x > 0 else 'R'}_{i}"
        blade.scale = (mm(APERTURE_W + BLADE_OVERLAP), mm(BLADE_CHORD), mm(BLADE_THICK))
        blade.rotation_euler = (math.radians(BLADE_ANGLE), 0.0, 0.0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        blade_meshes.append(blade)

bpy.ops.object.select_all(action="DESELECT")
for b in blade_meshes:
    b.select_set(True)
bpy.context.view_layer.objects.active = blade_meshes[0]
bpy.ops.object.join()
louvres = bpy.context.active_object
louvres.name = LOUVRES
louvres.data.name = LOUVRES
put(louvres, coll)


# -- 5. surround lip --------------------------------------------------------

rings = []
for x in sides:
    centre = app_to_blender(x, 0.0, APERTURE_Z, GEN)
    z = skin[x]
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(centre.x, centre.y, z))
    outer = bpy.context.active_object
    outer.name = f"_ring_{'L' if x > 0 else 'R'}"
    # 20 mm of lip each side: wide enough to cover the topology-following
    # aperture edge left by the face deletion in step 3.
    outer.scale = (mm(APERTURE_W + 40.0), mm(APERTURE_L + 40.0), mm(10.0))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(centre.x, centre.y, z))
    inner = bpy.context.active_object
    inner.name = f"_ringcut_{'L' if x > 0 else 'R'}"
    inner.scale = (mm(APERTURE_W), mm(APERTURE_L), mm(40.0))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    boolean(outer, inner, "DIFFERENCE")
    bpy.data.objects.remove(inner, do_unlink=True)
    rings.append(outer)

bpy.ops.object.select_all(action="DESELECT")
for r in rings:
    r.select_set(True)
bpy.context.view_layer.objects.active = rings[0]
bpy.ops.object.join()
surround = bpy.context.active_object
surround.name = SURROUND
surround.data.name = SURROUND
put(surround, coll)


# -- 6. materials, cleanup, UVs --------------------------------------------

assign(panel, "MOD_CarbonWeave")
assign(louvres, "MOD_SatinBlack")
assign(surround, "MOD_SatinBlack")

for obj in (panel, louvres, surround):
    clean(obj)

bevel_smooth(louvres, width=mm(1.0), segments=1)
bevel_smooth(surround, width=mm(1.0), segments=1)

# ~50 mm per weave tile, so the carbon does not change size between panels
box_uv(panel, scale=0.05)
box_uv(louvres, scale=0.05)
box_uv(surround, scale=0.05)

for obj in (panel, louvres, surround):
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

finalise_names(coll)

print("--- BP01 stats ---")
stats(coll, GEN)
