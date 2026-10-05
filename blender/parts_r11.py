"""Round eleven: Zunsport-style woven diamond grille mesh for all four cars.

Zunsport's kits are woven stainless mesh, black or bare, cut to each opening
and fitted just inside it. Here each opening is traced by ray-casting the
front bumper from ahead, row by row, and filled with a thin slab carrying an
alpha-masked diamond weave (14 x 7 mm cells), set back from the bumper's lip
and always in front of whatever already sits in the opening (the ND's bars,
the stock inserts), so nothing pokes through.

Built on na_kit's helpers for whichever car `na_kit.use(gen)` points at.
"""
import json
import math
import struct
import bpy
from mathutils import Vector
import mx5_lib as m
import na_kit as k
import nd_extras as x
import parts_r10 as p10

MESH = 'MOD_Mesh'

#: Car collections the openings' contents are read from.
CAR_COLLECTIONS = {'nd': 'ND_REF', 'na': 'NA_REF', 'nb': 'NB_SRC', 'nc': 'NC_SRC'}

#: Openings per car: (label, seed x, y bottom, y top, half-width of search).
#: Measured from front-on ray maps of each bumper (app mm).
OPENINGS = {
    'nd': [('mouth', 0.0, 236.0, 436.0, 520.0),
           ('lower_L', 650.0, 282.0, 388.0, 110.0), ('lower_R', -650.0, 282.0, 388.0, 110.0)],
    'na': [('mouth', -8.5, 282.0, 424.0, 460.0)],
    'nb': [('mouth', 0.0, 266.0, 392.0, 440.0)],
    'nc': [('mouth', 0.0, 346.0, 486.0, 470.0)],
}

#: The bumper skin the openings are cut in, where it differs from the
#: wide-body front bumper set: the ND's set includes the grille frame and
#: its bars, which sit inside the mouth and are cleared, not traced.
OPENING_PARTS = {'nd': ('BumperF 6.003_111',)}

#: Weave cell (mm) and finishes: (label, base RGB at the strand crown,
#: metallic, roughness).
CELL = 14.0
FINISHES = {
    'black': ((0.035, 0.036, 0.04), 0.35, 0.5),
    'stainless': ((0.62, 0.63, 0.65), 1.0, 0.32),
}


def weave_material(finish):
    """A MOD_Mesh variant with an embedded alpha-masked diamond weave.

    Named MOD_Mesh.9NN so it is still the MOD_Mesh contract material (the app
    and validator drop a .NNN suffix) without touching the plain one other
    mods share.
    """
    import numpy as np
    label = f'{MESH}.{901 + list(FINISHES).index(finish)}'
    mat = bpy.data.materials.get(label)
    if mat is not None:
        return mat
    rgb, metallic, roughness = FINISHES[finish]
    mat = bpy.data.materials.new(label)
    mat.use_nodes = True
    mat.use_backface_culling = False
    mat.diffuse_color = (*rgb, 1)
    try:
        mat.blend_method = 'CLIP'       # viewport/Workbench cut-out only
    except (AttributeError, TypeError):
        pass
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    # One tile is CELL x CELL mm: one diamond across, two up (14 x 7 cells).
    size = 128
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    a, b = (xx + 0.5) / size, ((yy + 0.5) / size) * 2.0
    s1 = np.abs(np.mod(a + b, 1.0) - 0.5)       # one strand family
    s2 = np.abs(np.mod(a - b, 1.0) - 0.5)       # the other
    half = 0.085
    d = np.minimum(s1, s2)
    strand = d < half
    # Crown across each wire, and over/under: each family is brighter where
    # it passes over the other.
    crown = np.sqrt(np.clip(1 - (d / half) ** 2, 0, 1))
    over = np.where(s1 < s2, 0.5 + 0.5 * np.cos(np.pi * (a - b) * 2), 0.5 + 0.5 * np.cos(np.pi * (a + b) * 2))
    level = (0.45 + 0.4 * crown) * (0.8 + 0.2 * over)
    rgba = np.dstack([level * rgb[0] / 0.85, level * rgb[1] / 0.85, level * rgb[2] / 0.85,
                      strand.astype(float)])
    image = bpy.data.images.new(f'Zun_Weave_{finish}', width=size, height=size, alpha=True)
    image.pixels.foreach_set(np.clip(rgba, 0, 1).astype('float32').ravel())
    image.pack()
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    return mat


