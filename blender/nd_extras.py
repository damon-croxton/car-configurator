"""Twelve more ND accessories, all "additional parts" (CarConfig.extraMods).

Built on na_kit's helpers pointed at the ND (`na_kit.use('nd')`): every part
is fitted by ray-casting the reference car and nothing is copied from it.
DT49 is the one replacement, and it hides only the stock mirror heads.
Run through build_nd_extras.py. Dimensions are app-space millimetres.
"""
import math
import bpy
from mathutils import Vector
import mx5_lib as m
import na_kit as k

SATIN, PAINT, CARBON = k.SATIN, k.PAINT, k.CARBON
ALLOY, CHROME, ACCENT = k.ALLOY, k.CHROME, k.ACCENT
WHITE = 'MOD_StripeWhite'
LENS = 'MOD_LensRed'
MESH = 'MOD_Mesh'
MIRROR = 'MOD_MirrorGlass'


def name(ident, part):
    return f'MOD_{k.GEN.upper()}_{ident}_{part}'


#: Per-car reference parts and positions for the builders shared by both
#: cars (stripes, rack, rain light, flares, tow strap). `na_kit.use(gen)`
#: picks the car; `cfg()` returns its row.
GEN_CFG = {
    'nd': {
        'stripe_panels': (('Hood 6.001_120', 'bonnet'), ('Boot 6.001_157', 'boot')),
        'side_panels': {1: ('FenderFL 6.002_88', 'DoorL 6.003_68', 'FendersR 6.001_40'),
                        -1: ('FenderFR 6.001_80', 'DoorR 6.003_73', 'FendersR 6.001_40')},
        'side_z': (818.0, -735.0), 'side_y': 430.0,
        'boot': 'Boot 6.001_157', 'rack': (330.0, -1420.0, -1760.0, (-1470.0, -1590.0, -1710.0)),
        'rain_part': 'BumperR 6_145', 'rain_y': 304.0,
        'arches': {'front': 1194.0, 'rear': -1114.0}, 'hub_y': 321.0, 'arc': (5.0, 175.0),
        'body': {1: ('FenderFL 6.002_88', 'FendersR 6.001_40', 'BumperF 6.003_111', 'BumperR 6.001_146',
                     'DoorL 6.003_68', 'Skirts 6.003_57'),
                 -1: ('FenderFR 6.001_80', 'FendersR 6.001_40', 'BumperF 6.003_111', 'BumperR 6.001_146',
                      'DoorR 6.003_73', 'Skirts 6.003_57')},
        'rear_bumper': ('BumperR 6.001_146', 'BumperR 6_145', 'BumperR 6.002_147'), 'strap_x': -480.0,
        'mirror': ((805.0, 818.0, 100.0), (905.0, 876.0, 70.0)),
        'front_strap': ('BumperF 6.003_111', -480.0),
        'deflector': (-790.0, 240.0, 945.0, 1035.0, 40.0),
        # Vents: per-side panel, then z0, z1, y0, y1 on it.
        'fender_vent': ({1: 'FenderFL 6.002_88', -1: 'FenderFR 6.001_80'}, 700.0, 520.0, 470.0, 590.0),
        'rear_vent': ('BumperR 6.001_146', -1545.0, -1635.0, 385.0, 455.0),
        # Rear canards: bumper, leading z, span along the car, height.
        'canard': ('BumperR 6.001_146', -1680.0, 150.0, 412.0),
        # Fuel filler: panel, side, centre y, centre z.
        'fuel': ('FendersR 6.001_40', 1, 787.0, -1480.0),
    },
    'na': {
        'stripe_panels': (('hood_Material #71_0', 'bonnet'), ('trunk_Material #71_0', 'boot')),
        'side_panels': {1: ('f fender_Material #71_0', 'leftdoor_Material #71_0', 'rearfender_Material #71_0'),
                        -1: ('f fender_Material #71_0', 'rigthdoor_Material #71_0', 'rearfender_Material #71_0')},
        'side_z': (835.0, -745.0), 'side_y': 335.0,
        'boot': 'trunk_Material #71_0', 'rack': (300.0, -1300.0, -1730.0, (-1350.0, -1515.0, -1680.0)),
        'rain_part': 'rearbumper_Material #71_0', 'rain_y': 300.0,
        'arches': {'front': 1181.0, 'rear': -1122.0}, 'hub_y': 303.0, 'arc': (12.0, 165.0),
        'body': {sd: ('f fender_Material #71_0', 'rearfender_Material #71_0', 'frontbumper_Material #71_0',
                      'rearbumper_Material #71_0', door, 'sideskirt_Material #118_0')
                 for sd, door in ((1, 'leftdoor_Material #71_0'), (-1, 'rigthdoor_Material #71_0'))},
        'rear_bumper': ('rearbumper_Material #71_0',), 'strap_x': 420.0,
        # Vitaloni-style heads on a stalk from the door top; the stock mirror
        # (arm included) is one node, so the stalk starts at the door.
        'mirror': ((730.0, 800.0, 95.0), (868.0, 852.0, 70.0)),
        'front_strap': ('frontbumper_Material #71_0', 440.0),
        # On the shelf behind the seat well, which starts at z -880.
        'deflector': (-895.0, 300.0, 840.0, 1010.0, 14.0),
        'fender_vent': ({1: 'f fender_Material #71_0', -1: 'f fender_Material #71_0'}, 860.0, 705.0, 445.0, 520.0),
        'rear_vent': ('rearbumper_Material #71_0', -1510.0, -1590.0, 330.0, 390.0),
        'canard': ('rearbumper_Material #71_0', -1690.0, 140.0, 360.0),
        # The NA's filler is on the right rear quarter, ahead of the tail light.
        'fuel': ('rearfender_Material #71_0', -1, 720.0, -1330.0),
    },
}


