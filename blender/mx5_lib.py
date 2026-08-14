"""
Shared helpers for the MX-5 mod pipeline. See mx5-mod-modelling-brief.md §6.1.

Run this into Blender once per session:

    exec(open(r"C:/Users/Damon/car-configurator/blender/mx5_lib.py").read())

The one thing to understand before using it
-------------------------------------------
The base car in this .blend is the **raw glTF import**, sitting where the
importer put it. The app does not show it there: `CarModel.frame()` yaws it
180 degrees, scales it by 1.000562 and offsets it, and every anchor in the
brief is quoted in that final app space.

Rather than transform the user's scene (destructive, and easy to get wrong on
an unsaved file), this module keeps the scene raw and bakes the difference in
at **export** time. `app_to_blender()` converts a brief coordinate into the raw
space you are modelling in, and `export_glb()` converts back on the way out.
Both directions are exercised by `verify_frame()`, which asserts the base
bonnet lands on its measured app-space box.
"""

import bpy
import bmesh
import json
import math
import os
from mathutils import Matrix, Vector

REPO = r"C:/Users/Damon/car-configurator"
ANCHORS_PATH = os.path.join(REPO, "blender", "anchors.json")
EXPORT_ROOT = os.path.join(REPO, "public", "assets", "mods")

with open(ANCHORS_PATH, "r", encoding="utf-8") as fh:
    ANCHORS = json.load(fh)["generations"]


# ---------------------------------------------------------------- frame ----

def _frame(gen):
    """(scale, offset_mm) that CarModel.frame() applies to this generation."""
    f = ANCHORS[gen]["frame"]
    return f["scale"], f["offsetMm"]


def app_to_blender(x, y, z, gen="nd"):
    """
    App space (mm; +X left, +Y up, +Z nose) -> raw-import Blender space (m).

    Inverse of the relationship the raw import has to the running app:
        app_x = -bx*s          app_y = bz*s + oy       app_z = by*s + oz
    """
    s, (ox, oy, oz) = _frame(gen)
    return Vector((-x / s / 1000.0, (z - oz) / s / 1000.0, (y - oy) / s / 1000.0))


def blender_to_app(v, gen="nd"):
    """Raw-import Blender space (m) -> app space (mm), rounded."""
    s, (ox, oy, oz) = _frame(gen)
    return [round(-v[0] * s * 1000), round(v[2] * s * 1000 + oy), round(v[1] * s * 1000 + oz)]


def export_matrix(gen="nd"):
    """
    Raw-import space -> the Blender frame the brief specifies (nose toward -Y),
    positioned so the glTF exporter's (x, z, -y) conversion lands the mod in app
    space at identity transform.
    """
    s, (ox, oy, oz) = _frame(gen)
    return (
        Matrix.Translation(Vector((0.0, -oz / 1000.0, oy / 1000.0)))
        @ Matrix.Rotation(math.pi, 4, "Z")
        @ Matrix.Scale(s, 4)
    )


def anchor(node_name, gen="nd"):
    """A measured base-asset node's box, in app-space mm. Raises if unknown."""
    for n in ANCHORS[gen]["nodes"]:
        if n["name"] == node_name:
            return n
    raise KeyError(f"{node_name!r} is not a node in the {gen} asset")


def anchor_blender(node_name, gen="nd"):
    """The same box as two Blender-space corners, for snapping against."""
    n = anchor(node_name, gen)
    a = app_to_blender(*[n["bbox"]["min"][i] for i in range(3)], gen=gen)
    b = app_to_blender(*[n["bbox"]["max"][i] for i in range(3)], gen=gen)
    return (Vector((min(a[i], b[i]) for i in range(3))),
            Vector((max(a[i], b[i]) for i in range(3))))


