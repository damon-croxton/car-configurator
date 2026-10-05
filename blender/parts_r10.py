"""Round ten: a Rocket Bunny / Pandem-style wide-body for both cars, and wings.

The real kits (both cars have one) are bolt-on: big overfenders front
(~+50 mm a side) and rear (~+60 mm), each running from the bumper corner or
door to the sill, with exposed bolts round the opening; a front lip and side
skirts widened to meet them; a rear diffuser; a ducktail. The wheels are
pushed out to fill the arches (the catalogue's flags.trackWidening).

Built on na_kit's helpers for whichever car `na_kit.use(gen)` points at.
Every part is fitted by ray-casting the reference car; generic names only.
"""
import math
import bmesh
import bpy
from mathutils import Vector
import mx5_lib as m
import na_kit as k
import nd_extras as x

SATIN, PAINT, CARBON = k.SATIN, k.PAINT, k.CARBON
ALLOY, CHROME = k.ALLOY, k.CHROME


def name(ident, part):
    return x.name(ident, part)


#: Per-car parts and positions, measured from the references (app mm).
CFG = {
    'nd': {
        'boot': 'Boot 6.001_157',
        'front_bumper': ('BumperF 6.003_111', 'BumperF 6.002_110', 'BumperF 6.001_109'),
        'rear_bumper': ('BumperR 6.001_146', 'BumperR 6_145', 'BumperR 6.002_147'),
        'sill': 'Skirts 6.003_57',
        # Skirt run between the arches (z front, z rear).
        'skirt_z': (800.0, -740.0),
        # GT wing: main-plane leading edge z, height, upright x, half-span.
        'wing': (-1595.0, 1235.0, 330.0, 660.0),
        # Diffuser strakes clear of the twin tail pipes (|x| 176-400).
        'strakes': (-600.0, -520.0, -110.0, 0.0, 110.0, 520.0, 600.0),
        'rear_edge_search': (-1880, -1650),
        # Overfender sweep, degrees from straight ahead of the hub.
        'flare_arc': (-26.0, 206.0),
    },
    'na': {
        'boot': 'trunk_Material #71_0',
        'front_bumper': ('frontbumper_Material #71_0',),
        'rear_bumper': ('rearbumper_Material #71_0',),
        'sill': 'sideskirt_Material #118_0',
        'skirt_z': (800.0, -700.0),
        'wing': (-1640.0, 1062.0, 300.0, 640.0),
        # Clear of the single tail pipe at x -604.
        'strakes': (-470.0, -300.0, -120.0, 60.0, 240.0, 420.0, 560.0),
        'rear_edge_search': (-1900, -1700),
        # The NA's bumper corners face forward, and a flare wrapped onto them
        # pinches, so its flares start and end near hub height.
        'flare_arc': (2.0, 178.0),
    },
    # NB / NC: helper meshes from prepare_nb_nc.make_helpers().
    'nb': {
        'boot': 'NB_BOOT',
        'front_bumper': ('Object_49',),
        'rear_bumper': ('Object_45.001',),
        'sill': 'NB_BODY',
        'skirt_z': (820.0, -730.0),
        'wing': (-1640.0, 1180.0, 300.0, 620.0),
        # Clear of the single tail pipe at x -500.
        'strakes': (-380.0, -220.0, -70.0, 80.0, 230.0, 390.0, 560.0),
        'rear_edge_search': (-1920, -1650),
        'flare_arc': (-10.0, 190.0),
    },
    'nc': {
        'boot': 'NC_BOOT',
        'front_bumper': ('NC_FRONT',),
        'rear_bumper': ('Object_60.001',),
        'sill': 'NC_BODY',
        'skirt_z': (860.0, -700.0),
        'wing': (-1620.0, 1200.0, 320.0, 650.0),
        # Clear of the twin tail pipes at x +-420.
        'strakes': (-620.0, -300.0, -130.0, 0.0, 130.0, 300.0, 620.0),
        'rear_edge_search': (-1900, -1650),
        'flare_arc': (-10.0, 190.0),
    },
}


def cfg():
    return CFG[k.GEN]


