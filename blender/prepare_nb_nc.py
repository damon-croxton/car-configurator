"""Prepare the NB and NC Sketchfab models for the app.

Run inside a Blender session that has just imported the source model with
the BlenderMCP Sketchfab importer (which needs the user's API key):

    NB  "Mazda MX-5 (NB) convertible HQ interior" by niev, uid 5d103c567bee4c61ad66f04562049933
    NC  "2009 Mazda MX-5 Miata (NC)" by supercarmodels, uid 44f83bd458df4025b8daa7f6eeb36b1f

then `prepare('nb', root)` / `prepare('nc', root)` with the importer's root
empty. Each step:

1. bakes the hierarchy into world-space meshes, stood upright (the NB
   imports with its height along -Y);
2. drops the number plates (the NB's read "HUM3D");
3. moves every face inside a wheel (tyre, rim, brake) into per-wheel
   objects with their own materials, because CarModel finds wheels by
   material class and buckets them by quadrant — a tyre mesh spanning all
   four wheels, or a rim material shared with body badges, breaks that;
4. decimates by material (~1.1-1.25M faces down to ~250-300k), never the
   rims or tyres, whose thin lips break up under collapse decimation;
5. prefixes materials with the car id, drops unused UVs, corrects the
   PBR values the importer lost (MATERIAL_FIX: the NB's chrome came in as
   matte grey, its black trim and tyres mid grey), and exports
   public/assets/models/mx5_<id>/scene.glb (see `export`).

Front ends at -Y in Blender, so the glTF nose points +Z (modelYawDeg 0).
"""
import math
import os
import bmesh
import bpy
import mathutils

CFG = {
    'nb': {
        'upright': mathutils.Matrix.Rotation(-math.pi / 2, 4, 'X'),
        'plates': ('LicPlate_',),
        # Wheel centres (x, y) and tyre radius, after standing upright.
        'wheels': {'LF': (0.72, -1.19), 'RF': (-0.72, -1.19), 'LR': (0.72, 1.11), 'RR': (-0.72, 1.11)},
        'radius': 0.30,
        'wheel_mats': {'material_20': 'rim', 'tire': 'tire', 'brakedisk': 'brake'},
        'ratio': {'carpaint': 0.3, 'chrome': 0.22, 'black': 0.16, 'interior_second': 0.12, 'interior_third': 0.2,
                  'interior_fourth': 0.2, 'interior_fifth': 0.2, 'clearglass': 0.3, 'orangeglass': 0.3,
                  'redglass': 0.35, 'windowglass': 0.4, 'white': 0.25, 'mattemetal': 0.3},
    },
    'nc': {
        'upright': mathutils.Matrix.Identity(4),
        'plates': ('Material__',),
        'wheels': {'LF': (0.725, -1.225), 'RF': (-0.725, -1.225), 'LR': (0.725, 1.085), 'RR': (-0.725, 1.085)},
        'radius': 0.315,
        'wheel_mats': {'material': 'rim', 'tire': 'tire', 'brakedisk': 'brake'},
        'ratio': {'chrome': 0.15, 'black': 0.18, 'interior': 0.15, 'carpaint': 0.4, 'clearglass': 0.35,
                  'brakedisk': 0.4, 'material': 0.3, 'redglass': 0.4, 'orangeglass': 0.5},
    },
}
OUT = r'C:/Users/Damon/car-configurator/public/assets/models'

#: Principled values (linear base colour, metallic, roughness[, alpha]) for
#: materials whose imported values read wrong under the app's lighting.
MATERIAL_FIX = {
    'nb': {
        'NB_black': ((0.018, 0.018, 0.018), 0.0, 0.75),
        'NB_chrome': ((0.8, 0.8, 0.8), 1.0, 0.15),
        'NB_mattemetal': ((0.6, 0.6, 0.6), 0.9, 0.45),
        'NB_mirror': ((0.9, 0.9, 0.9), 1.0, 0.03),
        'NB_wheel_tire': ((0.02, 0.02, 0.02), 0.0, 0.85),
        'NB_wheel_brake': ((0.45, 0.45, 0.45), 0.7, 0.45),
        'NB_interior_third': ((0.03, 0.03, 0.03), 0.0, 0.9),
        'NB_interior_fourth': ((0.035, 0.035, 0.035), 0.0, 0.9),
        # Glass and lenses came in at roughness ~0.72, which reads as milky.
        # Two 30%-opaque grey-green layers washed the dark cabin out; real
        # glass is near clear (the app's tint slider darkens from here).
        'NB_windowglass': ((0.03, 0.045, 0.045), 0.0, 0.05, 0.14),
        'NB_clearglass': (None, 0.0, 0.05),
        'NB_redglass': (None, 0.0, 0.1),
        'NB_orangeglass': (None, 0.0, 0.1),
    },
    'nc': {
        'NC_wheel_tire': ((0.02, 0.02, 0.02), 0.0, 0.85),
        'NC_clearglass': (None, 0.0, 0.05),
    },
}


