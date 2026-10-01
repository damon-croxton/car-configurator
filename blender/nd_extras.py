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
    return f'MOD_ND_{ident}_{part}'


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
    coll = m.start_mod('nd', ident)
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

def racing_stripes(ident='DT43'):
    """Twin white stripes over the bonnet and boot lid.

    Two 110 mm stripes either side of a 40 mm gap, laid on each panel from
    its front edge to its back edge, 0.4 mm thick and 0.6 mm clear.
    """
    coll = m.start_mod('nd', ident)
    up = Vector((0, 1, 0))
    for panel_name, tag in (('Hood 6.001_120', 'bonnet'), ('Boot 6.001_157', 'boot')):
        panel = k.base(panel_name)
        zs = [z for z in range(-2000, 2000, 4) if k.ray(panel, (75, 2000, z), (0, -1, 0))]
        z_front, z_back = max(zs) - 14, min(zs) + 14
        for side in (-1, 1):
            rows = []
            for i in range(61):
                z = z_front - (z_front - z_back) * i / 60
                row = []
                for j in range(5):
                    x = side * (20 + 110 * j / 4)
                    p, n = k.ray_normal(panel, (x, 2000, z), (0, -1, 0))
                    assert p is not None, (tag, x, z)
                    row.append((p, outward(n, up)))
                rows.append(row if side > 0 else list(reversed(row)))
            film(name(ident, f'{tag}_{"L" if side > 0 else "R"}'), coll, rows, 0.6, 0.4, WHITE)
    return k.finish(coll)


# ------------------------------------------------------------- side stripes ----

SIDE_PANELS = {
    1: ('FenderFL 6.002_88', 'DoorL 6.003_68', 'FendersR 6.001_40'),
    -1: ('FenderFR 6.001_80', 'DoorR 6.003_73', 'FendersR 6.001_40'),
}


def side_stripes(ident='DT44'):
    """A 22 mm white stripe along each flank, between the wheel arches.

    It runs at 430-452 mm, across front fender, door and rear quarter.
    """
    coll = m.start_mod('nd', ident)
    for side, names in SIDE_PANELS.items():
        parts = [k.base(n) for n in names]
        axis = Vector((side, 0, 0))
        rows = []
        for i in range(121):
            z = 818 - (818 + 735) * i / 120
            row = []
            for j in range(4):
                y = 430 + 22 * j / 3
                p, n = None, None
                # Panel shut lines are real gaps: step along until a ray lands.
                for dz in (0, 2, -2, 4, -4, 6, -6, 9, -9):
                    p, n = hit_any(parts, (side * 1300, y, z + dz), (-side, 0, 0))
                    if p is not None:
                        p = Vector((p.x, p.y, z))
                        break
                assert p is not None, (side, y, z)
                row.append((p, outward(n, axis)))
            rows.append(row if side > 0 else list(reversed(row)))
        film(name(ident, f'stripe_{"L" if side > 0 else "R"}'), coll, rows, 0.6, 0.4, WHITE)
    return k.finish(coll)


# -------------------------------------------------------------- boot rack ----

def boot_rack(ident='DT45'):
    """A chrome luggage rack on the boot lid: two rails, three crossbars.

    The rails follow the lid's slope 45 mm above it, bent down at each end
    into round feet on rubber pads.
    """
    coll = m.start_mod('nd', ident)
    boot = k.base('Boot 6.001_157')

    def deck(x, z):
        p = k.ray(boot, (x, 2000, z), (0, -1, 0))
        assert p is not None, (x, z)
        return p.y

    z0, z1, rise = -1420.0, -1760.0, 45.0
    for side in (-1, 1):
        x = side * 330
        path = [(x, deck(x, z0) + 6, z0 + 6)]
        for i in range(9):
            z = z0 - 22 - (z0 - z1 - 44) * i / 8
            path.append((x, deck(x, z) + rise, z))
        path.append((x, deck(x, z1) + 6, z1 - 6))
        k.tube(f'rail_{"L" if side > 0 else "R"}', coll, m.rounded_path(path, 18, 6), 7.5, CHROME, 14)
        for z in (z0 + 6, z1 - 6):
            k.cylinder(f'foot_{"L" if side > 0 else "R"}_{int(-z)}', coll, (x, deck(x, z) - 1, z), 'y', 13, 6, SATIN)
    for z in (-1470.0, -1590.0, -1710.0):
        ya, yb = deck(-330, z) + rise, deck(330, z) + rise
        k.tube(f'bar_{int(-z)}', coll, [(-330, ya, z), (330, yb, z)], 6, CHROME, 12)
    return k.finish(coll)


# ---------------------------------------------------------- wind deflector ----

