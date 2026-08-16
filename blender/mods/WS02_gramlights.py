"""
WS02 — Rays Gramlights 57DR (ND), a SOURCED wheel. Second import, same
workflow as WS01 with one new wrinkle: this model's rotational axis is raw
Blender Y, not X. Confirmed numerically, not visually — Blender's viewport
stopped compositing partway through this session (stale frames returned
regardless of camera state; a known failure mode, see CONFORM_POSTMORTEM.md
for the same class of problem) — so orientation here rests on mesh position
analysis instead of a screenshot:

  * The four barrel shells span raw Y -0.110..-0.018 only — a shallow shell
    confined to the negative side.
  * Both sticker meshes sit in that SAME band (Y -0.099..-0.072), and
    branding goes on the visible face on a real wheel.
  * The large "obj_cleaner_materialmerger"-named mesh (evidently a leftover
    tool name from whatever pipeline prepared this asset, not a second brand
    reference — no texture exists to carry a logo, and the name reads as
    generated, not authored) extends to a much deeper +0.128, matching a
    mounting-side structural barrel.

That puts outward at NEGATIVE raw Y. Our convention is +X outward, so this
needs an actual rotation before the translate-and-scale that was sufficient
for WS01 — a +90 degree turn about Z maps old(-Y) to new(+X):
new_x = -old_y, new_y = old_x, new_z = old_z.

Also raw: 338,167 triangles across 9 meshes, no textures (every material is a
flat PBR factor) — a hard-surface CAD-style export, not a photo-scan. Two
mesh objects are branding and get deleted outright, same rule as WS01: a
black sticker and a yellow/gold sticker, both off-axis at the same clock
position, clearly a badge rather than a symmetric design element.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/WS02_gramlights.py").read())
"""

import bpy
import math
import re
from mathutils import Vector, Matrix

GEN = "nd"
SRC_PATH = r"C:/Users/Damon/car-configurator/Models/rays_gramlights_57dr/scene.gltf"
SRC_COLL = "SRC_gramlights"

PATCH = (734.0, 0.0, 1194.0)
TYRE_R = 320.5
AXLE = (PATCH[0], TYRE_R, PATCH[2])
RIM_R = 215.9            # theoretical bead-seat radius
# See W01_race_7spoke.py: the OEM asset's own rim reads out to ~258mm, not a
# bare 17in bead-seat conversion. Corrected by scaling the finished face
# afterward (scale_wheel_face) rather than baking a different target radius
# into the rescale-to-RIM_R step above.
RIM_SCALE = 258.0 / RIM_R
HALF_W = 114.3

# Identified by mesh position, not by name — see the module docstring. Matched
# by BASE name (see base_name() below): the glTF importer auto-suffixes on
# every repeat import ("Object_11.001" -> "Object_11.002" -> ...), so an exact
# string match works once and silently matches nothing on every re-run after —
# exactly the bug that shipped both stickers on the first attempt at this.
STICKER_BASE_NAMES = {"Object_11", "Object_14"}


def base_name(name):
    return re.sub(r"\.\d{3}$", "", name)


def purge_source_leftovers():
    old = bpy.data.collections.get(SRC_COLL)
    if old:
        for o in list(old.objects):
            for c in list(o.children_recursive):
                bpy.data.objects.remove(c, do_unlink=True)
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    for bucket in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for db in [b for b in bucket if b.users == 0]:
            bucket.remove(db)


def import_source():
    purge_source_leftovers()
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

    meshes = [o for o in imported if o.type == "MESH"]

    # See WS01: leaving the FBX parent chain intact means the glTF exporter
    # silently drops these meshes once the scratch collection is deleted.
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")

    return scratch, meshes


def strip_branding(meshes):
    doomed = [m for m in meshes if base_name(m.name) in STICKER_BASE_NAMES]
    for m in doomed:
        mesh_data = m.data
        bpy.data.objects.remove(m, do_unlink=True)
        bpy.data.meshes.remove(mesh_data)
        meshes.remove(m)
    if len(doomed) != len(STICKER_BASE_NAMES):
        raise RuntimeError(
            f"expected to remove {len(STICKER_BASE_NAMES)} branding mesh(es), "
            f"actually removed {len(doomed)} — base-name match is stale, check "
            f"the source glTF's node names before shipping this export"
        )
    print(f"removed {len(doomed)} branding mesh(es): {sorted(STICKER_BASE_NAMES)}")
    return meshes


def rename_to_contract(meshes):
    """
    Relabel each mesh's own material — see WS01 for why this reads off the
    mesh rather than searching bpy.data.materials by the original glTF name.
    Everything here is flat-shaded chrome/black/gold with no texture, so
    there is no cap-texture case to handle this time.

    Every mesh goes on MOD_Rim, including the near-black low-metal parts of
    the set (a valve-stem-ish rubber/plastic material) that an earlier
    version routed to MOD_SatinBlack instead. MOD_SatinBlack isn't itself
    wrong, but it's a class the wheel-finish picker never touches, and
    leaving that split in place meant those meshes stayed whatever colour
    they were scanned in at — a real wheel's small black hardware bits, not
    a deliberate two-tone styling choice — regardless of the user's finish
    selection. Simpler and more predictable to let the whole wheel follow
    finish colour uniformly.
    """
    for m in meshes:
        mat = m.material_slots[0].material if m.material_slots else None
        if not mat:
            continue
        mat.name = "MOD_Rim"
        print(f"  {m.name} material -> {mat.name}")


