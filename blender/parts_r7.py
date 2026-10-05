"""Round-seven parts: exterior bodywork and four more wheel faces.

Built on na_kit's helpers for whichever car `na_kit.use(gen)` points at,
except the wheels (authored on the ND front-left wheel and shared). Each
part follows a real accessory type; none copies a product or logo.
"""
import math
import bpy
from mathutils import Vector
import mx5_lib as m
import na_kit as k
import nd_extras as x
import parts_r5 as p5

SATIN, PAINT, CARBON = k.SATIN, k.PAINT, k.CARBON
ALLOY, CHROME, ACCENT, GLOSS = k.ALLOY, k.CHROME, k.ACCENT, k.GLOSS
MESH = 'MOD_Mesh'
UP = Vector((0, 1, 0))


def name(ident, part):
    return x.name(ident, part)


CFG = {
    'nd': {
        'bonnet': 'Hood 6.001_120',
        # NACA ducts: centre x either side, front z, length.
        'naca': (380.0, 1360.0, 300.0),
    },
    'na': {
        'bonnet': 'hood_Material #71_0',
        'naca': (360.0, 1420.0, 300.0),
        # Dive planes: bumper, leading z, span, root height.
        'dive': ('frontbumper_Material #71_0', 1840.0, 150.0, 372.0),
        # Rear spats: bumper, leading z, span, height.
        'spats': ('rearbumper_Material #71_0', -1515.0, 150.0, 252.0),
        # Brake ducts: bumper, x either side, height, radius.
        'ducts': ('frontbumper_Material #71_0', 560.0, 300.0, 38.0),
    },
    'nb': {'bonnet': 'Object_47.001', 'naca': (330.0, 1400.0, 300.0)},
    'nc': {'bonnet': 'NC_BONNET', 'naca': (360.0, 1450.0, 300.0)},
}


def cfg():
    return CFG[k.GEN]


# -------------------------------------------------------------- NACA ducts ----

def naca_ducts(ident='DT72'):
    """Twin NACA ducts on the bonnet, either side of the stripes' path.

    Each is a dark recess film in the classic NACA planform (narrow mouth,
    curved flanks widening rearward), with a raised carbon surround and a
    carbon lip across its rear edge.
    """
    coll = m.start_mod(k.GEN, ident)
    panel = k.base(cfg()['bonnet'])
    half, z_front, length = cfg()['naca']

    def half_width(t):
        # NACA submerged-inlet planform: slow start, flaring to full width.
        return 26 + 74 * (t ** 1.8)

    def on(xx, z):
        hit, nrm = k.ray_normal(panel, (xx, 2000, z), (0, -1, 0))
        assert hit is not None, (xx, z)
        return hit, x.outward(nrm, UP)

    for side in (1, -1):
        tag = 'L' if side > 0 else 'R'
        xc = k.CX + side * half
        recess, surround = [], []
        for i in range(25):
            t = i / 24
            z = z_front - length * t
            hw = half_width(t)
            recess.append([on(xc - hw + 2 * hw * j / 6, z) for j in range(7)])
        x.film(name(ident, f'recess_{tag}'), coll, recess, 0.5, 0.5, SATIN)
        for flank in (-1, 1):
            rows = []
            for i in range(25):
                t = i / 24
                z = z_front - length * t
                hw = half_width(t)
                xs = (xc + flank * hw, xc + flank * (hw + 12))
                row = [on(xs[0] + (xs[1] - xs[0]) * j / 2, z) for j in range(3)]
                rows.append(row if flank > 0 else list(reversed(row)))
            x.film(name(ident, f'surround_{tag}{"o" if flank * side > 0 else "i"}'), coll, rows, 0.5, 2.5, CARBON)
        # Rear lip: a raised carbon edge across the wide end.
        z = z_front - length
        hw = half_width(1.0) + 12
        lip = []
        for j in range(13):
            xx = xc - hw + 2 * hw * j / 12
            hit, nrm = on(xx, z)
            lip.append([(hit, nrm), (on(xx, z - 14)[0], nrm)])
        rows = [[lip[j][0], lip[j][1]] for j in range(13)]
        x.film(name(ident, f'lip_{tag}'), coll, rows, 0.5, 7.0, CARBON)
    return k.finish(coll)


# --------------------------------------------------------- NA dive planes ----