def wind_deflector(ident='DT46'):
    """A mesh wind blocker between the hoop covers, behind the headrests.

    A 480 x 100 mm panel of black mesh in a satin tube frame, standing on the
    centre bulkhead at z -790 and leaning back 6 degrees.
    """
    coll = m.start_mod('nd', ident)
    z, half, y0, y1 = -790.0, 240.0, 945.0, 1035.0
    lean = math.tan(math.radians(6))

    def at(x, y):
        return (x, y, z - (y - y0) * lean)

    k.tube('frame', coll, m.rounded_path([at(-half, y0), at(-half, y1), at(half, y1), at(half, y0)], 14, 6),
           8, SATIN, 12)
    k.tube('frame_base', coll, [at(-half - 6, y0), at(half + 6, y0)], 8, SATIN, 12)
    panel = []
    for i in range(9):
        x = -half + 6 + (2 * half - 12) * i / 8
        panel.append([at(x, y0 + 4), at(x, y1 - 4),
                      (x, y1 - 4, z - (y1 - 4 - y0) * lean - 2), (x, y0 + 4, z - 4 * lean - 2)])
    k.mesh_object(name(ident, 'mesh'), panel, coll, MESH)
    for x in (-150.0, 150.0):
        k.tube(f'leg_{"L" if x > 0 else "R"}', coll, [at(x, y0), (x, y0 - 40, z + 4)], 6, SATIN, 10)
    return k.finish(coll)


# ------------------------------------------------------------- rain light ----

def rain_light(ident='DT47'):
    """An F1-style centre rain light on the rear bumper's lower panel.

    Its red lens is classed with the tail lamps, so the app's tail-light
    switch lights it too.
    """
    coll = m.start_mod('nd', ident)
    lower = k.base('BumperR 6_145')
    face = k.ray(lower, (0, 300, -2600), (0, 0, 1))
    assert face is not None
    zf = face.z
    k.box('housing', coll, (0, 304, zf - 9), (134, 38, 20), SATIN, 2)
    k.box('lens', coll, (0, 304, zf - 19.5), (118, 26, 3), LENS, 0.8)
    for x in (-50.0, 50.0):
        k.cylinder(f'bolt_{"L" if x > 0 else "R"}', coll, (x, 304, zf - 21.5), 'z', 2.6, 2, ALLOY, 10)
    return k.finish(coll)


# ------------------------------------------------------------------ vents ----

def side_vent(ident, coll, tag, part, side, z0, z1, y0, y1, slats, frame_mat):
    """A vent panel on a near-vertical side surface: frame, recess, slats.

    Laid out in (z, y) on the panel and fitted to it by sideways rays, so it
    follows the panel's curvature. Slats are rear-facing louvres.
    """
    axis = Vector((side, 0, 0))

    def on(z, y):
        p, n = k.ray_normal(part, (side * 1300, y, z), (-side, 0, 0))
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
    coll = m.start_mod('nd', ident)
    for side, part in ((1, 'FenderFL 6.002_88'), (-1, 'FenderFR 6.001_80')):
        side_vent(ident, coll, 'L' if side > 0 else 'R', k.base(part), side,
                  700.0, 520.0, 470.0, 590.0, 3, CARBON)
    return k.finish(coll)


def rear_vents(ident='DT52'):
    """Carbon two-slat vents on the rear bumper's flanks, behind the arch."""
    coll = m.start_mod('nd', ident)
    bumper = k.base('BumperR 6.001_146')
    for side in (1, -1):
        side_vent(ident, coll, 'L' if side > 0 else 'R', bumper, side,
                  -1545.0, -1635.0, 385.0, 455.0, 2, CARBON)
    return k.finish(coll)


# ------------------------------------------------------------ aero mirrors ----

MIRROR_HIDES = ['MirrorL 6.002_175', 'MirrorL 6.003_176', 'MirrorL 6.001_174', 'MirrorL 6_173',
                'MirrorR 6.001_181', 'MirrorR 6.002_182', 'MirrorR 6_180', 'MirrorR 6.003_183']