def mask_alpha(path, cutoff=0.3):
    """Set every MOD_Mesh.9NN material in an exported .glb to alpha MASK.

    The exporter's alpha-mode guess varies by Blender version; a cut-out
    weave must be MASK (no sorting, casts proper shadows), so set it here.
    The wires cover about 30% of a tile, which is what distant mip levels
    average to: a 0.3 cutoff keeps the mesh reading as dark mesh far off
    (as fine mesh does) instead of vanishing.
    """
    data = bytearray(open(path, 'rb').read())
    json_len = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    for mat in doc.get('materials', []):
        if mat.get('name', '').startswith(MESH + '.9'):
            mat['alphaMode'] = 'MASK'
            mat['alphaCutoff'] = cutoff
            mat['doubleSided'] = True
    blob = json.dumps(doc, separators=(',', ':')).encode()
    blob += b' ' * (-len(blob) % 4)
    rest = data[20 + json_len:]
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(blob) + len(rest))
    out += struct.pack('<I4s', len(blob), b'JSON') + blob + rest
    open(path, 'wb').write(out)


def opening_contents(parts):
    """Car meshes (not the bumper) that sit inside any opening, found by a
    coarse grid of rays: the only objects worth testing per row."""
    found = set()
    skip = {p.name for p in parts}
    coll = bpy.data.collections[CAR_COLLECTIONS[k.GEN]]
    meshes = [o for o in coll.all_objects if o.type == 'MESH' and o.name not in skip]
    for _, sx, y0, y1, hw in OPENINGS[k.GEN]:
        for fy in (0.25, 0.5, 0.75):
            for fx in (-0.6, -0.3, 0.0, 0.3, 0.6):
                origin = (k.CX + sx + fx * hw, y0 + (y1 - y0) * fy, 3500)
                for o in meshes:
                    try:
                        if k.ray(o, origin, (0, 0, -1)) is not None:
                            found.add(o)
                    except Exception:     # objects with no evaluated mesh
                        continue
    return list(found)


def trace(parts, seed_x, y0, y1, hw):
    """Rows of (y, x0, x1) for the bumper opening around seed_x, tracking
    the opening's centre row to row (the ND's lower grilles slant)."""
    def miss(xx, y):
        return x.hit_any(parts, (xx, y, 3500), (0, 0, -1))[0] is None

    def run(cx, y):
        if not miss(cx, y):
            # Seed landed on a bar of bumper: look for the nearest gap.
            cand = [cx + s * dx for dx in range(4, int(hw * 0.6), 4) for s in (-1, 1)]
            cx = next((c for c in cand if miss(c, y)), None)
            if cx is None:
                return None
        lo = hi = cx
        while miss(lo - 2, y):
            lo -= 2
            if lo < cx - hw:
                return None           # not bounded: below/beside the bumper
        while miss(hi + 2, y):
            hi += 2
            if hi > cx + hw:
                return None
        return lo, hi

    rows = {}
    mid = 0.5 * (y0 + y1)
    for direction in (1, -1):
        cx = k.CX + seed_x
        y = mid
        while y0 <= y <= y1:
            r = run(cx, y)
            if r is not None and r[1] - r[0] > 24:
                rows[y] = r
                cx = 0.5 * (r[0] + r[1])
            elif rows:
                break
            y += 4 * direction
    return [(y, *rows[y]) for y in sorted(rows)]


