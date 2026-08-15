"""
WS01 — Meister L1 3P (ND), a SOURCED wheel. First test of importing a real
scanned/modelled wheel rather than building one from primitives.

Source: Models/meister_l1_3p/scene.gltf — "Meister L1 3P" by Wilbruh
(sketchfab.com/mirz1911), CC-BY-4.0. Rim only, no tyre — paired here with our
own tyre/disc/caliper, the same parts every other wheel script builds.

Two things had to be fixed before this could ship, not just conformed:

  * Both textures carry real trademarks — a WORK Wheels(R) logo (a tiny decal
    mesh on the mounting side) and a MEISTER wordmark baked into the centre
    cap texture. The brief bans shipping either. The decal mesh is deleted
    outright; the cap keeps its geometry but loses its texture, replaced with
    a flat value matching the rest of the polished face.
  * Materials are RENAMED to the MOD_* contract, not recreated via mat().
    mat() stamps our own fixed metal/rough values from the §3 table, which
    would throw away this model's own tuned chrome finish (metal 1.0,
    roughness 0.035) — the whole point of trying a sourced model is to see
    whether that fidelity beats what revolve() can produce. A renamed
    material picks up a ".001"-style suffix when a "MOD_Rim" datablock already
    exists from an earlier wheel build; classOf() already normalises that
    away, so it recolours correctly regardless.

Measured raw import: outer diameter 455.8mm (barrel-only, no tyre — an 18in
rim is 457.2mm, so this was modelled at real-world scale already), width
273mm, rotational axis already aligned to Blender X with +X the outboard show
face — confirmed by looking straight down each axis before touching anything.
Scaled by 215.9/227.9 to match our own RIM_R.

Set DECIMATE_RATIO before running to export the decimated comparison pass
instead of the full-resolution one; both are separate exports, and the
original glTF on disk is never touched by either.

    exec(open(r"C:/Users/Damon/car-configurator/blender/mods/WS01_meister_l1.py").read())
"""

import bpy
import math
from mathutils import Vector, Matrix

GEN = "nd"
SRC_PATH = r"C:/Users/Damon/car-configurator/Models/meister_l1_3p/scene.gltf"

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

def purge_source_leftovers():
    """
    Remove every trace of a previous run — objects, meshes, materials, images.

    Materials are not collection-scoped in Blender, and the glTF importer never
    reuses an existing datablock on a second import; it mints a fresh
    "Material.001.001"-style copy every time. Without this, re-running the
    script (the whole point of committing it) accumulates one more generation
    of orphaned duplicates on every pass, and a hardcoded rename lookup like
    `bpy.data.materials['Material.001']` silently renames the WRONG, unused
    copy from an earlier run while this run's meshes keep pointing at their own
    untouched originals — which is exactly what happened building this the
    first time.
    """
    old = bpy.data.collections.get("SRC_meister_l1")
    if old:
        for o in list(old.objects):
            for c in list(o.children_recursive):
                bpy.data.objects.remove(c, do_unlink=True)
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    for block_set in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in [b for b in block_set if b.users == 0]:
            block_set.remove(block)


def import_source():
    """Import into a scratch collection, isolated from car and mod collections."""
    purge_source_leftovers()
    scratch = bpy.data.collections.new("SRC_meister_l1")
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

    # Clear the FBX-hierarchy parent chain (Sketchfab_model -> fbx -> RootNode
    # -> Circle -> mesh) with world transform preserved. Left in place, each
    # mesh still points at its original Empty parent, which becomes collection-
    # orphaned the moment the scratch collection is deleted later — and the
    # glTF exporter silently drops a selected mesh whose parent chain is not
    # resolvable in the export set. No error, no warning, just a missing
    # primitive, which is exactly what shipped on the first attempt at this.
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")

    return scratch, meshes


def base_name(name):
    """Strip Blender's '.001'-style auto-suffix to recover the original name."""
    import re
    return re.sub(r"\.\d{3}$", "", name)