def cfg():
    return GEN_CFG[k.GEN]


def hit_any(parts, origin, direction):
    """Nearest hit, with its normal, across several reference parts."""
    best = (None, None, None)
    for part in parts:
        p, n = k.ray_normal(part, origin, direction)
        if p is None:
            continue
        d = (p - Vector(origin)).length
        if best[0] is None or d < best[2]:
            best = (p, n, d)
    return best[0], best[1]


def film(label, coll, grid, lift, thick, material):
    """A thin skin over a surface: `grid` is rows of (point, normal) pairs.

    Each row becomes a closed ring (outer surface, then inner surface back),
    so the result is a watertight slab `thick` mm deep, `lift` mm clear of
    the surface along its own normal.
    """
    rings = []
    for row in grid:
        outer = [tuple(p + n * (lift + thick)) for p, n in row]
        inner = [tuple(p + n * lift) for p, n in reversed(row)]
        rings.append(outer + inner)
    return k.mesh_object(label, rings, coll, material)


def outward(n, axis):
    """Flip a surface normal to face away from the car along `axis`."""
    return -n if n.dot(axis) < 0 else n


# ------------------------------------------------------- headlight eyelids ----

def eyelids(ident='DT42'):
    """Painted brows over the top of both headlight lenses.

    Each brow covers the lens's upper edge, 24 mm deep at its middle and
    thinning to 4 mm at both ends, lifted 1 mm off the lens along its normal.
    """
    coll = m.start_mod(k.GEN, ident)
    for side, lens_name in ((1, 'HeadLightL 6.002_95'), (-1, 'HeadLightR 6.002_101')):
        lens = k.base(lens_name)
        pts = [k.app(lens.matrix_world @ v.co) for v in lens.data.vertices]
        x0, x1 = min(abs(p.x) for p in pts) + 8, max(abs(p.x) for p in pts) - 6
        rows = []
        for i in range(41):
            x = side * (x0 + (x1 - x0) * i / 40)
            top = next(y for y in range(720, 480, -1) if k.ray(lens, (x, y, 3000), (0, 0, -1)))
            t = i / 40
            depth = 4 + 20 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7
            row = []
            for j in range(7):
                y = top - 1 - depth * j / 6
                p, n = k.ray_normal(lens, (x, y, 3000), (0, 0, -1))
                if p is None:
                    p, n = row[-1]
                row.append((p, outward(n, Vector((0, 0.4, 1)))))
            rows.append(row)
        film(name(ident, f'brow_{"L" if side > 0 else "R"}'), coll, rows, 1.0, 2.0, PAINT)
    return k.finish(coll)


# ----------------------------------------------------------- racing stripes ----