def dive_planes(ident='FA45'):
    """A carbon dive plane on each front bumper corner, following its curve
    and kicking up toward the front, as on track NAs."""
    coll = m.start_mod(k.GEN, ident)
    part, z_lead, span, y_root = cfg()['dive']
    bumper = k.base(part)
    for side in (1, -1):
        rings = []
        for i in range(25):
            t = i / 24
            z = z_lead - span * t
            y = y_root - 16 * t
            hit, nrm = k.ray_normal(bumper, (k.CX + side * 1300, y, z), (-side, 0, 0))
            assert hit is not None, (side, z)
            n = x.outward(Vector((nrm.x, 0, nrm.z)).normalized(), Vector((side, 0, 0)))
            width = 5 + 72 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7
            rise = 12 * (1 - t)
            root, tip = hit - n * 1.5, hit + n * width
            rings.append([(root.x, y + 6, root.z), (tip.x, y + rise + 2, tip.z),
                          (tip.x, y + rise - 2.5, tip.z), (root.x, y - 4, root.z)])
        k.mesh_object(name(ident, f'plane_{"L" if side > 0 else "R"}'), rings, coll, CARBON)
    return k.finish(coll)


# ------------------------------------------------------------ NA rear spats ----

def rear_spats(ident='RA50'):
    """Carbon spats along the rear bumper's lower flanks, behind the rear
    wheels: thin blades standing up to 50 mm proud, tapering at both ends."""
    coll = m.start_mod(k.GEN, ident)
    part, z_lead, span, y = cfg()['spats']
    bumper = k.base(part)
    for side in (1, -1):
        rings = []
        for i in range(25):
            t = i / 24
            z = z_lead - span * t
            hit, nrm = k.ray_normal(bumper, (k.CX + side * 1300, y, z), (-side, 0, 0))
            assert hit is not None, (side, z)
            n = x.outward(Vector((nrm.x, 0, nrm.z)).normalized(), Vector((side, 0, 0)))
            width = 4 + 46 * math.sin(math.pi * t) ** 0.6
            root, tip = hit - n * 1.5, hit + n * width
            rings.append([(root.x, y + 5, root.z), (tip.x, y + 2, tip.z), (tip.x, y - 2, tip.z),
                          (root.x, y - 5, root.z)])
        k.mesh_object(name(ident, f'spat_{"L" if side > 0 else "R"}'), rings, coll, CARBON)
    return k.finish(coll)


# ----------------------------------------------------------- NA brake ducts ----

def brake_ducts(ident='DT73'):
    """Round brake-cooling inlets in the front bumper's lower corners: a
    raised carbon trim ring round a black mesh disc, both laid on the
    curved bumper face point by point (along its normal at the centre)."""
    coll = m.start_mod(k.GEN, ident)
    part, half, y, radius = cfg()['ducts']
    bumper = k.base(part)
    for side in (1, -1):
        tag = 'L' if side > 0 else 'R'
        xc = k.CX + side * half
        hit, nrm = k.ray_normal(bumper, (xc, y, 3000), (0, 0, -1))
        assert hit is not None, tag
        n = x.outward(nrm, Vector((0, 0, 1)))
        u = Vector((1, 0, 0)) - n * n.x
        u.normalize()
        v = n.cross(u).normalized()

        def on(du, dv):
            q = hit + u * du + v * dv
            p, nn = k.ray_normal(bumper, tuple(q + n * 80), tuple(-n))
            assert p is not None, (tag, du, dv)
            return p, x.outward(nn, n)

        # Mesh disc: a square grid mapped onto the disc so the slab is closed.
        rows = []
        for i in range(13):
            a_ = -1 + 2 * i / 12
            rows.append([on(radius * a_ * math.sqrt(max(0.0, 1 - b_ * b_ / 2)),
                            radius * b_ * math.sqrt(max(0.0, 1 - a_ * a_ / 2)))
                         for b_ in (-1 + 2 * j / 12 for j in range(13))])
        x.film(name(ident, f'mesh_{tag}'), coll, rows, 0.6, 0.6, MESH)
        # Trim ring: rows round the circle, each across the ring's width.
        ring = []
        for i in range(49):
            t = 2 * math.pi * i / 48
            ring.append([on(r_ * math.cos(t), r_ * math.sin(t)) for r_ in (radius - 3, radius + 4, radius + 11)])
        x.film(name(ident, f'ring_{tag}'), coll, ring, 0.6, 4.0, CARBON)
    return k.finish(coll)


# ------------------------------------------------------------------- wheels ----

def _wheel_base(ident):
    import nd_wheel_refinement as w
    stale = bpy.data.collections.get(f'MOD_ND_{ident}')
    if stale is not None:
        for obj in list(stale.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(stale)
    coll = w.build('W07')
    for obj in list(coll.objects):
        if '_spoke_' in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)
    coll.name = f'MOD_ND_{ident}'
    for obj in coll.objects:
        obj.name = obj.name.replace('MOD_ND_W07_', f'MOD_ND_{ident}_')
    k.use('nd')
    return coll, w.AXLE


