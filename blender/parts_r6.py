"""Round-six parts: harnesses, pinstripes, bonnet wrap, skid plate, mud
flaps for the NA, and two more wheel faces.

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
import parts_r4 as p4

SATIN, PAINT, CARBON = k.SATIN, k.PAINT, k.CARBON
ALLOY, CHROME, ACCENT, GLOSS = k.ALLOY, k.CHROME, k.ACCENT, k.GLOSS
RUBBER = 'MOD_Rubber'
WHITE = 'MOD_StripeWhite'
UP = Vector((0, 1, 0))


def name(ident, part):
    return x.name(ident, part)


#: Per-car positions measured from the references.
CFG = {
    'nd': {
        'bonnet': 'Hood 6.001_120',
        # Skid plate: bumper parts, plate height (below the lips), lowest
        # bumper edge (y, z).
        'skid': (('BumperF 6.003_111', 'BumperF 6.002_110', 'BumperF 6.001_109'), 136.0, (172.0, 1881.0)),
        # Between the side-marker garnish behind the front arch (about
        # y 560) and the shoulder crease at y 640.
        'pinstripe_y': 590.0,
    },
    'na': {
        'bonnet': 'hood_Material #71_0',
        'skid': (('frontbumper_Material #71_0',), 202.0, (232.0, 1865.0)),
        # Above the side-marker hole in the front fender (y 520-555).
        'pinstripe_y': 585.0,
        # Mud flaps: z behind the front and rear wheels.
        'flaps': (791.0, -1500.0),
    },
    'nb': {
        'bonnet': 'Object_47.001',
        'skid': (('Object_49',), 200.0, (216.0, 1918.0)),
        'pinstripe_y': 600.0,
        'flaps': (798.0, -1495.0),
    },
    'nc': {
        'bonnet': 'NC_BONNET',
        'skid': (('NC_FRONT',), 212.0, (228.0, 1760.0)),
        'pinstripe_y': 620.0,
        'flaps': (850.0, -1470.0),
    },
}


def cfg():
    return CFG[k.GEN]


# ----------------------------------------------------------------- harnesses ----

def harnesses(ident='HN01'):
    """Four-point harnesses in the accent colour, for the carbon buckets.

    Shoulder straps come through BS01's harness slots and run down the
    seat's pad to a cam-lock buckle in the lap; lap straps come up from the
    side mounts. Geometry follows BS01's own layout (parts_r4.bucket_seats),
    so the catalogue entry requires BS01.
    """
    coll = m.start_mod(k.GEN, ident)
    xs, floor, front, back, top = p4.cab()['seats']
    recline = 14.0
    tan = math.tan(math.radians(recline))
    hip_y = floor + 95
    y_mid = (hip_y + top) / 2
    pad_front = back + 52 - (y_mid - hip_y) * tan + 4 + 5
    slot_y = top - 130
    for xc in xs:
        tag = 'L' if xc > 0 else 'R'
        buckle = Vector((xc, hip_y + 48, back + 205))
        for dx in (-75.0, 75.0):
            t2 = 'a' if dx < 0 else 'b'
            shell = back + 40 - (slot_y - hip_y) * tan
            p0 = Vector((xc + dx, slot_y + 8, shell + 6))
            p1 = Vector((xc + dx * 0.8, hip_y + 330, pad_front + 4))
            p2 = buckle + Vector((dx * 0.25, 22, -8))
            normal = Vector((0, 0.25, 1)).normalized()
            p4.bar(name(ident, f'shoulder_{tag}{t2}0'), coll, tuple(p0), tuple(p1), 48, 2.5, normal, ACCENT)
            p4.bar(name(ident, f'shoulder_{tag}{t2}1'), coll, tuple(p1), tuple(p2), 48, 2.5,
                   Vector((0, 0.6, 1)).normalized(), ACCENT)
            # Adjuster on each shoulder strap.
            k.box(f'adjuster_{tag}{t2}', coll, tuple(p1.lerp(p2, 0.35) + Vector((0, 0, 3))), (54, 18, 6), ALLOY, 1)
            # Lap strap from the side mount up over the bolster to the buckle.
            mount = Vector((xc + dx * 2.9, hip_y + 10, back + 150))
            p4.bar(name(ident, f'lap_{tag}{t2}'), coll, tuple(mount), tuple(buckle + Vector((dx * 0.3, 0, 0))), 48, 2.5,
                   UP, ACCENT)
        p4.ring_loft(name(ident, f'buckle_{tag}'), coll, buckle + Vector((0, 4, 0)), Vector((1, 0, 0)), Vector((0, 0, 1)),
                     Vector((0, 1, 0)), [(-6, 1.5), (-6, 34), (6, 34), (8, 28), (8, 1.5)], ALLOY, 32)
    return k.finish(coll)


# -------------------------------------------------------------- pinstripes ----

def pinstripes(ident='DT66', material=WHITE):
    """Twin 6 mm coachline pinstripes along each flank, 8 mm apart, between
    the arches: the classic hand-painted coachline, laid like DT44."""
    coll = m.start_mod(k.GEN, ident)
    z0, z1 = x.cfg()['side_z']
    yb = cfg()['pinstripe_y']
    for side, names in x.cfg()['side_panels'].items():
        parts = [k.base(n) for n in names]
        axis = Vector((side, 0, 0))
        for line, y0 in enumerate((yb, yb + 14)):
            rows = []
            for i in range(121):
                z = z0 - (z0 - z1) * i / 120
                row = []
                for j in range(3):
                    y = y0 + 6 * j / 2
                    hit, nrm = None, None
                    for dz in (0, 2, -2, 4, -4, 6, -6, 9, -9):
                        hit, nrm = x.hit_any(parts, (k.CX + side * 1300, y, z + dz), (-side, 0, 0))
                        if hit is not None:
                            hit = Vector((hit.x, hit.y, z))
                            break
                    assert hit is not None, (side, y, z)
                    row.append((hit, x.outward(nrm, axis)))
                rows.append(row if side > 0 else list(reversed(row)))
            x.film(name(ident, f'line{line}_{"L" if side > 0 else "R"}'), coll, rows, 0.6, 0.4, material)
    return k.finish(coll)


# ------------------------------------------------------------- bonnet wrap ----

def bonnet_wrap(ident='DT67', material=SATIN):
    """A satin black vinyl wrap over the whole bonnet, inset 8 mm from its
    edges, 0.8 mm clear so the panel's tight curves can't poke through
    between samples. Stripes would sit under it, so the catalogue makes it
    exclusive with them."""
    coll = m.start_mod(k.GEN, ident)
    panel = k.base(cfg()['bonnet'])
    zs = [z for z in range(-2000, 2400, 4) if k.ray(panel, (k.CX, 2000, z), (0, -1, 0))]
    z_front, z_back = max(zs) - 8, min(zs) + 8
    rows = []
    for i in range(73):
        z = z_front - (z_front - z_back) * i / 72
        hits = {xx for xx in range(-900, 901, 3) if k.ray(panel, (k.CX + xx, 2000, z), (0, -1, 0))}
        if 0 not in hits:
            continue
        # The run of hits either side of the centreline: the NA bonnet is
        # notched round its pop-up headlights, and a row must not span them.
        xa = xb = 0
        while xa - 3 in hits:
            xa -= 3
        while xb + 3 in hits:
            xb += 3
        xa, xb = xa + 8, xb - 8
        row = []
        for j in range(61):
            xx = k.CX + xa + (xb - xa) * j / 60
            hit = None
            # Bridge small gaps in the panel mesh by stepping along the car.
            for dz in (0, 3, -3, 6, -6, 10, -10):
                hit, nrm = k.ray_normal(panel, (xx, 2000, z + dz), (0, -1, 0))
                if hit is not None:
                    hit = Vector((hit.x, hit.y, z))
                    break
            if hit is None:
                break
            row.append((hit, x.outward(nrm, UP)))
        if len(row) == 61:
            rows.append(row)
    x.film(name(ident, 'wrap'), coll, rows, 0.8, 0.3, material)
    return k.finish(coll)


# -------------------------------------------------------------- skid plate ----

def skid_plate(ident='SP01'):
    """A 3 mm alloy skid plate under the nose, below any front lip, with a
    rolled front edge and four brackets up to the bumper's lower edge, as
    on gravel and rally builds."""
    coll = m.start_mod(k.GEN, ident)
    parts, y, (edge_y, edge_z) = cfg()['skid']
    parts = [k.base(n) for n in parts]
    z_front = edge_z - 25
    z_back = z_front - 480
    rings = []
    for i in range(25):
        t = i / 24
        z = z_front - (z_front - z_back) * t
        half = 320 - 60 * t
        # Rolled front: the leading 40 mm curls up 14 mm.
        curl = 14 * max(0.0, 1 - (z_front - z) / 40) ** 2
        rings.append([(k.CX - half, y + curl, z), (k.CX + half, y + curl, z),
                      (k.CX + half, y + curl + 3, z), (k.CX - half, y + curl + 3, z)])
    k.mesh_object(name(ident, 'plate'), rings, coll, ALLOY)
    for dx in (-240.0, 240.0):
        tag = 'L' if dx > 0 else 'R'
        top, _ = x.hit_any(parts, (k.CX + dx, edge_y + 6, 3000), (0, 0, -1))
        zt = top.z - 30 if top is not None else z_front - 30
        k.tube(f'bracket_front_{tag}', coll, [(k.CX + dx, y + 2, zt), (k.CX + dx, edge_y + 10, zt)], 7, SATIN, 10)
        k.tube(f'bracket_rear_{tag}', coll, [(k.CX + dx * 0.8, y + 2, z_back + 40),
                                              (k.CX + dx * 0.8, y + 90, z_back + 40)], 7, SATIN, 10)
        for end, zz, scale in (('front', zt, 1.0), ('rear', z_back + 40, 0.8)):
            k.cylinder(f'bolt_{end}_{tag}', coll, (k.CX + dx * scale, y - 2, zz), 'y', 8, 4, CHROME, 10)
    return k.finish(coll)


# ----------------------------------------------------------- NA mud flaps ----

def mud_flaps(ident='DT30'):
    """Rubber rally flaps behind all four wheels, hung from the body's lower
    edge with two alloy fasteners each (the NA version of the ND's DT30)."""
    coll = m.start_mod(k.GEN, ident)
    for z in cfg()['flaps']:
        for side in (-1, 1):
            parts = [k.base(n) for n in x.cfg()['body'][side]]
            hit = None
            for y in range(350, 165, -5):
                hit, _ = x.hit_any(parts, (k.CX + side * 1300, y, z), (-side, 0, 0))
                if hit is not None:
                    break
            assert hit is not None, (side, z)
            outer = abs(hit.x - k.CX) + 20
            outline = [(outer - 125, hit.y + 15), (outer - 12, hit.y + 24), (outer + 3, hit.y - 7), (outer + 3, 118),
                       (outer - 8, 105), (outer - 119, 110), (outer - 125, 128)]
            tag = f'{"F" if z > 0 else "R"}{"L" if side > 0 else "R"}'
            rings = [[(k.CX + side * xx, yy, z + dz) for xx, yy in outline] for dz in (-2, 2)]
            if side < 0:
                rings = [list(reversed(r)) for r in rings]
            k.mesh_object(name(ident, f'flap_{tag}'), rings, coll, RUBBER)
            for xx in (outer - 100, outer - 30):
                k.cylinder(f'fastener_{tag}_{int(xx)}', coll, (k.CX + side * xx, hit.y, z - 6), 'z', 5, 4, ALLOY, 12)
    return k.finish(coll)


# ------------------------------------------------------------------- wheels ----

def wheel(ident):
    """W14 turbofan: a flat disc with twenty curved blade slots round its
    edge, after the period turbofan race wheels. W15 deep-dish six: six
    straight spokes recessed behind a wide polished lip and dish wall."""
    import nd_wheel_refinement as w
    import nd_street_kit as sk
    import nd_detail_kit as d
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
    axle = w.AXLE
    k.use('nd')

    def face_x(r):
        return 44 + 44 * max(0.0, (r - 63) / 184) ** 1.65

    if ident == 'W14':
        front = [(face_x(r), r) for r in range(66, 248, 6)]
        prof = front + [(px - 12, r) for px, r in reversed(front)]
        disc = d.lathe('disc_face', coll, prof, axle, 'MOD_Rim', 'x', 60)
        cutters = []
        for i in range(20):
            a0 = 2 * math.pi * i / 20
            rings = []
            for j in range(6):
                t = j / 5
                r = 150 + 82 * t
                a = a0 + 0.38 * t          # each slot sweeps round like a fan blade
                hw = 0.035 + 0.02 * t      # half-width in radians, opening outward
                ring = []
                for xx in (-60.0, 160.0):
                    for s in (-1, 1):
                        aa = a + s * hw
                        ring.append((axle[0] + xx, axle[1] + r * math.cos(aa), axle[2] + r * math.sin(aa)))
                rings.append([ring[0], ring[1], ring[3], ring[2]])
            cutters.append(k.mesh_object(f'_cut_{i}', rings, coll, 'MOD_Rim'))
        for c in cutters:
            m.boolean(disc, c)
        for c in cutters:
            bpy.data.objects.remove(c, do_unlink=True)
        d.lathe('polished_lip', coll, [(96, 250), (99, 253), (99, 256), (96, 258), (94, 256), (94, 251)],
                axle, 'MOD_Chrome', 'x', 80)
    else:
        for i in range(6):
            a = 2 * math.pi * i / 6
            rings = []
            for j in range(17):
                t = j / 16
                r = 61 + 142 * t
                width = 40 - 8 * t + 20 * max(0.0, (t - 0.8) / 0.2) ** 2
                xx = 40 + 30 * t
                section = [(-15, -width / 2 + 3), (-12, -width / 2), (-3, -width / 2), (0, -width / 2 + 3),
                           (0, width / 2 - 3), (-3, width / 2), (-12, width / 2), (-15, width / 2 - 3)]
                rings.append([(axle[0] + xx + dx, axle[1] + r * math.cos(a) - s * math.sin(a),
                               axle[2] + r * math.sin(a) + s * math.cos(a)) for dx, s in section])
            sk.mesh_object(f'spoke_{i}', rings, coll, 'MOD_Rim')
        # Dish wall from the spoke ends out to the lip, then a wide polished lip.
        d.lathe('dish_wall', coll, [(56, 197), (92, 197), (92, 205), (56, 205)], axle, 'MOD_Rim', 'x', 80)
        d.lathe('dish_lip', coll, [(90, 203), (97, 203), (99, 252), (96, 258), (92, 252), (90, 210)],
                axle, 'MOD_Chrome', 'x', 80)
    angle = .55
    d.lathe('valve', coll, [(0, 0), (0, 4), (15, 4), (17, 3), (17, 0)],
            (axle[0] + 83, axle[1] + 230 * math.cos(angle), axle[2] + 230 * math.sin(angle)), d.SATIN, 'x', 12)
    return d.finish(coll)