def base_mesh(node_name, gen="nd"):
    """
    The mesh object for a named base-asset node.

    The exporter wraps every meaningful part in an anonymous `Object_N` child,
    so the name from anchors.json is usually an empty with the geometry beneath.
    """
    obj = bpy.data.objects.get(node_name)
    if obj is None:
        raise KeyError(f"no object named {node_name!r} in this .blend")
    if obj.type == "MESH":
        return obj
    kids = [c for c in obj.children_recursive if c.type == "MESH"]
    if len(kids) != 1:
        raise ValueError(f"{node_name!r} has {len(kids)} mesh children, expected 1")
    return kids[0]


def verify_frame(gen="nd", node_name="Hood 6.001_120"):
    """Prove the round trip against a measured node before trusting it."""
    mesh = base_mesh(node_name, gen)
    pts = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    got = [blender_to_app(p, gen) for p in pts]
    lo = [min(p[i] for p in got) for i in range(3)]
    hi = [max(p[i] for p in got) for i in range(3)]
    want = anchor(node_name, gen)["bbox"]
    ok = all(abs(lo[i] - want["min"][i]) <= 2 and abs(hi[i] - want["max"][i]) <= 2 for i in range(3))
    print(f"verify_frame({node_name}): measured {lo}..{hi} vs anchors {want['min']}..{want['max']} -> {'OK' if ok else 'MISMATCH'}")
    return ok


# ------------------------------------------------------------ materials ----

#: The §3 contract. Values are (base_colour, metallic, roughness).
MATERIALS = {
    "MOD_BodyPaint":    ((0.78, 0.78, 0.80, 1), 0.90, 0.25),
    "MOD_AccentPaint":  ((0.55, 0.06, 0.06, 1), 0.35, 0.35),
    "MOD_Rim":          ((0.42, 0.43, 0.45, 1), 0.95, 0.28),
    # Base colours here are LINEAR, and the eye reads sRGB: 0.03 linear renders
    # as #303030, which is a mid grey, not a tyre. Photographed rubber sits
    # nearer #1a1a1a, so 0.010 linear.
    "MOD_Tyre":         ((0.010, 0.010, 0.011, 1), 0.00, 0.94),
    "MOD_CaliperPaint": ((0.60, 0.05, 0.05, 1), 0.30, 0.40),
    "MOD_CarbonWeave":  ((0.045, 0.047, 0.052, 1), 0.35, 0.28),
    "MOD_GlossBlack":   ((0.02, 0.02, 0.02, 1), 0.20, 0.12),
    "MOD_SatinBlack":   ((0.03, 0.03, 0.03, 1), 0.10, 0.55),
    "MOD_Rubber":       ((0.012, 0.012, 0.013, 1), 0.00, 0.90),
    "MOD_Alloy":        ((0.62, 0.63, 0.65, 1), 1.00, 0.32),
    "MOD_Chrome":       ((0.90, 0.91, 0.93, 1), 1.00, 0.06),
    "MOD_Titanium":     ((0.38, 0.34, 0.45, 1), 1.00, 0.30),
    "MOD_Glass":        ((0.85, 0.88, 0.92, 1), 0.00, 0.05),
    "MOD_MirrorGlass":  ((0.92, 0.93, 0.95, 1), 1.00, 0.02),
    "MOD_Mesh":         ((0.02, 0.02, 0.02, 1), 0.30, 0.45),
}