def measure_and_orient(meshes):
    """
    Rotate the axial direction (raw Y, confirmed numerically) onto Blender X
    with the outward face at +X, then measure the now-X-aligned model for
    scale and centring — same shape of result as WS01's measure_raw(), just
    with the reorientation folded in first so downstream code is identical.
    """
    turn = Matrix.Rotation(math.radians(90.0), 4, "Z")
    for o in meshes:
        o.matrix_world = turn @ o.matrix_world
        activate(o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bpy.context.view_layer.update()
    pts = []
    for o in meshes:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs = [p.x for p in pts]
    centre_x = (min(xs) + max(xs)) / 2.0
    radius = max(max(abs(p.y), abs(p.z)) for p in pts)
    print(f"post-rotation: centre_x={centre_x:.4f}  outer_radius={radius:.4f}  x_range=({min(xs):.4f},{max(xs):.4f})")
    return centre_x, radius


def place_and_scale(meshes, coll):
    centre_x, raw_radius = measure_and_orient(meshes)
    scale = (RIM_R / 1000.0) / raw_radius
    pivot = app_to_blender(*AXLE, gen=GEN)
    centre_offset = Vector((centre_x, 0.0, 0.0))

    for o in meshes:
        put(o, coll)
        o.matrix_world = (
            Matrix.Translation(pivot)
            @ Matrix.Scale(scale, 4)
            @ Matrix.Translation(-centre_offset)
            @ o.matrix_world
        )
        activate(o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return scale


def build_rim(mod_id, decimate_ratio=None):
    n = f"MOD_{GEN.upper()}_{mod_id}_"
    reset_mods()
    coll = start_mod(GEN, mod_id)

    scratch, meshes = import_source()
    meshes = strip_branding(meshes)
    rename_to_contract(meshes)
    place_and_scale(meshes, coll)
    bpy.data.collections.remove(scratch)

    for i, o in enumerate(meshes):
        o.name = o.data.name = n + f"src_{i}"

    if decimate_ratio is not None:
        total_before = sum(len(o.data.polygons) for o in meshes)
        for o in meshes:
            activate(o)
            mod = o.modifiers.new("Decimate", "DECIMATE")
            mod.ratio = decimate_ratio
            bpy.ops.object.modifier_apply(modifier=mod.name)
        total_after = sum(len(o.data.polygons) for o in meshes)
        print(f"decimated: {total_before} -> {total_after} faces (ratio {decimate_ratio})")

    tyre = revolve(n + "tyre", coll, [
        (-HALF_W,      RIM_R),
        (-HALF_W - 10, RIM_R + 50),
        (-HALF_W - 10, RIM_R + 82),
        (-118,         TYRE_R - 3),
        (-96,          TYRE_R),
        (-52,          TYRE_R),
        (-48,          TYRE_R - 2),
        (-44,          TYRE_R),
        (44,           TYRE_R),
        (48,           TYRE_R - 2),
        (52,           TYRE_R),
        (96,           TYRE_R),
        (118,          TYRE_R - 3),
        (HALF_W + 10,  RIM_R + 82),
        (HALF_W + 10,  RIM_R + 50),
        (HALF_W,       RIM_R),
    ], AXLE, segments=56, gen=GEN)
    for v in tyre.data.vertices:
        app = blender_to_app(tyre.matrix_world @ v.co, GEN)
        if app[1] < 8:
            v.co = app_to_blender(app[0], 0.0, app[2], GEN)
    tyre.data.update()
    assign(tyre, "MOD_Tyre")

    lug = revolve(n + "lugs", coll, [
        (10.0, 0.0), (18.0, 0.0), (18.0, 9.0), (10.0, 11.0),
    ], (AXLE[0], AXLE[1] + 50.0, AXLE[2]), segments=6, gen=GEN)
    lugs = radial_copies(lug, 4, AXLE, GEN)
    assign(lugs, "MOD_Chrome")

    disc = revolve(n + "disc", coll, [
        (2.0, 44.0), (2.0, 138.0), (-18.0, 138.0), (-18.0, 44.0),
    ], AXLE, segments=40, gen=GEN)
    assign(disc, "MOD_Chrome")

    caliper = block(n + "caliper", coll,
                    (AXLE[0] - 8.0, AXLE[1] + 4.0, AXLE[2] - 150.0),
                    (56.0, 130.0, 44.0), gen=GEN)
    assign(caliper, "MOD_CaliperPaint")

    for o in coll.objects:
        clean(o)
        if not o.data.uv_layers:
            box_uv(o, scale=0.05)
        activate(o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    scale_wheel_face(coll, RIM_SCALE, AXLE, GEN)

    finalise_names(coll)
    print(f"--- {mod_id} stats ---")
    stats(coll, GEN)
    return coll


build_rim(globals().get("MOD_ID", "WS02"), decimate_ratio=globals().get("DECIMATE_RATIO", None))