def racing_stripes(ident='DT43', material=WHITE):
    """Twin white stripes over the bonnet and boot lid.

    Two 110 mm stripes either side of a 40 mm gap, laid on each panel from
    its front edge to its back edge, 0.4 mm thick and 0.6 mm clear.
    """
    coll = m.start_mod(k.GEN, ident)
    up = Vector((0, 1, 0))
    for panel_name, tag in cfg()['stripe_panels']:
        panel = k.base(panel_name)
        zs = [z for z in range(-2000, 2000, 4) if k.ray(panel, (k.CX + 75, 2000, z), (0, -1, 0))]
        z_front, z_back = max(zs) - 14, min(zs) + 14
        for side in (-1, 1):
            rows = []
            for i in range(61):
                z = z_front - (z_front - z_back) * i / 60
                row = []
                for j in range(5):
                    x = k.CX + side * (20 + 110 * j / 4)
                    p, n = k.ray_normal(panel, (x, 2000, z), (0, -1, 0))
                    assert p is not None, (tag, x, z)
                    row.append((p, outward(n, up)))
                rows.append(row if side > 0 else list(reversed(row)))
            film(name(ident, f'{tag}_{"L" if side > 0 else "R"}'), coll, rows, 0.6, 0.4, material)
    return k.finish(coll)


# ------------------------------------------------------------- side stripes ----


def side_stripes(ident='DT44', material=WHITE):
    """A 22 mm white stripe along each flank, between the wheel arches.

    It runs at 430-452 mm, across front fender, door and rear quarter.
    """
    coll = m.start_mod(k.GEN, ident)
    z0, z1 = cfg()['side_z']
    y0 = cfg()['side_y']
    for side, names in cfg()['side_panels'].items():
        parts = [k.base(n) for n in names]
        axis = Vector((side, 0, 0))
        rows = []
        for i in range(121):
            z = z0 - (z0 - z1) * i / 120
            row = []
            for j in range(4):
                y = y0 + 22 * j / 3
                p, n = None, None
                # Panel shut lines are real gaps: step along until a ray lands.
                for dz in (0, 2, -2, 4, -4, 6, -6, 9, -9):
                    p, n = hit_any(parts, (k.CX + side * 1300, y, z + dz), (-side, 0, 0))
                    if p is not None:
                        p = Vector((p.x, p.y, z))
                        break
                assert p is not None, (side, y, z)
                row.append((p, outward(n, axis)))
            rows.append(row if side > 0 else list(reversed(row)))
        film(name(ident, f'stripe_{"L" if side > 0 else "R"}'), coll, rows, 0.6, 0.4, material)
    return k.finish(coll)


# -------------------------------------------------------------- boot rack ----

def boot_rack(ident='DT45', material=CHROME):
    """A chrome luggage rack on the boot lid: two rails, three crossbars.

    The rails follow the lid's slope 45 mm above it, bent down at each end
    into round feet on rubber pads.
    """
    coll = m.start_mod(k.GEN, ident)
    boot = k.base(cfg()['boot'])

    def deck(x, z):
        p = k.ray(boot, (x, 2000, z), (0, -1, 0))
        assert p is not None, (x, z)
        return p.y

    half, z0, z1, bars = cfg()['rack']
    rise = 45.0
    for side in (-1, 1):
        x = k.CX + side * half
        path = [(x, deck(x, z0) + 6, z0 + 6)]
        for i in range(9):
            z = z0 - 22 - (z0 - z1 - 44) * i / 8
            path.append((x, deck(x, z) + rise, z))
        path.append((x, deck(x, z1) + 6, z1 - 6))
        k.tube(f'rail_{"L" if side > 0 else "R"}', coll, m.rounded_path(path, 18, 6), 7.5, material, 14)
        for z in (z0 + 6, z1 - 6):
            k.cylinder(f'foot_{"L" if side > 0 else "R"}_{int(-z)}', coll, (x, deck(x, z) - 1, z), 'y', 13, 6, SATIN)
    for z in bars:
        xa, xb = k.CX - half, k.CX + half
        ya, yb = deck(xa, z) + rise, deck(xb, z) + rise
        k.tube(f'bar_{int(-z)}', coll, [(xa, ya, z), (xb, yb, z)], 6, material, 12)
    return k.finish(coll)


# ---------------------------------------------------------- wind deflector ----