def mat(name):
    """
    Get-or-create a contract material, refreshing it from the table.

    Deliberately re-applies the values to a material that already exists. The
    table is the source of truth, and a session that has already built a mod
    holds the old material — without this, editing a colour here and rebuilding
    silently exports the previous one.
    """
    if name not in MATERIALS:
        raise KeyError(f"{name!r} is not in the §3 material contract: {sorted(MATERIALS)}")
    colour, metallic, roughness = MATERIALS[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def assign(obj, name, faces=None):
    """
    Assign a contract material, to the whole object or to face indices.

    Assigning to the whole object first strips every existing slot. A panel
    duplicated from the base car arrives carrying the car's own material (and
    sometimes an empty slot), and a mod may only ship §3 names — the validator
    rejects anything else, so inheriting one is never what is wanted.
    """
    material = mat(name)
    if faces is None:
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for p in obj.data.polygons:
            p.material_index = 0
        obj.data.update()
        return 0

    names = [s.material.name if s.material else None for s in obj.material_slots]
    if name not in names:
        obj.data.materials.append(material)
        names.append(name)
    slot = names.index(name)
    wanted = set(faces)
    for p in obj.data.polygons:
        if p.index in wanted:
            p.material_index = slot
    obj.data.update()
    return slot


BASE_BLEND = os.path.join(REPO, "blender", "build", "mx5_base.blend")


def save_base():
    """
    Snapshot the current scene as the pristine base, once.

    This is the only genuinely expensive thing in the .blend — 368 imported
    objects and their textures. Every mod is rebuilt from its script, so nothing
    else needs saving; this exists so a Blender crash costs seconds instead of a
    re-import and a re-setup.
    """
    os.makedirs(os.path.dirname(BASE_BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BASE_BLEND, copy=True)
    print(f"saved base scene -> {BASE_BLEND} ({os.path.getsize(BASE_BLEND)/1048576:.0f} MB)")
    return BASE_BLEND


def reset_mods(keep=()):
    """
    Clear every MOD_* collection and its orphans, without touching the file.

    This is the reset to reach for. A long run accumulates cruft — orphaned
    meshes squat on names and the next build silently becomes `..._panel.008`,
    which is exactly what the naming contract forbids. Purging between mods
    keeps each build starting from the same state.
    """
    dropped = []
    for coll in list(bpy.data.collections):
        if not coll.name.startswith("MOD_") or coll.name in keep or coll.name == "MOD_TESTS":
            continue
        name = coll.name          # read it before the datablock goes away
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(coll)
        dropped.append(name)
    sweep_temporaries("_")
    purge_orphan_meshes()
    if dropped:
        print(f"reset: dropped {', '.join(dropped)}")
    return dropped


def restore_base():
    """
    Append the saved base scene into the CURRENT file.

    The recovery path to reach for, and the reason `save_base()` exists. Unlike
    `reload_base()` this does not open a file, so the Python state — and with it
    the MCP add-on's timers — survives, which matters when nobody is sitting in
    front of Blender to reconnect the bridge.

    Appends whole collections, so parenting and the exporter's helper armatures
    come across intact rather than as a bag of loose objects.

    One consequence: the snapshot stays registered as a library in the restored
    session, so `save_base()` cannot overwrite it until Blender is restarted. It
    does not need to — the scene is the same car it was saved from.
    """
    if not os.path.exists(BASE_BLEND):
        raise FileNotFoundError(f"no base scene at {BASE_BLEND}; nothing to restore from")

    before = set(bpy.data.objects.keys())
    with bpy.data.libraries.load(BASE_BLEND, link=False) as (src, dst):
        dst.collections = list(src.collections)

    scene = bpy.context.scene.collection
    for coll in dst.collections:
        if coll is not None and coll.name not in {c.name for c in scene.children}:
            scene.children.link(coll)

    # Essential, not hygiene: until the depsgraph is evaluated, `matrix_world`
    # on the appended objects ignores their parents, so the exporter's 0.01
    # helper armatures are missing and every measurement reads 100x too large.
    # That is the same wrong number CONFORM_POSTMORTEM.md records chasing.
    bpy.context.view_layer.update()

    gained = len(set(bpy.data.objects.keys()) - before)
    print(f"restored {gained} objects from {BASE_BLEND}")
    return gained


def reload_base():
    """
    Reload the saved base file, discarding everything in memory.

    DANGER, and deliberately not used by the unattended build loop:
    `wm.open_mainfile` tears down the Python state, and the MCP add-on's timers
    go with it, so the bridge usually has to be reconnected by hand afterwards.
    Use `reset_mods()` instead unless the scene is genuinely unrecoverable and
    somebody is sitting in front of Blender.
    """
    if not os.path.exists(BASE_BLEND):
        raise FileNotFoundError(f"no base scene at {BASE_BLEND}; call save_base() first")
    print("reload_base(): this will probably drop the MCP connection — reconnect after")
    bpy.ops.wm.open_mainfile(filepath=BASE_BLEND)


def purge_orphan_meshes():
    """
    Drop mesh datablocks nothing uses.

    Re-running a build leaves the previous run's meshes orphaned but still
    holding their names, so the new ones get `.008` suffixes — which the naming
    contract forbids and which end up in the exported .glb.
    """
    dead = [m for m in bpy.data.meshes if m.users == 0]
    for m in dead:
        bpy.data.meshes.remove(m)
    return len(dead)


def finalise_names(coll):
    """Give every mesh datablock the same name as its object, suffix-free."""
    purge_orphan_meshes()
    for obj in coll.objects:
        if obj.type == "MESH":
            obj.data.name = obj.name
    bad = [o.data.name for o in coll.objects
           if o.type == "MESH" and o.data.name != o.name]
    if bad:
        print(f"  ! could not clean mesh names: {bad}")
    return not bad


def sweep_temporaries(prefix="_"):
    """Remove leftover scratch objects from a build that failed part-way."""
    gone = [o.name for o in list(bpy.data.objects) if o.name.startswith(prefix)]
    for name in gone:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    if gone:
        print(f"swept {len(gone)} temporaries: {', '.join(gone[:8])}")
    return gone


# ------------------------------------------------------------- geometry ----

def start_mod(gen, mod_id):
    """Create (or empty) the mod's collection and return it."""
    name = f"MOD_{gen.upper()}_{mod_id}"
    coll = bpy.data.collections.get(name)
    if coll:
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def put(obj, coll):
    """Move an object into a collection and out of every other."""
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def activate(obj):
    """
    Make `obj` the sole selected object and the active one.

    Setting `view_layer.objects.active` alone is not enough: `modifier_apply`
    resolves its target from the selection, so leaving some other object
    selected silently applies the modifier to that instead — which is how a
    boolean cutter ends up replacing the panel it was meant to cut.
    """
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj


def apply_modifier(obj, name):
    """Apply one modifier to `obj`, with the selection set correctly."""
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=name)
    return obj


def boolean(obj, cutter, operation="DIFFERENCE", solver="EXACT"):
    """Apply a boolean of `cutter` onto `obj` and return `obj`."""
    activate(obj)
    mod = obj.modifiers.new(f"Bool_{cutter.name}", "BOOLEAN")
    mod.operation = operation
    mod.object = cutter
    mod.solver = solver
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def apply_all(obj):
    """Apply every modifier, then all transforms."""
    activate(obj)
    for m in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError as err:
            print(f"  ! modifier {m.name} on {obj.name}: {err}")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def bevel_smooth(obj, width=0.0015, segments=2, angle=30):
    """A small bevel on hard edges plus smooth shading — brief §5."""
    activate(obj)
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = width
    bev.segments = segments
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(angle)
    bev.harden_normals = False
    bpy.ops.object.modifier_apply(modifier=bev.name)
    for p in obj.data.polygons:
        p.use_smooth = True
    # `use_auto_smooth` was removed in Blender 4.1; smooth-by-angle became an
    # operator that adds a modifier. Fall back to plain smooth shading, which is
    # fine here because the hard edges have just been bevelled.
    if hasattr(bpy.ops.object, "shade_auto_smooth"):
        try:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
        except (RuntimeError, TypeError) as err:
            print(f"  ! shade_auto_smooth on {obj.name}: {err}")
    elif hasattr(obj.data, "use_auto_smooth"):
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = math.radians(angle)


def clean(obj, merge=0.0001):
    """Merge doubles and recalculate normals outward."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def box_uv(obj, scale=0.05):
    """
    A cheap world-scale UV, adequate for a weave that must not change size
    between panels (brief §5). Replace with a proper unwrap where it shows.
    """
    activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=scale)
    bpy.ops.object.mode_set(mode="OBJECT")


# ------------------------------------------------------- panel surgery ----
#
# Every REPLACE body panel is the same four moves: take the OEM surface so the
# shut lines are right by construction, refine the small area you are about to
# work on, reshape or open it, then give it thickness. Doing that per mod is how
# you end up with four subtly different versions of the same bug.


def panel_from_base(node_name, name, coll, gen="nd"):
    """A free-standing, transform-applied copy of a base panel."""
    src = base_mesh(node_name, gen)
    panel = src.copy()
    panel.data = src.data.copy()
    panel.name = panel.data.name = name
    panel.parent = None
    panel.matrix_world = src.matrix_world
    put(panel, coll)
    activate(panel)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return panel


def _face_app(obj, face, gen):
    return blender_to_app(obj.matrix_world @ face.calc_center_median(), gen)


def refine_faces(obj, inside, cuts=3, gen="nd"):
    """
    Subdivide only where `inside(app_xyz)` says so.

    Both base panels are around 40 mm per face, which is far too coarse to cut a
    300 mm aperture or sink a duct into. Subdividing the whole panel costs
    several times the triangle budget for detail that appears nowhere, so refine
    a band and leave the rest alone.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    near = [f for f in bm.faces if inside(_face_app(obj, f, gen))]
    edges = {e for f in near for e in f.edges}
    if edges:
        bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=cuts, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len(near)


def delete_faces(obj, inside, gen="nd"):
    """
    Open a hole by deleting faces, not by boolean.

    The base panels are open single-skin shells with several boundary loops, so
    "inside" is undefined for them and an EXACT boolean returns the cutter volume
    instead of the difference. Deletion is deterministic, and a later Solidify's
    rim fill gives the opening a real wall.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    doomed = [f for f in bm.faces if inside(_face_app(obj, f, gen))]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len(doomed)


def displace(obj, offset_mm, gen="nd"):
    """
    Move vertices vertically by `offset_mm(app_xyz)` — app +Y, so up is positive.

    Used to sink a duct or raise a blister into an existing panel without
    detaching it, which keeps the surrounding surface continuous.
    """
    s, _ = _frame(gen)
    moved = 0
    for v in obj.data.vertices:
        app = blender_to_app(obj.matrix_world @ v.co, gen)
        d = offset_mm(app)
        if d:
            v.co.z += d / 1000.0 / s
            moved += 1
    obj.data.update()
    return moved


def surface_y(obj, app_x, app_z, gen="nd", from_y=2400.0):
    """
    Height of `obj`'s skin directly above an app (x, z), in app millimetres.

    This is how anything that must sit ON the car finds what it is sitting on —
    a wing's base plates, a bonnet pin, an antenna gasket. Measuring beats
    assuming: the brief's nominal heights are quoted against a different datum
    and leave parts hanging.

    `ray_cast` works in the object's LOCAL space, so the direction has to be
    rotated into it as well as the origin. Base-asset parts carry the exporter's
    helper-armature transforms, so skipping that quietly misses every time.
    """
    inv = obj.matrix_world.inverted()
    origin = inv @ app_to_blender(app_x, from_y, app_z, gen)
    down = (inv.to_3x3() @ (app_to_blender(0, 0, 0, gen) - app_to_blender(0, 1000, 0, gen))).normalized()
    hit, loc, _n, _i = obj.ray_cast(origin, down)
    if not hit:
        raise RuntimeError(f"nothing under app ({app_x}, {app_z}) on {obj.name}")
    return blender_to_app(obj.matrix_world @ loc, gen)[1]


def surface_x(obj, app_y, app_z, gen="nd", side=1, from_x=1400.0):
    """
    Where `obj`'s skin is, cast inboard from outside the car, in app mm.

    The sideways counterpart to `surface_y`, and just as necessary: the ND's
    front bumper is 857 wide at its widest but only about 600 at z 1790, so
    anything placed on a bumper corner from the overall bounding box floats in
    mid-air. Anything that has to sit on, or bury itself into, a flank wants
    this — canards, mirrors, over-fenders, skirts.

    `side` is +1 for the vehicle's left (+X) and -1 for its right.
    """
    inv = obj.matrix_world.inverted()
    origin = inv @ app_to_blender(side * abs(from_x), app_y, app_z, gen)
    inward = (inv.to_3x3() @ (app_to_blender(0, 0, 0, gen)
                              - app_to_blender(side * 1000.0, 0, 0, gen))).normalized()
    hit, loc, _n, _i = obj.ray_cast(origin, inward)
    if not hit:
        raise RuntimeError(f"no skin at app (y {app_y}, z {app_z}) on {obj.name}")
    return blender_to_app(obj.matrix_world @ loc, gen)[0]


def solidify(obj, thickness_mm, gen="nd", offset=-1.0):
    """Give a single-skin panel real thickness, filling any open rims."""
    s, _ = _frame(gen)
    mod = obj.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness = thickness_mm / 1000.0 / s
    mod.offset = offset
    mod.use_rim = True
    return apply_modifier(obj, mod.name)


# ------------------------------------------------------------- revolve ----


def revolve(name, coll, profile, centre_app, segments=48, close=True, gen="nd", axis="x"):
    """
    Spin a 2D cross-section around the vehicle's X axis.

    `profile` is a list of `(x_mm, radius_mm)` relative to `centre_app`, the
    axle centre in app millimetres. This is how every round part gets built —
    rim barrels, tyres, brake discs, exhaust tips — because a spun profile has
    the right silhouette by construction. Extruding a cylinder and hoping does
    not: the bead seats and the drop centre are the whole shape of a rim.

    `close` joins the last profile point back to the first, giving a closed
    solid of revolution.

    `axis` is "x" for anything that turns with a wheel and "z" for anything
    pointing down the length of the car — exhaust pipes, tips, mufflers. The
    profile's first coordinate always runs along the chosen axis.
    """
    cx, cy, cz = centre_app
    rings = []
    for x, r in profile:
        ring = []
        for j in range(segments):
            a = 2.0 * math.pi * j / segments
            c, s = r * math.cos(a), r * math.sin(a)
            if axis == "z":
                ring.append(app_to_blender(cx + c, cy + s, cz + x, gen))
            else:
                ring.append(app_to_blender(cx + x, cy + c, cz + s, gen))
        rings.append(ring)

    verts = [v for ring in rings for v in ring]
    faces = []
    pairs = list(zip(range(len(rings)), range(1, len(rings))))
    if close and len(rings) > 2:
        pairs.append((len(rings) - 1, 0))
    for a, b in pairs:
        for j in range(segments):
            k = (j + 1) % segments
            faces.append([a * segments + j, a * segments + k, b * segments + k, b * segments + j])

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([v[:] for v in verts], [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    put(obj, coll)
    clean(obj)
    return obj


def rounded_path(corners, radius, per_corner=6):
    """
    Replace each interior corner of a polyline with a circular arc.

    Roll-bar tube is bent, not mitred, and a hoop drawn as straight segments
    meeting at a point reads as a wireframe. Corners are given as app-space
    points; the returned polyline is ready for `sweep()`.
    """
    pts = [Vector(c) for c in corners]
    if len(pts) < 3:
        return [tuple(p) for p in pts]

    out = [tuple(pts[0])]
    for i in range(1, len(pts) - 1):
        prev, here, nxt = pts[i - 1], pts[i], pts[i + 1]
        into, away = (prev - here), (nxt - here)
        # Never cut back further than half of either leg.
        r = min(radius, into.length / 2.0, away.length / 2.0)
        into.normalize()
        away.normalize()
        start, end = here + into * r, here + away * r
        for s in range(per_corner + 1):
            t = s / per_corner
            # Quadratic Bezier through the corner: a clean, monotonic fillet.
            a = start.lerp(here, t)
            b = here.lerp(end, t)
            out.append(tuple(a.lerp(b, t)))
    out.append(tuple(pts[-1]))
    return out


def sweep(name, coll, path, radius_mm, segments=12, gen="nd", caps=True):
    """
    Sweep a circular section along an app-space polyline — tube, in other words.

    The frame is parallel-transported rather than rebuilt per point, so the
    section does not spin as the path bends and the tube keeps a consistent
    silhouette through a hoop's corners.
    """
    pts = [Vector(p) for p in path]
    tangents = []
    for i in range(len(pts)):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == len(pts) - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized())

    ref = Vector((0.0, 0.0, 1.0))
    if abs(tangents[0].dot(ref)) > 0.9:
        ref = Vector((1.0, 0.0, 0.0))
    normal = (ref - tangents[0] * ref.dot(tangents[0])).normalized()

    normals = [normal]
    for i in range(1, len(pts)):
        n = normals[-1].copy()
        axis = tangents[i - 1].cross(tangents[i])
        if axis.length > 1e-6:
            angle = math.acos(max(-1.0, min(1.0, tangents[i - 1].dot(tangents[i]))))
            n = Matrix.Rotation(angle, 3, axis.normalized()) @ n
        n = (n - tangents[i] * n.dot(tangents[i])).normalized()
        normals.append(n)

    verts, faces = [], []
    for i, centre in enumerate(pts):
        n = normals[i]
        b = tangents[i].cross(n)
        for j in range(segments):
            a = 2.0 * math.pi * j / segments
            p = centre + (n * math.cos(a) + b * math.sin(a)) * radius_mm
            verts.append(app_to_blender(p.x, p.y, p.z, gen)[:])

    for i in range(len(pts) - 1):
        for j in range(segments):
            k = (j + 1) % segments
            faces.append([i * segments + j, i * segments + k,
                          (i + 1) * segments + k, (i + 1) * segments + j])
    if caps:
        faces.append(list(range(segments - 1, -1, -1)))
        faces.append(list(range((len(pts) - 1) * segments, len(pts) * segments)))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    put(obj, coll)
    clean(obj)
    return obj


def block(name, coll, centre_app, size_app, gen="nd", rotate_x=0.0):
    """
    An axis-aligned box in app millimetres, optionally rolled about the X axis.

    Spokes, blades, footplates, endplates and bolt heads are all boxes before
    they are anything else, and building them from app-space numbers keeps the
    brief's dimensions readable in the code that uses them.

    Returns with all transforms applied, so `matrix_world` is identity and the
    vertices are in world space — the same invariant `revolve()` has. Callers
    reshape vertices by reading `blender_to_app(v.co)` and writing back, which
    is only correct while that holds.
    """
    s, _ = _frame(gen)
    centre = app_to_blender(*centre_app, gen=gen)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(centre.x, centre.y, centre.z))
    obj = bpy.context.active_object
    obj.name = obj.data.name = name
    # size_app is (across, up, fore-aft) in app axes; the cube's axes are
    # Blender's, where app Y is Z and app Z is Y. Feeding app sizes straight in
    # swaps a spoke's length with its width, which still looks like a wheel
    # right up until you measure it.
    sx, sy, sz = size_app
    obj.scale = (sx / s / 1000.0, sz / s / 1000.0, sy / s / 1000.0)
    if rotate_x:
        obj.rotation_euler = (rotate_x, 0.0, 0.0)
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    put(obj, coll)
    return obj


def radial_copies(obj, count, centre_app, gen="nd", start_deg=0.0):
    """
    Copy `obj` evenly around the X axis and join them into one mesh.

    Spokes are one spoke, seven times. Modelling seven of them separately is how
    they end up not quite matching.
    """
    cx, cy, cz = centre_app
    pivot = app_to_blender(cx, cy, cz, gen)
    made = [obj]
    for i in range(1, count):
        dup = obj.copy()
        dup.data = obj.data.copy()
        for c in obj.users_collection:
            c.objects.link(dup)
        angle = math.radians(start_deg + 360.0 * i / count)
        dup.matrix_world = (
            Matrix.Translation(pivot)
            @ Matrix.Rotation(angle, 4, "X")
            @ Matrix.Translation(-pivot)
            @ obj.matrix_world
        )
        made.append(dup)

    bpy.ops.object.select_all(action="DESELECT")
    for m in made:
        m.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    joined = bpy.context.active_object
    activate(joined)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return joined


# ---------------------------------------------------------------- stats ----

def stats(objs, gen="nd"):
    """bbox in app-space mm, tris, materials, loose verts, non-manifold edges."""
    if isinstance(objs, bpy.types.Collection):
        objs = list(objs.objects)
    elif isinstance(objs, bpy.types.Object):
        objs = [objs]

    pts, tris, mats, loose, nonman = [], 0, [], 0, 0
    for obj in objs:
        if obj.type != "MESH":
            continue
        pts += [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        tris += sum(len(p.vertices) - 2 for p in obj.data.polygons)
        mats += [s.material.name for s in obj.material_slots if s.material]
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        loose += len([v for v in bm.verts if not v.link_faces])
        nonman += len([e for e in bm.edges if len(e.link_faces) > 2])
        bm.free()

    app = [blender_to_app(p, gen) for p in pts]
    report = {
        "objects": [o.name for o in objs],
        "bbox_app_mm": {
            "min": [min(p[i] for p in app) for i in range(3)],
            "max": [max(p[i] for p in app) for i in range(3)],
        },
        "triangles": tris,
        "materials": sorted(set(mats)),
        "loose_verts": loose,
        "non_manifold_edges": nonman,
    }
    print(json.dumps(report, indent=1))
    return report


# --------------------------------------------------------------- export ----

def export_glb(gen, mod_id, filename, objs, origin=None):
    """
    Export the mod, converted into app space, leaving the scene untouched.

    Works on throwaway duplicates so the raw-import scene the artist is
    modelling against is never rotated or rescaled.

    `origin` is an app-space point (mm) to treat as the mod's local zero. Body
    mods leave it None and export in absolute app coordinates, so they drop in
    at identity. Wheels pass their contact patch, because the app parents them
    to a pivot that is already sitting there — see brief §2.2.
    """
    if isinstance(objs, bpy.types.Collection):
        objs = list(objs.objects)

    matrix = export_matrix(gen)
    if origin is not None:
        # In the exported frame, app (x, y, z) is Blender (x, -z, y).
        ox, oy, oz = origin
        matrix = Matrix.Translation(Vector((-ox / 1000.0, oz / 1000.0, -oy / 1000.0))) @ matrix
    bpy.ops.object.select_all(action="DESELECT")

    # Blender will not let two datablocks share a name, so a copy of
    # `MOD_ND_BP01_panel` becomes `MOD_ND_BP01_panel.009` — which is exactly
    # what the naming contract forbids, and what would ship in the .glb. Park
    # the originals under a suffix for the duration so the copies can hold the
    # real names, and put them back afterwards.
    copies, renamed = [], []
    for obj in objs:
        if obj.type != "MESH":
            continue
        obj_name, data_name = obj.name, obj.data.name
        obj.name, obj.data.name = obj_name + "__src", data_name + "__src"
        renamed.append((obj, obj_name, data_name))

        dup = obj.copy()
        dup.data = obj.data.copy()
        dup.name, dup.data.name = obj_name, data_name
        dup.matrix_world = matrix @ obj.matrix_world
        bpy.context.scene.collection.objects.link(dup)
        copies.append(dup)

    for dup in copies:
        bpy.context.view_layer.objects.active = dup
        dup.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    out_dir = os.path.join(EXPORT_ROOT, gen)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, filename)

    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_normals=True,
        export_texcoords=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )

    for dup in copies:
        mesh = dup.data
        bpy.data.objects.remove(dup, do_unlink=True)
        bpy.data.meshes.remove(mesh)
    for obj, obj_name, data_name in renamed:
        obj.name, obj.data.name = obj_name, data_name

    size = os.path.getsize(path)
    print(f"exported {path} ({size/1024:.0f} kB)")
    return path


print("mx5_lib loaded — anchors for:", ", ".join(ANCHORS))