def aero_mirrors(ident='DT49'):
    """Carbon teardrop mirror heads on slim stalks, replacing the stock heads.

    The stock bases stay. Each head is a 150 mm teardrop, deeper at its
    inboard end, with the glass on its rear face.
    """
    coll = m.start_mod('nd', ident)
    for side in (1, -1):
        tag = 'L' if side > 0 else 'R'
        base_top = Vector((side * 805, 818, 100))
        head = Vector((side * 905, 876, 70))
        k.tube(f'stalk_{tag}', coll,
               [tuple(base_top + Vector((0, -6, 0))), tuple(base_top.lerp(head, 0.5) + Vector((0, 14, 0))),
                tuple(head + Vector((-side * 60, 0, 0)))], 7, CARBON, 12)
        rings = []
        for i in range(17):
            t = i / 16
            x = head.x + side * (-72 + 150 * t)
            # Teardrop in plan: fuller inboard, tapering to the tip.
            scale = math.sin(math.pi * (0.06 + 0.94 * t) ** 0.85) if t > 0 else 0.15
            a, b = 34 * scale + 2, 30 * scale + 2
            rings.append([(x, head.y + a * math.sin(u), head.z + 4 + b * math.cos(u))
                          for u in (2 * math.pi * j / 32 for j in range(32))])
        k.mesh_object(name(ident, f'head_{tag}'), rings, coll, CARBON)
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
    coll = m.start_mod('nd', ident)
    bumper = k.base('BumperR 6.001_146')
    for side in (1, -1):
        rings = []
        for i in range(25):
            t = i / 24
            z = -1680 - 150 * t
            y = 412 - 10 * t
            p, n = k.ray_normal(bumper, (side * 1300, y, z), (-side, 0, 0))
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
    coll = m.start_mod('nd', ident)
    bumper = k.base('BumperF 6.003_111')
    x = -480.0
    face = k.ray(bumper, (x, 300, 2600), (0, 0, -1))
    assert face is not None
    zc, yc = face.z + 20, 262.0
    rings = []
    for i in range(49):
        a = 2 * math.pi * i / 48
        y = yc + 50 * math.cos(a)
        z = zc + 15 * math.sin(a)
        nrm = Vector((0, 15 * math.cos(a), 50 * math.sin(a))).normalized()
        rings.append([(x - 18, y + nrm.y * 1.2, z + nrm.z * 1.2), (x + 18, y + nrm.y * 1.2, z + nrm.z * 1.2),
                      (x + 18, y - nrm.y * 1.2, z - nrm.z * 1.2), (x - 18, y - nrm.y * 1.2, z - nrm.z * 1.2)])
    k.mesh_object(name(ident, 'webbing'), rings[:-1], coll, ACCENT)
    k.cylinder('bracket', coll, (x, 309, face.z - 4), 'z', 8, 26, SATIN, 16)
    k.cylinder('bolt', coll, (x, 309, face.z + 22), 'z', 9, 5, ALLOY, 6)
    return k.finish(coll)


# ----------------------------------------------------------- fender flares ----

ARCHES = {'front': 1194.0, 'rear': -1114.0}
HUB_Y = 321.0
BODY = {1: ('FenderFL 6.002_88', 'FendersR 6.001_40', 'BumperF 6.003_111', 'BumperR 6.001_146', 'DoorL 6.003_68',
            'Skirts 6.003_57'),
        -1: ('FenderFR 6.001_80', 'FendersR 6.001_40', 'BumperF 6.003_111', 'BumperR 6.001_146', 'DoorR 6.003_73',
             'Skirts 6.003_57')}


def fender_flares(ident='DT53'):
    """Bolt-on satin flares round all four wheel arches.

    For each arch the lip is found by walking outward from the hub at every
    angle until the ray from outside lands on a body panel. The flare is a
    closed section laid over that lip: it starts on the panel 40 mm outside
    the lip, swells 30 mm proud and returns 3 mm inside it, tapering to
    nothing at hub height front and rear.
    """
    coll = m.start_mod('nd', ident)
    for side, names in BODY.items():
        parts = [k.base(n) for n in names]
        axis = Vector((side, 0, 0))
        for arch, hz in ARCHES.items():
            stations = []
            for i in range(37):
                deg = 5 + 170 * i / 36
                th = math.radians(deg)
                d = Vector((0, math.sin(th), math.cos(th)))
                lip = None
                for r in range(300, 480, 2):
                    p, _ = hit_any(parts, (side * 1300, HUB_Y + r * d.y, hz + r * d.z), (-side, 0, 0))
                    if p is not None and abs(p.x) > 700:
                        lip = r
                        break
                assert lip is not None, (side, arch, deg)
                stations.append((deg, d, lip))
            lips = k.gaussian([s[2] for s in stations], 1.5)
            rings = []
            for (deg, d, _), lip in zip(stations, lips):
                t = (deg - 5) / 170
                end = k.smooth(min(t, 1 - t) / 0.18)
                proud = 3 + 27 * end

                def surf(r):
                    # Below the bumper line the panel can end before r; walk
                    # back toward the lip until there is skin to sit on.
                    for rr in range(int(r), int(lip) - 1, -2):
                        p, _ = hit_any(parts, (side * 1300, HUB_Y + rr * d.y, hz + rr * d.z), (-side, 0, 0))
                        if p is not None and abs(p.x) > 700:
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
                    ring.append((ref.x + side * dx, HUB_Y + r * d.y, hz + r * d.z))
                rings.append(ring)
            k.mesh_object(name(ident, f'{arch}_{"L" if side > 0 else "R"}'), rings, coll, SATIN)
    return k.finish(coll)