def wind_deflector(ident='DT46'):
    """A mesh wind blocker between the hoop covers, behind the headrests.

    A 480 x 100 mm panel of black mesh in a satin tube frame, standing on the
    centre bulkhead at z -790 and leaning back 6 degrees.
    """
    coll = m.start_mod(k.GEN, ident)
    z, half, y0, y1, leg = cfg()['deflector']
    lean = math.tan(math.radians(6))

    def at(x, y):
        return (k.CX + x, y, z - (y - y0) * lean)

    k.tube('frame', coll, m.rounded_path([at(-half, y0), at(-half, y1), at(half, y1), at(half, y0)], 14, 6),
           8, SATIN, 12)
    k.tube('frame_base', coll, [at(-half - 6, y0), at(half + 6, y0)], 8, SATIN, 12)
    panel = []
    for i in range(9):
        x = -half + 6 + (2 * half - 12) * i / 8
        panel.append([at(x, y0 + 4), at(x, y1 - 4),
                      (k.CX + x, y1 - 4, z - (y1 - 4 - y0) * lean - 2), (k.CX + x, y0 + 4, z - 4 * lean - 2)])
    k.mesh_object(name(ident, 'mesh'), panel, coll, MESH)
    for x in (-150.0, 150.0):
        k.tube(f'leg_{"L" if x > 0 else "R"}', coll, [at(x, y0), (k.CX + x, y0 - leg, z + 4)], 6, SATIN, 10)
    return k.finish(coll)


# ------------------------------------------------------------- rain light ----

def rain_light(ident='DT47'):
    """An F1-style centre rain light on the rear bumper's lower panel.

    Its red lens is classed with the tail lamps, so the app's tail-light
    switch lights it too.
    """
    coll = m.start_mod(k.GEN, ident)
    lower = k.base(cfg()['rain_part'])
    y = cfg()['rain_y']
    face = k.ray(lower, (k.CX, y, -2600), (0, 0, 1))
    assert face is not None
    zf = face.z
    k.box('housing', coll, (k.CX, y, zf - 9), (134, 38, 20), SATIN, 2)
    k.box('lens', coll, (k.CX, y, zf - 19.5), (118, 26, 3), LENS, 0.8)
    for x in (-50.0, 50.0):
        k.cylinder(f'bolt_{"L" if x > 0 else "R"}', coll, (k.CX + x, y, zf - 21.5), 'z', 2.6, 2, ALLOY, 10)
    return k.finish(coll)


# ------------------------------------------------------------------ vents ----

def side_vent(ident, coll, tag, part, side, z0, z1, y0, y1, slats, frame_mat):
    """A vent panel on a near-vertical side surface: frame, recess, slats.

    Laid out in (z, y) on the panel and fitted to it by sideways rays, so it
    follows the panel's curvature. Slats are rear-facing louvres.
    """
    axis = Vector((side, 0, 0))

    def on(z, y):
        p, n = k.ray_normal(part, (k.CX + side * 1300, y, z), (-side, 0, 0))
        assert p is not None, (tag, z, y)
        return p, outward(n, axis)

    def slab(label, za, zb, ya, yb, lift, thick, material, nz=9, ny=5):
        grid = [[on(za + (zb - za) * i / (nz - 1), ya + (yb - ya) * j / (ny - 1)) for j in range(ny)]
                for i in range(nz)]
        if side < 0:
            grid = [list(reversed(row)) for row in grid]
        return film(name(ident, label), coll, grid, lift, thick, material)

    slab(f'recess_{tag}', z0, z1, y0, y1, 0.6, 0.8, SATIN)
    border = 9.0
    slab(f'frame_top_{tag}', z0 - border, z1 + border, y1, y1 + border, 0.6, 3.0, frame_mat, ny=3)
    slab(f'frame_bottom_{tag}', z0 - border, z1 + border, y0 - border, y0, 0.6, 3.0, frame_mat, ny=3)
    slab(f'frame_front_{tag}', z0, z0 - border, y0, y1, 0.6, 3.0, frame_mat, nz=3)
    slab(f'frame_rear_{tag}', z1 + border, z1, y0, y1, 0.6, 3.0, frame_mat, nz=3)
    pitch = (y1 - y0) / slats
    for s in range(slats):
        yc = y0 + pitch * (s + 0.5)
        slab(f'slat_{tag}{s}', z0 + 2, z1 - 2, yc - pitch * 0.18, yc + pitch * 0.18, 1.2, 2.6, frame_mat, ny=3)


