"""
WP01-WP30 -- "Wheels" by Wasi204 (Sketchfab, CC-BY-4.0), a 30-wheel pack, each
a self-contained assembly: a rim, a tyre and an already-modelled disc+caliper,
unlike WS01/WS02 which were bare rims needing a tyre/disc/caliper/lugs built
from primitives around them. That makes this the simple case: no revolve(),
no radial_copies(), just measure, scale and place what the source already is.

Unusually, these ship their own baked-texture materials (a small per-wheel
diffuse atlas carrying AO/highlight detail, not a flat colour) rather than the
project's normal flat-PBR §3 contract -- and that texture is very likely why
they read well at ~1,000 tris. Renaming them into MOD_Rim/MOD_Chrome would
replace the texture with a flat grey and lose exactly that. So unlike every
other mod, this script does NOT call assign()/mat(): materials keep their
own name (wheel_NN_metal, wheel_NN_rubber) and their own texture, which also
means they sit outside the surfaceClasses table on purpose -- the Wheel
finish picker will not recolour these, by design (see conversation).

Each `Wheel_NN` node in the pack is placed on a display tray at some
arbitrary showcase rotation -- that is stage dressing, not the wheel's own
shape. Measuring in raw import-world space confirmed this: bounding-box
extents came out nearly cubic (a real thin-axle wheel would not). Measuring
instead in each Wheel_NN node's OWN local frame
(`node.matrix_world.inverted() @ mesh.matrix_world`) recovers a clean
body-of-revolution: thin along local X, matched diameters on Y and Z. Checked
against wheels 1-3: rim and brake meshes both sit on the +X side in that
frame, tyre spans symmetric -- so, like WS01, no extra rotation is needed,
only the un-tilt, then the usual translate-and-scale.

Same bug WS01 found the hard way: a selected mesh whose parent chain is not
also selected/exported gets a non-identity root transform in the glTF, because
the exporter has nowhere else to put the accumulated parent offset. The fix
(parent_clear with CLEAR_KEEP_TRANSFORM) has to run BEFORE build_wp() can use
name-based lookup instead of the now-severed parent hierarchy, so
import_pack() captures each wheel's three meshes by walking Wheel_NN's
children first, then clears parents once for the whole pack.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/WP_wheelpack.py").read())
"""

import bpy
from mathutils import Vector, Matrix

GEN = "nd"
SRC_PATH = r"C:/Users/Damon/car-configurator/Models/wheels/scene.gltf"
SRC_COLL = "SRC_wheelpack"

PATCH = (734.0, 0.0, 1194.0)
TYRE_R = 320.5
AXLE = (PATCH[0], TYRE_R, PATCH[2])

# Populated by import_pack(): wheel index -> {"inv": Matrix, "meshes": [...]}.
WHEELS = {}


def import_pack():
    """Import once; safe to call again, reuses WHEELS if already populated."""
    if WHEELS and bpy.data.objects.get("Wheel_01"):
        print("wheel pack already imported, reusing")
        return

    old = bpy.data.collections.get(SRC_COLL)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)

    scratch = bpy.data.collections.new(SRC_COLL)
    bpy.context.scene.collection.children.link(scratch)

    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=SRC_PATH)
    imported = [o for o in bpy.data.objects if o.name not in before]
    roots = [o for o in imported if o.parent is None or o.parent not in imported]
    for o in roots:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        scratch.objects.link(o)

    bpy.context.view_layer.update()

    # Capture each wheel's own transform (for the display-tray un-tilt) and
    # its three meshes via the real parent hierarchy, BEFORE that hierarchy
    # gets severed below.
    WHEELS.clear()
    for n in range(1, 31):
        src = bpy.data.objects.get(f"Wheel_{n:02d}")
        if src is None:
            continue
        meshes = [o for o in src.children_recursive if o.type == "MESH"]
        WHEELS[n] = {"inv": src.matrix_world.inverted().copy(), "meshes": meshes}

    # Same bug WS01 found: a selected mesh whose parent chain is not also
    # selected/exported gets a non-identity root transform in the glTF. Clear
    # every mesh's parent now, once, while keeping its resolved world
    # transform -- build_wp()'s duplicates inherit parent=None from these.
    meshes = [o for w in WHEELS.values() for o in w["meshes"]]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")

    print(f"imported wheel pack: {len(imported)} objects, {len(WHEELS)} wheels, {len(meshes)} meshes parent-cleared")


def build_wp(n, mod_id):
    """Export wheel index n (1-30) from the pack as mod_id, e.g. build_wp(1, 'WP01')."""
    wheel = WHEELS.get(n)
    if wheel is None:
        raise KeyError(f"Wheel_{n:02d} not found -- did import_pack() run?")
    meshes = wheel["meshes"]
    inv = wheel["inv"]
    if len(meshes) != 3:
        raise RuntimeError(f"Wheel_{n:02d}: expected 3 meshes (rim, tyre, brakes), found {len(meshes)}")

    def mat_name(o):
        return o.material_slots[0].material.name if o.material_slots and o.material_slots[0].material else ""

    rim = next((o for o in meshes if "metal" in mat_name(o) and o.name.startswith("wheel_")), None)
    tyre = next((o for o in meshes if "rubber" in mat_name(o)), None)
    brakes = next((o for o in meshes if o not in (rim, tyre)), None)
    if not (rim and tyre and brakes):
        raise RuntimeError(f"Wheel_{n:02d}: could not identify rim/tyre/brakes among {[o.name for o in meshes]}")

    # Undo the pack's own display-tray placement: measure in Wheel_NN's local
    # frame, not raw import-world space. See module docstring.
    tyre_pts = [inv @ (tyre.matrix_world @ Vector(c)) for c in tyre.bound_box]
    rim_pts = [inv @ (rim.matrix_world @ Vector(c)) for c in rim.bound_box]
    xs = [p.x for p in tyre_pts]
    centre_x = (min(xs) + max(xs)) / 2.0
    raw_radius = max(max(abs(p.y), abs(p.z)) for p in tyre_pts)

    rim_xs = [p.x for p in rim_pts]
    if (sum(rim_xs) / len(rim_xs)) < centre_x:
        raise RuntimeError(
            f"Wheel_{n:02d}: rim sits on the -X side of the tyre centre in its own local "
            f"frame -- this wheel is authored backwards relative to 1-3, which were all "
            f"+X-outward. Needs a 180 flip before shipping, not a silent wrong export."
        )

    n_name = f"MOD_{GEN.upper()}_{mod_id}_"
    coll = start_mod(GEN, mod_id)

    scale = (TYRE_R / 1000.0) / raw_radius
    pivot = app_to_blender(*AXLE, gen=GEN)
    centre_offset = Vector((centre_x, 0.0, 0.0))

    kind = {rim: "rim", tyre: "tyre", brakes: "brakes"}
    for o in meshes:
        local = inv @ o.matrix_world
        dup = o.copy()
        dup.data = o.data.copy()
        dup.parent = None
        put(dup, coll)
        dup.matrix_world = (
            Matrix.Translation(pivot)
            @ Matrix.Scale(scale, 4)
            @ Matrix.Translation(-centre_offset)
            @ local
        )
        activate(dup)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        clean(dup)
        dup.name = dup.data.name = n_name + kind[o]

    finalise_names(coll)
    print(f"--- {mod_id} (from Wheel_{n:02d}) stats ---")
    stats(coll, GEN)
    return coll


import_pack()
PILOT = {1: "WP01", 2: "WP02", 3: "WP03"}
for n, mod_id in PILOT.items():
    build_wp(n, mod_id)