def _spokes(coll, axle, count, r0, r1, width_fn, x_fn, prefix='spoke', branch=None):
    import nd_street_kit as sk
    for i in range(count):
        a_base = 2 * math.pi * i / count
        rings = []
        for j in range(21):
            t = j / 20
            r = r0 + (r1 - r0) * t
            a = a_base + (branch(t) if branch else 0.0)
            width = width_fn(t)
            xx = x_fn(t)
            section = [(-15, -width / 2 + 3), (-12, -width / 2), (-3, -width / 2), (0, -width / 2 + 3),
                       (0, width / 2 - 3), (-3, width / 2), (-12, width / 2), (-15, width / 2 - 3)]
            rings.append([(axle[0] + xx + dx, axle[1] + r * math.cos(a) - s * math.sin(a),
                           axle[2] + r * math.sin(a) + s * math.cos(a)) for dx, s in section])
        sk.mesh_object(f'{prefix}_{i}', rings, coll, 'MOD_Rim')


def wheel(ident):
    """W16 classic five-spoke; W17 ten-spoke forged; W18 steel wheel with
    oval vents and a chrome cap; W19 three-piece multi-spoke with a wide
    polished lip and a ring of assembly bolts."""
    import nd_detail_kit as d
    coll, axle = _wheel_base(ident)

    def face_x(r, depth=44):
        return 44 + depth * max(0.0, (r - 63) / 184) ** 1.65

    lip = [(96, 250), (99, 253), (99, 256), (96, 258), (94, 256), (94, 251)]
    if ident == 'W16':
        _spokes(coll, axle, 5, 61, 249, lambda t: 64 - 18 * t + 30 * max(0.0, (t - 0.85) / 0.15) ** 2,
                lambda t: face_x(61 + 188 * t))
        d.lathe('polished_lip', coll, lip, axle, 'MOD_Chrome', 'x', 80)
    elif ident == 'W17':
        _spokes(coll, axle, 10, 61, 249, lambda t: 22 - 5 * t + 14 * max(0.0, (t - 0.88) / 0.12) ** 2,
                lambda t: 30 + 58 * t ** 1.4)
        d.lathe('centre_ring', coll, [(29, 64), (45, 64), (47, 92), (31, 92)], axle, 'MOD_Rim', 'x', 64)
    elif ident == 'W18':
        prof = [(52, 66), (56, 66), (58, 108), (72, 118), (74, 150), (82, 236), (90, 250),
                (84, 250), (76, 236), (68, 150), (66, 118), (52, 108)]
        disc = d.lathe('steel_disc', coll, prof, axle, 'MOD_Rim', 'x', 72)
        cutters = []
        for i in range(6):
            a0 = 2 * math.pi * i / 6 + math.pi / 6
            rings = []
            for j in range(17):
                t = j / 16
                a = a0 - 0.21 + 0.42 * t
                rr = 30 * math.sin(math.pi * t) ** 0.5 + 1
                ring = []
                for xx in (20.0, 140.0):
                    for s in (-1, 1):
                        r = 188 + s * rr
                        ring.append((axle[0] + xx, axle[1] + r * math.cos(a), axle[2] + r * math.sin(a)))
                rings.append([ring[0], ring[1], ring[3], ring[2]])
            cutters.append(k.mesh_object(f'_cut_{i}', rings, coll, 'MOD_Rim'))
        for c in cutters:
            m.boolean(disc, c)
        for c in cutters:
            bpy.data.objects.remove(c, do_unlink=True)
        d.lathe('chrome_cap', coll, [(58, 0), (58, 60), (66, 58), (74, 46), (78, 24), (79, 0)],
                axle, 'MOD_Chrome', 'x', 48)
    else:
        _spokes(coll, axle, 20, 72, 216, lambda t: 13 - 2 * t, lambda t: 40 + 26 * t)
        d.lathe('centre_ring', coll, [(39, 64), (53, 64), (55, 84), (41, 84)], axle, 'MOD_Rim', 'x', 64)
        d.lathe('wide_lip', coll, [(64, 212), (70, 212), (97, 222), (99, 253), (96, 258), (92, 252), (66, 222)],
                axle, 'MOD_Chrome', 'x', 80)
        for i in range(32):
            a = 2 * math.pi * i / 32
            d.lathe(f'bolt_{i}', coll, [(95, 0), (95, 4), (99, 4), (100, 2.5), (100, 0)],
                    (axle[0], axle[1] + 226 * math.cos(a), axle[2] + 226 * math.sin(a)), 'MOD_Chrome', 'x', 8)
    angle = .55
    d.lathe('valve', coll, [(0, 0), (0, 4), (15, 4), (17, 3), (17, 0)],
            (axle[0] + 83, axle[1] + 230 * math.cos(angle), axle[2] + 230 * math.sin(angle)), d.SATIN, 'x', 12)
    return d.finish(coll)