def fender_vents(ident='DT48'):
    """Carbon three-slat gills on both front fenders, behind the arch."""
    coll = m.start_mod(k.GEN, ident)
    parts, z0, z1, y0, y1 = cfg()['fender_vent']
    for side in (1, -1):
        side_vent(ident, coll, 'L' if side > 0 else 'R', k.base(parts[side]), side,
                  z0, z1, y0, y1, 3, CARBON)
    return k.finish(coll)


def rear_vents(ident='DT52'):
    """Carbon two-slat vents on the rear bumper's flanks, behind the arch."""
    coll = m.start_mod(k.GEN, ident)
    part, z0, z1, y0, y1 = cfg()['rear_vent']
    bumper = k.base(part)
    for side in (1, -1):
        side_vent(ident, coll, 'L' if side > 0 else 'R', bumper, side,
                  z0, z1, y0, y1, 2, CARBON)
    return k.finish(coll)


# ------------------------------------------------------------ aero mirrors ----

MIRROR_HIDES = ['MirrorL 6.002_175', 'MirrorL 6.003_176', 'MirrorL 6.001_174', 'MirrorL 6_173',
                'MirrorR 6.001_181', 'MirrorR 6.002_182', 'MirrorR 6_180', 'MirrorR 6.003_183']


def aero_mirrors(ident='DT49', material=CARBON):
    """Carbon teardrop mirror heads on slim stalks, replacing the stock heads.

    The stock bases stay. Each head is a 150 mm teardrop, deeper at its
    inboard end, with the glass on its rear face.
    """
    coll = m.start_mod(k.GEN, ident)
    for side in (1, -1):
        tag = 'L' if side > 0 else 'R'
        (bx, by, bz), (hx, hy, hz) = cfg()['mirror']
        base_top = Vector((k.CX + side * bx, by, bz))
        head = Vector((k.CX + side * hx, hy, hz))
        k.tube(f'stalk_{tag}', coll,
               [tuple(base_top + Vector((0, -6, 0))), tuple(base_top.lerp(head, 0.5) + Vector((0, 14, 0))),
                tuple(head + Vector((-side * 60, 0, 0)))], 7, material, 12)
        rings = []
        for i in range(17):
            t = i / 16
            x = head.x + side * (-72 + 150 * t)
            # Teardrop in plan: fuller inboard, tapering to the tip.
            scale = math.sin(math.pi * (0.06 + 0.94 * t) ** 0.85) if t > 0 else 0.15
            a, b = 34 * scale + 2, 30 * scale + 2
            rings.append([(x, head.y + a * math.sin(u), head.z + 4 + b * math.cos(u))
                          for u in (2 * math.pi * j / 32 for j in range(32))])
        k.mesh_object(name(ident, f'head_{tag}'), rings, coll, material)
        glass = []
        for i in range(13):
            t = 0.12 + 0.76 * i / 12
            x = head.x + side * (-72 + 150 * t)
            scale = math.sin(math.pi * (0.06 + 0.94 * t) ** 0.85)
            a = 26 * scale
            zf = head.z + 4 - (30 * scale + 2) - 0.6
            glass.append([(x, head.y - a, zf), (x, head.y + a, zf), (x, head.y + a, zf - 1.2), (x, head.y - a, zf - 1.2)])
        k.mesh_object(name(ident, f'glass_{tag}'), glass, coll, MIRROR)
    return k.finish(coll)


# ------------------------------------------------------------ rear canards ----

def rear_canards(ident='DT50'):
    """A carbon canard on each rear bumper corner, following its curve."""
    coll = m.start_mod(k.GEN, ident)
    part, z_lead, span, y_root = cfg()['canard']
    bumper = k.base(part)
    for side in (1, -1):
        rings = []
        for i in range(25):
            t = i / 24
            z = z_lead - span * t
            y = y_root - 10 * t
            p, n = k.ray_normal(bumper, (k.CX + side * 1300, y, z), (-side, 0, 0))
            assert p is not None, (side, z)
            n = outward(Vector((n.x, 0, n.z)).normalized(), Vector((side, 0, 0)))
            width = 3 + 42 * math.sin(math.pi * t) ** 0.8
            rise = 7 * math.sin(math.pi * t)
            root = p - n * 1.5
            tip = p + n * width
            rings.append([(root.x, y + 5, root.z), (tip.x, y + rise + 1, tip.z),
                          (tip.x, y + rise - 2, tip.z), (root.x, y - 3, root.z)])
        k.mesh_object(name(ident, f'canard_{"L" if side > 0 else "R"}'), rings, coll, CARBON)
    return k.finish(coll)