def strip_branding(meshes):
    """
    Remove the logo decal outright; blank the cap's branded texture.

    Identified by the CURRENT mesh objects' own material references, not by a
    hardcoded name lookup in bpy.data.materials — the glTF importer mints a
    fresh "Material.001.001"-style datablock on every import rather than
    reusing one, so a name search finds whichever copy happens to match by
    accident, which may not be the one these meshes actually use.
    """
    sticker = next((m for m in meshes if base_name(m.name).startswith("sticker")), None)
    if sticker:
        mesh_data = sticker.data
        bpy.data.objects.remove(sticker, do_unlink=True)
        bpy.data.meshes.remove(mesh_data)
        meshes.remove(sticker)
        print("removed WORK logo decal mesh")

    cap = next((m for m in meshes if "cap" in base_name(m.name)), None)
    cap_mat = cap.material_slots[0].material if cap else None
    if cap_mat and cap_mat.use_nodes:
        bsdf = cap_mat.node_tree.nodes.get("Principled BSDF")
        base_input = bsdf.inputs["Base Color"]
        for link in list(base_input.links):
            tex_node = link.from_node
            cap_mat.node_tree.links.remove(link)
            cap_mat.node_tree.nodes.remove(tex_node)
        base_input.default_value = (0.628, 0.628, 0.628, 1.0)
        print(f"stripped MEISTER texture from {cap_mat.name}, flat grey in its place")

    return meshes


def rename_to_contract(meshes):
    """
    Relabel each mesh's OWN material into the §3 namespace, read off the mesh
    itself rather than searched up by name — see `strip_branding` for why.
    A renamed material may pick up a ".001"-style suffix if a "MOD_Rim"
    datablock already exists from an earlier wheel build in this session;
    classOf() already normalises that away when the app classifies materials,
    so it recolours correctly regardless of the exact suffix it ships with.
    """
    for m in meshes:
        mat = m.material_slots[0].material if m.material_slots else None
        if not mat:
            continue
        origin = base_name(m.name)
        new_name = "MOD_SatinBlack" if "Material.002" in origin else "MOD_Rim"
        mat.name = new_name
        print(f"  {m.name} material -> {mat.name}")


def measure_raw(meshes):
    """
    The model's own centreline and outer radius, from its actual geometry —
    not a guessed constant. The barrel shell alone defines the overall X
    extent (every other part sits inside it), so its bounding-box midpoint is
    the most defensible stand-in for "wheel centreline" absent real backspacing
    data, and the outer radius is whatever the widest point of the barrel
    measures, whichever mesh that turns out to be.
    """
    bpy.context.view_layer.update()
    pts = []
    for o in meshes:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs = [p.x for p in pts]
    centre_x = (min(xs) + max(xs)) / 2.0
    # max(|y|, |z|) SEPARATELY, not sqrt(y^2+z^2) over bbox corners — the
    # corners of an axis-aligned box combine the y-extreme and z-extreme as if
    # they occurred at the same point, which measures the box's DIAGONAL. For
    # a body of revolution the true radius is just the largest single-axis
    # magnitude; the diagonal overstates it by root-2 and was scaling the
    # whole wheel down by the same amount before this was caught.
    radius = max(max(abs(p.y), abs(p.z)) for p in pts)
    print(f"measured: centre_x={centre_x:.4f}  outer_radius={radius:.4f}")
    return centre_x, radius


def place_and_scale(meshes, coll):
    """Move the source meshes into the mod collection, scaled and positioned
    so their local X matches our AXLE convention, applied immediately."""
    centre_x, raw_radius = measure_raw(meshes)
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

    # -- our own tyre, disc, caliper and lugs, exactly as every other wheel --
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
        (10.0,  0.0), (18.0, 0.0), (18.0, 9.0), (10.0, 11.0),
    ], (AXLE[0], AXLE[1] + 50.0, AXLE[2]), segments=6, gen=GEN)
    lugs = radial_copies(lug, 4, AXLE, GEN)
    assign(lugs, "MOD_Chrome")

    disc = revolve(n + "disc", coll, [
        (2.0,  44.0), (2.0, 138.0), (-18.0, 138.0), (-18.0, 44.0),
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


which = globals().get("DECIMATE_RATIO", None)
build_rim(globals().get("MOD_ID", "WS01"), decimate_ratio=which)