def base_name(material):
    return material.name.split('.')[0]


def prepare(gen, root):
    cfg = CFG[gen]
    coll = bpy.data.collections.get(f'{gen.upper()}_SRC') or bpy.data.collections.new(f'{gen.upper()}_SRC')
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    for o in [root] + list(root.children_recursive):
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)

    # 1. World-space meshes, upright.
    for o in [o for o in coll.objects if o.type == 'MESH']:
        if o.data.users > 1:
            o.data = o.data.copy()
        o.data.transform(cfg['upright'] @ o.matrix_world)
        o.parent = None
        o.matrix_world = mathutils.Matrix.Identity(4)
    for o in [o for o in coll.objects if o.type != 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)

    # 2. Plates.
    for o in list(coll.objects):
        if any(s.material and base_name(s.material).startswith(cfg['plates']) for s in o.material_slots):
            bpy.data.objects.remove(o, do_unlink=True)

    # 3. Wheel faces into per-wheel objects.
    def quadrant(c):
        if abs(c.x) < 0.45:
            return None
        for q, (wx, wy) in cfg['wheels'].items():
            if (wx > 0) == (c.x > 0) and math.hypot(c.y - wy, c.z - cfg['radius']) < cfg['radius'] + 0.02:
                return q
        return None

    for o in list(coll.objects):
        names = [base_name(s.material) if s.material else '' for s in o.material_slots]
        if not set(names) & set(cfg['wheel_mats']):
            continue
        groups = {}
        for p in o.data.polygons:
            role = cfg['wheel_mats'].get(names[p.material_index])
            q = role and quadrant(p.center)
            if q:
                groups.setdefault((q, role), set()).add(p.index)
        moved = set()
        for (q, role), keep in groups.items():
            moved |= keep
            part = o.copy()
            part.data = o.data.copy()
            coll.objects.link(part)
            bm = bmesh.new()
            bm.from_mesh(part.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
            bm.to_mesh(part.data)
            bm.free()
            name = f'{gen.upper()}_wheel_{role}'
            mat = bpy.data.materials.get(name)
            if mat is None:
                source = next(s.material for s in o.material_slots if s.material and cfg['wheel_mats'].get(base_name(s.material)) == role)
                mat = source.copy()
                mat.name = name
            part.data.materials.clear()
            part.data.materials.append(mat)
            for p in part.data.polygons:
                p.material_index = 0
            part.name = f'{name}_{q}'
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index in moved], context='FACES')
        bm.to_mesh(o.data)
        bm.free()
        if not o.data.polygons:
            bpy.data.objects.remove(o, do_unlink=True)

    # 4. Decimate by material; wheels untouched.
    for o in coll.objects:
        names = [base_name(s.material) for s in o.material_slots if s.material]
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        ratio = min((cfg['ratio'].get(n, 1.0) for n in names), default=1.0)
        if tris > 400 and ratio < 1.0 and not o.name.startswith(f'{gen.upper()}_wheel_'):
            mod = o.modifiers.new('Decimate', 'DECIMATE')
            mod.ratio = ratio
            mod.use_collapse_triangulate = True
            with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
                bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in o.data.polygons:
            p.use_smooth = True

    # 5. Materials, UVs, export.
    prefix = gen.upper() + '_'
    for o in coll.objects:
        for s in o.material_slots:
            m = s.material
            if m and not m.name.startswith(prefix):
                target = bpy.data.materials.get(prefix + base_name(m))
                if target is None:
                    m.name = prefix + base_name(m)
                    target = m
                s.material = target
        textured = any(s.material and s.material.node_tree and
                       any(n.type == 'TEX_IMAGE' for n in s.material.node_tree.nodes) for s in o.material_slots)
        if not textured:
            while o.data.uv_layers:
                o.data.uv_layers.remove(o.data.uv_layers[0])
    return export(gen)


def export(gen):
    """Apply MATERIAL_FIX and write the prepared collection to the app."""
    coll = bpy.data.collections[f'{gen.upper()}_SRC']
    for name, (colour, metallic, roughness, *alpha) in MATERIAL_FIX[gen].items():
        mat = bpy.data.materials.get(name)
        bsdf = mat and next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None:
            continue
        if colour is not None:
            bsdf.inputs['Base Color'].default_value = (*colour, 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
        if alpha:
            bsdf.inputs['Alpha'].default_value = alpha[0]
    out = f'{OUT}/mx5_{gen}'
    os.makedirs(out, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in coll.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = coll.objects[0]
    bpy.ops.export_scene.gltf(filepath=out + '/scene.glb', export_format='GLB', use_selection=True,
                              export_apply=True, export_animations=False, export_yup=True)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in coll.objects)
    return {'tris': tris, 'objects': len(coll.objects),
            'materials': sorted({s.material.name for o in coll.objects for s in o.material_slots if s.material}),
            'mb': round(os.path.getsize(out + '/scene.glb') / 1e6, 1)}