# -------------------------------------------------------- front tow strap ----

def front_strap(ident='DT51'):
    """A red webbing loop hanging from the front bumper's lower right."""
    coll = m.start_mod(k.GEN, ident)
    part, dx = cfg()['front_strap']
    bumper = k.base(part)
    x = k.CX + dx
    bottom = next(y for y in range(150, 420) if k.ray(bumper, (x, y, 2600), (0, 0, -1)))
    face = k.ray(bumper, (x, bottom + 50, 2600), (0, 0, -1))
    assert face is not None
    zc, yc = face.z + 20, bottom + 12.0
    rings = []
    for i in range(49):
        a = 2 * math.pi * i / 48
        y = yc + 50 * math.cos(a)
        z = zc + 15 * math.sin(a)
        nrm = Vector((0, 15 * math.cos(a), 50 * math.sin(a))).normalized()
        rings.append([(x - 18, y + nrm.y * 1.2, z + nrm.z * 1.2), (x + 18, y + nrm.y * 1.2, z + nrm.z * 1.2),
                      (x + 18, y - nrm.y * 1.2, z - nrm.z * 1.2), (x - 18, y - nrm.y * 1.2, z - nrm.z * 1.2)])
    k.mesh_object(name(ident, 'webbing'), rings[:-1], coll, ACCENT)
    k.cylinder('bracket', coll, (x, bottom + 59, face.z - 4), 'z', 8, 26, SATIN, 16)
    k.cylinder('bolt', coll, (x, bottom + 59, face.z + 22), 'z', 9, 5, ALLOY, 6)
    return k.finish(coll)


# ----------------------------------------------------------- fender flares ----


def fender_flares(ident='DT53', material=SATIN):
    """Bolt-on satin flares round all four wheel arches.

    For each arch the lip is found by walking outward from the hub at every
    angle until the ray from outside lands on a body panel. The flare is a
    closed section laid over that lip: it starts on the panel 40 mm outside
    the lip, swells 30 mm proud and returns 3 mm inside it, tapering to
    nothing at hub height front and rear.
    """
    coll = m.start_mod(k.GEN, ident)
    hub_y = cfg()['hub_y']
    for side, names in cfg()['body'].items():
        parts = [k.base(n) for n in names]
        axis = Vector((side, 0, 0))
        for arch, hz in cfg()['arches'].items():
            stations = []
            a0, a1 = cfg()['arc']
            for i in range(37):
                deg = a0 + (a1 - a0) * i / 36
                th = math.radians(deg)
                d = Vector((0, math.sin(th), math.cos(th)))
                lip = None
                for r in range(280, 480, 2):
                    p, _ = hit_any(parts, (k.CX + side * 1300, hub_y + r * d.y, hz + r * d.z), (-side, 0, 0))
                    if p is not None and abs(p.x - k.CX) > 680:
                        lip = r
                        break
                assert lip is not None, (side, arch, deg)
                stations.append((deg, d, lip))
            lips = k.gaussian([s[2] for s in stations], 1.5)
            rings = []
            for (deg, d, _), lip in zip(stations, lips):
                t = (deg - a0) / (a1 - a0)
                end = k.smooth(min(t, 1 - t) / 0.18)
                proud = 3 + 27 * end

                def surf(r):
                    # Below the bumper line the panel can end before r; walk
                    # back toward the lip until there is skin to sit on.
                    for rr in range(int(r), int(lip) - 1, -2):
                        p, _ = hit_any(parts, (k.CX + side * 1300, hub_y + rr * d.y, hz + rr * d.z), (-side, 0, 0))
                        if p is not None and abs(p.x - k.CX) > 680:
                            return p
                    return None

                base = surf(lip + 40)
                rim = surf(lip + 2)
                assert base is not None and rim is not None, (arch, deg)
                section = [(40, 0.6), (34, 0.3 * proud + 1), (22, 0.75 * proud), (9, proud),
                           (0, proud), (-3, proud * 0.85), (-3, proud * 0.45), (2, 1.0)]
                ring = []
                for dr, dx in section:
                    r = lip + dr
                    ref = base if dr >= 20 else rim
                    ring.append((ref.x + side * dx, hub_y + r * d.y, hz + r * d.z))
                rings.append(ring)
            k.mesh_object(name(ident, f'{arch}_{"L" if side > 0 else "R"}'), rings, coll, material)
    return k.finish(coll)