def grille(ident, finish='black', recess=8.0, gap=3.0):
    coll = m.start_mod(k.GEN, ident)
    parts = [k.base(n) for n in OPENING_PARTS.get(k.GEN, p10.CFG[k.GEN]['front_bumper'])]
    inside = opening_contents(parts)
    material = weave_material(finish)
    for label, sx, y0, y1, hw in OPENINGS[k.GEN]:
        rows = trace(parts, sx, y0, y1, hw)
        assert len(rows) > 6, (label, len(rows))
        # Trim a hair off the top and bottom rows and the ends, so the slab
        # never touches the bumper's edge.
        rows = rows[1:-1]
        ys = [r[0] for r in rows]
        x0s = k.gaussian([r[1] + 1.5 for r in rows], 1.0)
        x1s = k.gaussian([r[2] - 1.5 for r in rows], 1.0)

        def front_z(xx, y):
            p = x.hit_any(parts, (xx, y, 3500), (0, 0, -1))[0]
            return None if p is None else p.z

        # The bumper's plan curve across the opening, from the lips just
        # above and below it, so the mesh stays parallel to the bumper
        # instead of standing proud of it at the ends of a curved mouth.
        lo_x, hi_x = min(x0s), max(x1s)
        plan_x = [lo_x + (hi_x - lo_x) * j / 16 for j in range(17)]
        plan_z = []
        for xx in plan_x:
            hits = [z for z in (next((front_z(xx, yy) for yy in range(int(ys[-1]) + 4, int(ys[-1]) + 60, 4)
                                      if front_z(xx, yy) is not None), None),
                                next((front_z(xx, yy) for yy in range(int(ys[0]) - 4, int(ys[0]) - 60, -4)
                                      if front_z(xx, yy) is not None), None)) if z is not None]
            plan_z.append(sum(hits) / len(hits) if hits else None)
        known = [(xx, z) for xx, z in zip(plan_x, plan_z) if z is not None]
        if len(known) < 2:
            # Narrow slots: fall back to the side lips.
            known = []
            for y, a, b in zip(ys, x0s, x1s):
                for xx in (a - 6, b + 6):
                    z = front_z(xx, y)
                    if z is not None:
                        known.append((xx, z))
            known.sort()
            mean = sum(z for _, z in known) / len(known)
            known = [(known[0][0], mean), (known[-1][0], mean)]

        def plan(xx):
            if xx <= known[0][0]:
                return known[0][1]
            for (xa, za), (xb, zb) in zip(known, known[1:]):
                if xx <= xb:
                    return za + (zb - za) * (xx - xa) / max(xb - xa, 1e-6)
            return known[-1][1]

        # Per row, how far the mesh must come forward of plan - recess to
        # clear whatever already sits in the opening.
        need = []
        for y, a, b in zip(ys, x0s, x1s):
            off = 0.0
            for j in range(13):
                xx = a + (b - a) * j / 12
                for o in inside:
                    try:
                        p = k.ray(o, (xx, y, 3500), (0, 0, -1))
                    except Exception:
                        continue
                    if p is not None:
                        off = max(off, p.z + gap - (plan(xx) - recess))
            need.append(off)
        # Bars are thin: spread each row's need over its neighbours before
        # smoothing, and never fall below what a row needs.
        spread = [max(need[max(0, i - 4):i + 5]) for i in range(len(need))]
        offs = [max(s_, n_) for s_, n_ in zip(k.gaussian(spread, 2.0), need)]
        cols = 20
        rings, pts = [], []
        for i, (y, a, b, off) in enumerate(zip(ys, x0s, x1s, offs)):
            if i % 2 and i != len(ys) - 1:
                continue                # 8 mm rows are plenty under a texture
            front = [(xx, y, plan(xx) - recess + off) for xx in (a + (b - a) * j / cols for j in range(cols + 1))]
            back = [(px, py, pz - 1.0) for px, py, pz in reversed(front)]
            rings.append(front + back)
            pts.extend(front + back)
        obj = k.mesh_object(x.name(ident, label), rings, coll, MESH)
        obj.data.materials[0] = material
        # World-scale planar UVs so the weave is the same size everywhere.
        uv = obj.data.uv_layers.active.data
        for loop in obj.data.loops:
            px, py, _ = pts[loop.vertex_index]
            uv[loop.index].uv = (px / CELL, py / CELL)
    return k.finish(coll)