def orient_outward(obj):
    """Lofts with concave end caps can confuse normal recalculation; the
    signed volume says which way is out."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
    bm.free()
    return obj


# ------------------------------------------------------------ overfenders ----

def wide_fenders(ident='WB01', material=PAINT, bolts=CHROME, front_w=60.0, rear_w=70.0, square=22.0):
    """Wide-body overfenders round all four arches.

    Each flare sweeps from below hub height ahead of the wheel, over the
    arch, to below hub height behind it. Across the band it rises off the
    panel within 40 mm to a broad outer face `w` mm proud (60 front, 70
    rear), then turns back in at the arch opening with a short return lip,
    so from the side it reads as a separate, much wider wheel arch. The
    opening is squared off toward its upper corners (`square` mm at 45 deg),
    as the real kits cut it, and a raised bead runs along the flare's outer
    edge where it meets the panel. Washered bolt heads stud the outer face
    along the opening. The band (up to 175 mm) shrinks wherever the panel
    runs out (bumper corners, sill).
    """
    coll = m.start_mod(k.GEN, ident)
    hub_y = x.cfg()['hub_y']
    for side, names in x.cfg()['body'].items():
        parts = [k.base(n) for n in names]
        tag = 'L' if side > 0 else 'R'
        for arch, hz in x.cfg()['arches'].items():
            w = front_w if arch == 'front' else rear_w

            def skin(d, r):
                p, _ = x.hit_any(parts, (k.CX + side * 1300, hub_y + r * d.y, hz + r * d.z), (-side, 0, 0))
                return p if p is not None and abs(p.x - k.CX) > 640 else None

            stations = []
            a0, a1 = cfg()['flare_arc']
            for i in range(59):
                deg = a0 + (a1 - a0) * i / 58
                th = math.radians(deg)
                d = Vector((0, math.sin(th), math.cos(th)))
                lip = next((r for r in range(250, 560, 2) if skin(d, r) is not None), None)
                if lip is None:
                    continue
                # How far out the panel continues along this line.
                avail = 0
                for dr in range(4, 160, 4):
                    if skin(d, lip + dr) is None:
                        break
                    avail = dr
                # Stop where the panel runs out: a squeezed band crumples the
                # section at the bumper corners.
                if avail < 50:
                    continue
                stations.append((deg, d, lip, avail))
            assert len(stations) > 20, (arch, side)
            lips = k.gaussian([s[2] for s in stations], 1.5)
            avails = k.gaussian([s[3] for s in stations], 1.5)
            # Square the opening toward its upper corners (over the arch only).
            deltas = [square * math.sin(math.radians(2 * s[0])) ** 2 if 0 <= s[0] <= 180 else 0.0 for s in stations]
            lips = [lip + dl for lip, dl in zip(lips, deltas)]
            avails = [av - dl for av, dl in zip(avails, deltas)]
            rings = []
            bolt_points = []
            for n, ((deg, d, _, _), lip, avail) in enumerate(zip(stations, lips, avails)):
                t = n / (len(stations) - 1)
                end = k.smooth(min(t, 1 - t) / 0.05)
                proud = 6 + (w - 6) * end
                top = math.sin(math.radians(deg))
                band = max(46.0, min(avail, 120 + 55 * max(0.0, top)))
                sc = min(1.0, band / 120)
                face = min(34.0, band - 44 * sc - 4)
                # Edge bead, rise, broad outer face, opening, return lip,
                # then the underside back along the panel.
                section = [(band, 0.6), (band - 4 * sc, 3.5), (band - 9 * sc, 3.5), (band - 12 * sc, 2.2),
                           (band - 22 * sc, 0.5 * proud), (band - 44 * sc, 0.9 * proud), (face, proud),
                           (10, proud), (2, 0.92 * proud), (-4, 0.84 * proud), (-4, 0.4 * proud), (2, 1.0),
                           (band * 0.3, 0.6), (band * 0.55, 0.6), (band * 0.8, 0.6)]
                ring = []
                for dr, dx in section:
                    r = lip + max(dr, 2)
                    ref = None
                    # Smoothing can move the edge a little off the panel:
                    # look inward first, then outward.
                    for rr in list(range(int(r), int(lip) - 13, -2)) + list(range(int(r) + 2, int(r) + 32, 2)):
                        ref = skin(d, rr)
                        if ref is not None:
                            break
                    if ref is None:
                        break
                    ring.append((ref.x + side * dx, hub_y + (lip + dr) * d.y, hz + (lip + dr) * d.z))
                if len(ring) < len(section):
                    continue
                rings.append(ring)
                if n % 2 == 1 and end > 0.5:
                    bolt_points.append(Vector(ring[7]))
            obj = k.mesh_object(name(ident, f'{arch}_{tag}'), rings, coll, material)
            orient_outward(obj)
            if bolts:
                for j, p in enumerate(bolt_points):
                    # Washer, then a domed-ish head on it.
                    k.cylinder(f'washer_{arch}_{tag}{j}', coll, (p.x - side * 0.8, p.y, p.z), 'x', 8.0, side * 2.0, bolts, 16)
                    k.cylinder(f'bolt_{arch}_{tag}{j}', coll, (p.x + side * 1.0, p.y, p.z), 'x', 5.5, side * 4.0, bolts, 12)
    return k.finish(coll)


# ----------------------------------------------------------- wide front lip ----

def wide_lip(ident='WB10', material=CARBON):
    """A wide-body front splitter: a 6 mm carbon blade under the bumper,
    stepping 40 mm proud of its face with a slightly upturned leading edge,
    running out to the overfenders' width, held by three adjustable support
    rods to the bumper, with a tall canted end fence at each corner."""
    coll = m.start_mod(k.GEN, ident)
    parts = [k.base(n) for n in cfg()['front_bumper']]
    rows = []
    xs = [k.CX + v for v in range(-760, 761, 20)]
    edge = []
    for xx in xs:
        found = None
        for y in range(120, 420, 3):
            p, _ = x.hit_any(parts, (xx, y, 3000), (0, 0, -1))
            if p is not None:
                found = (y, p.z)
                break
        edge.append(found)
    valid = [i for i, e in enumerate(edge) if e is not None]
    xs = [xs[i] for i in valid]
    edge = [edge[i] for i in valid]
    ys = k.gaussian([e[0] for e in edge], 2)
    zs = k.gaussian([e[1] for e in edge], 2)
    for i, (xx, y, z) in enumerate(zip(xs, ys, zs)):
        u = abs(xx - k.CX) / max(abs(xs[0] - k.CX), abs(xs[-1] - k.CX))
        reach = 40 + 25 * u ** 3
        depth = 170 - 60 * u
        yb = y - 3
        # Section front to back: upturned leading edge, flat blade, back edge.
        rows.append([(xx, yb + 7, z + reach), (xx, yb + 1, z + reach - 18), (xx, yb, z - depth),
                     (xx, yb - 6, z - depth), (xx, yb - 6, z + reach - 20), (xx, yb + 2, z + reach - 2)])
    obj = k.mesh_object(name(ident, 'blade'), rows, coll, material)
    orient_outward(obj)
    for end in (0, -1):
        xx, y, z = xs[end], ys[end] - 3, zs[end]
        sgn = 1 if xx > k.CX else -1
        # Canted outward 8 deg, taller at the front.
        fence = [[(xx + sgn * (dx + 0.14 * (yy - y)), yy, zz) for zz, yy in
                  ((z + 60, y - 6), (z + 40, y + 95), (z - 60, y + 80), (z - 140, y + 20), (z - 140, y - 6))]
                 for dx in (-3.0, 3.0)]
        k.mesh_object(name(ident, f'fence_{"L" if sgn > 0 else "R"}'), fence, coll, material)
    # Support rods from the blade up to the bumper's underside.
    for n, frac in enumerate((0.2, 0.5, 0.8)):
        i = int(frac * (len(xs) - 1))
        xx, y, z = xs[i], ys[i] - 3, zs[i] - 70
        top = next((p.y for p in (x.hit_any(parts, (xx, y + 10, z), (0, 1, 0))[0],) if p is not None), y + 60)
        k.tube(f'rod_{n}', coll, [(xx, y + 1, z), (xx, min(top, y + 160) + 2, z - 25)], 3.0, ALLOY, 8)
    return k.finish(coll)


# --------------------------------------------------------- wide side skirts ----

def wide_skirts(ident='WB11', material=PAINT, reach=50.0):
    """Wide-body side skirts: a deep blade along each sill stepping `reach`
    mm out to meet the overfenders, with a flat vertical outer face and a
    chamfered top, tapering at both ends where it tucks under the flares."""
    coll = m.start_mod(k.GEN, ident)
    sill = k.base(cfg()['sill'])
    z0, z1 = cfg()['skirt_z']
    for side in (-1, 1):
        def hit(y, z):
            return k.ray(sill, (k.CX + side * 1300, y, z), (-side, 0, 0))

        rings = []
        for i in range(61):
            t = i / 60
            z = z0 + (z1 - z0) * t
            bottom = next((y for y in range(120, 320, 2) if hit(y, z)), None)
            assert bottom is not None, z
            top = bottom + 46
            ps = [hit(y, z) for y in (bottom + 2, top)]
            if ps[1] is None:
                ps[1] = ps[0]
            xb, xt = abs(ps[0].x - k.CX), abs(ps[1].x - k.CX)
            end = k.smooth(min(t, 1 - t) / 0.08)
            out = 12 + (reach - 12) * end
            drop = 10 + 14 * end
            # Upper body, a step, then a lower blade that sticks out 12 mm
            # further: the kits' two-tier skirt.
            section = [(xt + 0.7, top), (xt + out - 10, top - 4), (xt + out, top - 14), (xt + out, bottom - drop + 12),
                       (xt + out + 12 * end, bottom - drop + 8), (xt + out + 12 * end, bottom - drop + 2),
                       (xt + out - 4, bottom - drop), (xb + 2, bottom - drop), (xb + 0.7, bottom + 2)]
            rings.append([(k.CX + side * dd, yy, z) for dd, yy in section])
        obj = k.mesh_object(name(ident, f'skirt_{"L" if side > 0 else "R"}'), rings, coll, material)
        orient_outward(obj)
        # A small vertical fin at each end of the lower blade.
        for t_end, tag2 in ((0.09, 'f'), (0.91, 'r')):
            ring = rings[int(t_end * 60)]
            px, py, pz = ring[4]
            fin = [[(px + side * dx, py - 2, pz + dz) for dx, dz in ((-30, -40), (0, -40), (0, 40), (-30, 40))],
                   [(px + side * dx, py + 38, pz + dz) for dx, dz in ((-30, -30), (-4, -20), (-4, 20), (-30, 30))]]
            k.mesh_object(name(ident, f'fin_{"L" if side > 0 else "R"}{tag2}'), fin, coll, CARBON)
    return k.finish(coll)


# ----------------------------------------------------------- wide diffuser ----

def wide_diffuser(ident='WB12', material=CARBON):
    """A wide rear diffuser: a carbon undertray plate under the rear bumper,
    kicking up toward its trailing edge, with tall vertical strakes placed
    clear of the tail pipes."""
    coll = m.start_mod(k.GEN, ident)
    parts = [k.base(n) for n in cfg()['rear_bumper']]
    xs = [k.CX + v for v in range(-700, 701, 20)]
    edge = []
    for xx in xs:
        found = None
        for y in range(140, 420, 3):
            p, _ = x.hit_any(parts, (xx, y, -3000), (0, 0, 1))
            if p is not None:
                found = (y, p.z)
                break
        edge.append(found)
    keep = [i for i, e in enumerate(edge) if e is not None]
    xs = [xs[i] for i in keep]
    ys = k.gaussian([edge[i][0] for i in keep], 2)
    zs = k.gaussian([edge[i][1] for i in keep], 2)
    rows = []
    for xx, y, z in zip(xs, ys, zs):
        yb = y - 3
        # Rows run front (under the car) to rear (kicked up 40 mm at the lip).
        rows.append([(xx, yb, z + 260), (xx, yb + 4, z + 120), (xx, yb + 40, z - 30),
                     (xx, yb + 34, z - 30), (xx, yb - 2, z + 120), (xx, yb - 6, z + 260)])
    obj = k.mesh_object(name(ident, 'plate'), rows, coll, material)
    orient_outward(obj)
    for n, dx in enumerate(cfg()['strakes']):
        xx = k.CX + dx
        i = min(range(len(xs)), key=lambda j: abs(xs[j] - xx))
        y, z = ys[i] - 3, zs[i]
        fin = [[(xx + s, y + 2, z + 230), (xx + s, y + 2, z - 25), (xx + s, y + 70, z - 25), (xx + s, y + 28, z + 230)]
               for s in (-2.5, 2.5)]
        k.mesh_object(name(ident, f'strake_{n}'), fin, coll, material)
    # Tall fences at the outer edges, as on the kits' diffusers.
    for end, tag in ((0, 'R'), (-1, 'L')):
        xx, y, z = xs[end], ys[end] - 3, zs[end]
        sgn = 1 if xx > k.CX else -1
        fence = [[(xx - sgn * 4 + s, yy, zz) for zz, yy in ((z + 250, y + 2), (z - 35, y + 2), (z - 35, y + 110), (z + 60, y + 60))]
                 for s in (-3.0, 3.0)]
        k.mesh_object(name(ident, f'fence_{tag}'), fence, coll, material)
    return k.finish(coll)


# -------------------------------------------------------------- ducktails ----

def ducktail(ident='WB13', rise=55.0, chord=110.0, inset=20.0, material=PAINT):
    """A tall ducktail along the boot's rear edge, spanning the boot: the
    wide-body kits' signature flip. Follows the edge's plan curve and the
    deck under every chord station (smoothed along the span)."""
    coll = m.start_mod(k.GEN, ident)
    boot = k.base(cfg()['boot'])
    lo, hi = cfg()['rear_edge_search']

    def deck(xx, z):
        p = k.ray(boot, (xx, 2000, z), (0, -1, 0))
        return None if p is None else p.y

    xs, rears = [], []
    for v in range(-640, 641, 16):
        xx = k.CX + v
        rear = next((z for z in range(lo, hi) if k.ray(boot, (xx, 2000, z), (0, -1, 0))), None)
        if rear is not None:
            xs.append(xx)
            rears.append(rear + inset)
    half = max(abs(xs[0] - k.CX), abs(xs[-1] - k.CX))
    rears = k.gaussian(rears, 6)
    stations = [0, 0.1, 0.3, 0.55, 0.8, 0.95, 1]
    rings = []
    for xx, trailing in zip(xs, rears):
        u = abs(xx - k.CX) / half
        taper = 1 - k.smooth((u - 0.8) / 0.2)
        c = chord * (0.6 + 0.4 * taper)
        heights = []
        for t in stations:
            z = trailing + c * (1 - t)
            h = next((hh for dz in (0, 6, -6, 12, -12, 20, -20) if (hh := deck(xx, z + dz)) is not None), None)
            heights.append(h)
        if None in heights:
            continue
        r = 3 + (rise - 3) * taper
        lifts = [1.0, 2.2, 0.2 * r + 1, 0.5 * r, 0.85 * r, r, r - 1.2]
        ring = [(xx, h + lift, trailing + c * (1 - t)) for t, h, lift in zip(stations, heights, lifts)]
        for t in (1, 0.8, 0.55, 0.3, 0):
            j = stations.index(t)
            ring.append((xx, heights[j] + 0.7, trailing + c * (1 - t)))
        rings.append(ring)
    obj = k.mesh_object(name(ident, 'spoiler'), rings, coll, material)
    orient_outward(obj)
    # Gurney lip along the trailing edge's top, and an end cap each side
    # where the flip meets the boot corner.
    gurney = []
    for ring in rings[::2]:
        tx, ty, tz = ring[6]
        gurney.append([(tx, ty - 1, tz + 6), (tx, ty + 9, tz + 1), (tx, ty + 9, tz - 2), (tx, ty - 1, tz - 2)])
    k.mesh_object(name(ident, 'gurney'), gurney, coll, material)
    for ring, tag in ((rings[0], 'R'), (rings[-1], 'L')):
        xx = ring[0][0]
        sgn = 1 if xx > k.CX else -1
        outline = [(p[2], p[1]) for p in ring[:7]] + [(ring[6][2], ring[6][1] - 18), (ring[0][2], ring[0][1] - 4)]
        cap = [[(xx + sgn * dx, yy, zz) for zz, yy in outline] for dx in (-2.0, 2.0)]
        k.mesh_object(name(ident, f'cap_{tag}'), cap, coll, material)
    return k.finish(coll)


# ------------------------------------------------------------------ wings ----

AIRFOIL = [(0, 0), (9, 4.5), (32, 6.5), (82, 6.5), (155, 12), (200, 20),
           (200, 17), (155, 5), (82, -8), (32, -9), (9, -4.5)]


def _airfoil(label, coll, half, y0, z0, chord, sweep_y=9.0, sweep_z=12.0, material=CARBON):
    s = chord / 200.0
    rings = []
    for i in range(31):
        xx = k.CX - half + 2 * half * i / 30
        u = abs(xx - k.CX) / half
        y, z = y0 + sweep_y * u * u, z0 - sweep_z * u * u
        rings.append([(xx, y + dy * s, z - dz * s) for dz, dy in AIRFOIL])
    return k.mesh_object(label, rings, coll, material)


def _endplate(label, coll, xe, y0, z0, chord, height, material=CARBON):
    outline = [(z0 + 30, y0 + height * 0.55), (z0 + 10, y0 + height * 0.7), (z0 - chord - 50, y0 + height * 0.62),
               (z0 - chord - 80, y0 - height * 0.15), (z0 - chord - 50, y0 - height * 0.45),
               (z0 - 10, y0 - height * 0.35), (z0 + 30, y0 - height * 0.1)]
    return k.mesh_object(label, [[(xe + dx, y, z) for z, y in outline] for dx in (-2.5, 2.5)], coll, material)


def wing(ident, style):
    """GT-style wings on the boot.

    'double'      two-element wing: main plane plus a flap above its
                  trailing edge, on swept deck-mounted uprights;
    'swan'        swan-neck: the uprights rise behind the wing and hook over
                  its leading edge onto the top surface, leaving the
                  underside clean;
    'time_attack' chassis-mount: a wide, deep wing high above the boot on
                  tall uprights footed at the boot's rear edge, with big
                  endplates.
    """
    coll = m.start_mod(k.GEN, ident)
    boot = k.base(cfg()['boot'])
    z0, y0, ux, half = cfg()['wing']
    lo, hi = cfg()['rear_edge_search']

    def deck(xx, z):
        p = k.ray(boot, (xx, 2000, z), (0, -1, 0))
        assert p is not None, (xx, z)
        return p.y

    chord = 200.0
    if style == 'time_attack':
        y0 += 150
        half += 140
        chord = 270.0
        z0 -= 20
    elif style == 'swan':
        y0 -= 20
        chord = 230.0
    _airfoil(name(ident, 'main'), coll, half, y0, z0, chord)
    if style in ('double', 'time_attack'):
        # Flap: 45% chord, overlapping the main plane's trailing edge, pitched up.
        flap_z = z0 - chord * 0.82
        flap_c = chord * 0.45
        rings = []
        for i in range(31):
            xx = k.CX - half + 2 * half * i / 30
            u = abs(xx - k.CX) / half
            y, z = y0 + 30 + 9 * u * u, flap_z - 12 * u * u
            s = flap_c / 200.0
            pitch = math.radians(-14)
            ring = []
            for dz, dy in AIRFOIL:
                pz, py = -dz * s, dy * s
                ring.append((xx, y + pz * math.sin(pitch) + py * math.cos(pitch), z + pz * math.cos(pitch) - py * math.sin(pitch)))
            rings.append(ring)
        k.mesh_object(name(ident, 'flap'), rings, coll, CARBON)
    for sgn in (-1, 1):
        tag = 'L' if sgn > 0 else 'R'
        xu = k.CX + sgn * ux
        if style == 'time_attack':
            # Footed at the boot's rear edge, leaning back into the wing.
            rear = next(z for z in range(lo, hi) if k.ray(boot, (xu, 2000, z), (0, -1, 0)))
            zf = rear + 40
        else:
            zf = z0 + 40
        yf = deck(xu, zf) + 2
        if style == 'swan':
            # Rises behind the wing, then hooks forward over the leading edge
            # and down onto the top surface.
            path = [(xu, yf, zf - 160), (xu, y0 + 40, z0 - chord - 20), (xu, y0 + 95, z0 - chord * 0.5),
                    (xu, y0 + 70, z0 - 20), (xu, y0 + 14, z0 - chord * 0.25)]
        else:
            path = [(xu, yf, zf), (xu, y0 - 6, z0 - chord * 0.35)]
        rings = []
        for i in range(len(path) - 1):
            pa, pb = Vector(path[i]), Vector(path[i + 1])
            tangent = (pb - pa).normalized()
            # Plate cross-section in the car's y-z plane, square to the path.
            perp = Vector((0, -tangent.z, tangent.y))
            for j in range(6 if i == len(path) - 2 else 5):
                t = j / 5
                p = pa.lerp(pb, t)
                c = (110 - 40 * (i + t) / max(1, len(path) - 1)) if style != 'swan' else 40.0
                rings.append([tuple(p + Vector((-4, 0, 0)) + perp * c / 2), tuple(p + Vector((4, 0, 0)) + perp * c / 2),
                              tuple(p + Vector((4, 0, 0)) - perp * c / 2), tuple(p + Vector((-4, 0, 0)) - perp * c / 2)])
        k.mesh_object(name(ident, f'upright_{tag}'), rings, coll, SATIN)
        k.box(f'foot_{tag}', coll, (xu, yf - 1, zf - (160 if style == 'swan' else 0)), (70, 6, 120), SATIN, 1.5)
        xe = k.CX + sgn * (half + 2.5)
        height = 150 if style == 'time_attack' else 105
        _endplate(name(ident, f'endplate_{tag}'), coll, xe, y0, z0, chord, height)
    return k.finish(coll)