# ---------------------------------------------------------- rear diffusers ----

#: Every ND exhaust option's tips sit within these |x| bounds, 159-283 mm up
#: and back to z -1892, so the diffuser leaves both zones open.
EXHAUST_ZONE = (176.0, 400.0)
REAR_PARTS = ('BumperR 6.001_146', 'BumperR 6_145', 'BumperR 6.002_147')

DIFFUSERS = {
    # ident: (material, strake depth, fore reach, rear overhang, centre strakes, outer strakes)
    'RA04': (SATIN, 28.0, 70.0, 16.0, (-105.0, 0.0, 105.0), (470.0, 550.0)),
    'RA04B': (CARBON, 44.0, 95.0, 30.0, (-124.0, -62.0, 0.0, 62.0, 124.0), (450.0, 520.0, 585.0)),
}


def rear_diffuser(ident='RA04'):
    """A three-piece rear diffuser fitted under the bumper's lower edge.

    The rear bumper bottoms out at 245 mm on the centreline and sweeps up and
    forward to 210 mm at its corners. A blade follows that edge, tucked under
    the skin and overhanging it slightly, with strakes hanging below. It is
    split into a centre section and two outer sections, so that whichever
    exhaust is fitted, its tips sit in an open window either side. RA04 is
    the restrained satin version; RA04B is deeper, longer and carbon.
    """
    material, depth, reach, overhang, centre, outer = DIFFUSERS[ident]
    coll = m.start_mod(k.GEN, ident)
    parts = [k.base(n) for n in REAR_PARTS]

    def first(origin, d):
        p, _ = hit_any(parts, origin, d)
        return p

    lo, hi = EXHAUST_ZONE
    pieces = {'centre': (-lo + 6, lo - 6), 'outer_L': (hi + 5, 600.0), 'outer_R': (-600.0, -hi - 5)}
    rows_by_piece = {}
    for label, (x0, x1) in pieces.items():
        count = 41
        xs = [x0 + (x1 - x0) * i / (count - 1) for i in range(count)]
        bottoms, faces = [], []
        for x in xs:
            bottom = next(y for y in range(140, 420) if first((x, y, -2600), (0, 0, 1)))
            bottoms.append(bottom)
            faces.append(first((x, bottom + 3, -2600), (0, 0, 1)).z)
        bottoms, faces = k.gaussian(bottoms, 2), k.gaussian(faces, 2)
        rings, rows = [], []
        for i, (x, bottom, face) in enumerate(zip(xs, bottoms, faces)):
            end = k.smooth(min(i, count - 1 - i) / 6)
            y = bottom - k.GAP
            thick = 2.5 + 2.5 * end
            rear = face - overhang * end
            fore = face + reach * (0.5 + 0.5 * end)
            rows.append((x, y - thick, fore, rear))
            rings.append([(x, y, fore), (x, y, rear + 3), (x, y - thick * 0.5, rear),
                          (x, y - thick, rear + 3), (x, y - thick, fore)])
        k.mesh_object(name(ident, f'blade_{label}'), rings, coll, material)
        rows_by_piece[label] = rows

    def strake(label, x, rows):
        _, y, fore, rear = min(rows, key=lambda r: abs(r[0] - x))
        y += 0.5
        ring_list = []
        for j in range(17):
            t = j / 16
            z = fore - 10 - (fore - 10 - rear - 4) * t
            d = 4 + (depth - 4) * k.smooth(t)
            ring_list.append([(x - 2, y + 1, z), (x + 2, y + 1, z), (x + 2, y - d, z), (x - 2, y - d, z)])
        k.mesh_object(name(ident, f'strake_{label}'), ring_list, coll, material)

    for n, x in enumerate(centre):
        strake(f'c{n}', x, rows_by_piece['centre'])
    for n, x in enumerate(outer):
        strake(f'L{n}', x, rows_by_piece['outer_L'])
        strake(f'R{n}', -x, rows_by_piece['outer_R'])
    return k.finish(coll)


# ---------------------------------------------------------- rear tow strap ----

def rear_strap(ident='DT08'):
    """A red webbing loop hanging from the rear bumper's lower edge."""
    coll = m.start_mod(k.GEN, ident)
    parts = [k.base(n) for n in cfg()['rear_bumper']]
    x = k.CX + cfg()['strap_x']
    bottom = next(y for y in range(150, 420) if hit_any(parts, (x, y, -2600), (0, 0, 1))[0] is not None)
    face, _ = hit_any(parts, (x, bottom + 12, -2600), (0, 0, 1))
    zc, yc = face.z - 18, bottom - 30.0
    rings = []
    for i in range(49):
        a = 2 * math.pi * i / 48
        y = yc + 50 * math.cos(a)
        z = zc - 15 * math.sin(a)
        nrm = Vector((0, 15 * math.cos(a), -50 * math.sin(a))).normalized()
        rings.append([(x - 18, y + nrm.y * 1.2, z + nrm.z * 1.2), (x + 18, y + nrm.y * 1.2, z + nrm.z * 1.2),
                      (x + 18, y - nrm.y * 1.2, z - nrm.z * 1.2), (x - 18, y - nrm.y * 1.2, z - nrm.z * 1.2)])
    k.mesh_object(name(ident, 'webbing'), rings[:-1], coll, ACCENT)
    k.cylinder('bracket', coll, (x, bottom + 12, face.z + 4), 'z', 8, -26, SATIN, 16)
    k.cylinder('bolt', coll, (x, bottom + 12, face.z - 22), 'z', 9, -5, ALLOY, 6)
    return k.finish(coll)


# ------------------------------------------------------- racing fuel cap ----


def fuel_cap(ident='DT54'):
    """An alloy racing filler cap over the fuel filler (GEN_CFG 'fuel').

    On the ND the door is the round panel on the left rear quarter, about 180 mm
    across on a sloping, curved surface. The bezel ring is laid out in that
    surface's plane and fitted to it point by point; the flat chrome lid then sits just clear of the
    panel's highest point beneath it, with a dark centre badge and a hinge.
    """
    coll = m.start_mod(k.GEN, ident)
    part, side, cy, cz = cfg()['fuel']
    quarter = k.base(part)
    axis = Vector((side, 0, 0))

    def on(y, z):
        p, n = k.ray_normal(quarter, (k.CX + side * 1300, y, z), (-side, 0, 0))
        assert p is not None, (y, z)
        return p, outward(n, axis)

    centre, n = on(cy, cz)
    # The door is a circle in the panel's own (sloping) plane, so lay points
    # out in that plane and drop each back onto the surface along the normal.
    u = Vector((0, 0, 1)) - n * n.z
    u.normalize()
    v = n.cross(u).normalized()

    def at(radius, t):
        q = centre + (u * math.cos(t) + v * math.sin(t)) * radius
        p, nn = k.ray_normal(quarter, tuple(q + n * 60), tuple(-n))
        assert p is not None, (radius, t)
        return p, outward(nn, axis)

    # Bezel: a ring following the panel, 76-92 mm radius, covering the door's
    # shut line, 3 mm proud.
    rows = []
    for i in range(73):
        t = 2 * math.pi * i / 72
        rows.append([at(r_, t) for r_ in (76.0, 84.0, 92.0)])
    film(name(ident, 'bezel'), coll, rows, 0.8, 3.0, ALLOY)

    # Lid: flat, on the door's normal, lifted clear of the curved panel.
    clearance = max((at(r_, t)[0] - centre).dot(n)
                    for r_ in (0.0, 37.0, 74.0) for t in (2 * math.pi * j / 16 for j in range(16)))
    base = centre + n * (clearance + 2.0)

    def disc(label, radius, lift, thick, material, segments=48):
        rings = []
        for h in (lift, lift + thick):
            rings.append([tuple(base + n * h + (u * math.cos(t) + v * math.sin(t)) * radius)
                          for t in (2 * math.pi * j / segments for j in range(segments))])
        k.mesh_object(name(ident, label), rings, coll, material)

    disc('lid', 74, 0.0, 5.0, CHROME)
    disc('badge', 28, 5.0, 1.0, SATIN, 32)
    hinge = base + n * 3 + u * 82
    k.box('hinge', coll, tuple(hinge), (12, 14, 18), ALLOY, 1.5)
    return k.finish(coll)
