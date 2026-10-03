"""Round-five parts: shift knobs, cabin and nose accessories, decals, wheels.

Built on na_kit's helpers for whichever car `na_kit.use(gen)` points at,
except the two wheel faces, which are authored on the ND's front-left wheel
like every other wheel style and shared with the NA. Dimensions are
app-space millimetres. Each part follows a real accessory type (a weighted
ball knob, a rally lamp, a pepperpot alloy) without copying a product.
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
TITANIUM = k.TITANIUM
WOOD = 'MOD_Wood'
RUBBER = 'MOD_Rubber'
GLASS = 'MOD_Glass'
WHITE = 'MOD_StripeWhite'


def name(ident, part):
    return x.name(ident, part)


UP = Vector((0, 1, 0))


def spun(label, coll, centre, axis, profile, material, segments=40):
    """A body of revolution about `axis` through `centre`; profile is a
    closed loop of (along, radius)."""
    u, v, a = p4.frame(axis) if abs(Vector(axis).x) < 0.9 else (Vector((0, 1, 0)), Vector((0, 0, 1)), Vector(axis))
    return p4.ring_loft(label, coll, Vector(centre), u, v, a, profile, material, segments)


#: Per-car cabin and body positions, measured by ray-casting the references.
CFG = {
    'nd': {
        # Shift knob: knob centre, top of the boot, nodes to hide. The ND's
        # knob is part of its cabin tub, so the new knob encloses it instead.
        'knob': ((-2.0, 628.0, -14.0), 582.0, []),
        # Extinguisher: centre x, floor y, z in front of the passenger seat.
        'extinguisher': (-345.0, 265.0, 45.0, 'M_Interior_Max_19'),
        # Rally lamps: x either side of centre, lamp centre height, stalk
        # foot height on the bumper face, bumper parts.
        'lamps': (330.0, 445.0, 375.0, ('BumperF 6.002_110', 'BumperF 6.003_111', 'BumperF 6.005_113')),
        # Roundels: door node per side, centre z and y, radius.
        'roundel': ({1: 'DoorL 6.003_68', -1: 'DoorR 6.003_73'}, -150.0, 540.0, 150.0),
    },
    'na': {
        'knob': ((31.5, 478.0, 116.0), 432.0, ['Cylinder016_Material #163_0']),
        'extinguisher': (-376.0, 266.0, 95.0, 'Plane008_Material #170_0'),
        'lamps': (330.0, 490.0, 452.0, ('frontbumper_Material #71_0',)),
        'roundel': ({1: 'leftdoor_Material #71_0', -1: 'rigthdoor_Material #71_0'}, -20.0, 510.0, 150.0),
    },
}


def cfg():
    return CFG[k.GEN]


# -------------------------------------------------------------- shift knobs ----

KNOBS = {
    # ident: (knob material, collar material, shape)
    'GK01': (ALLOY, SATIN, 'ball'),
    'GK02': (WOOD, CHROME, 'ball'),
    'GK03': (TITANIUM, SATIN, 'tall'),
    'GK04': (WHITE, CHROME, 'ball'),
}


def shift_knob(ident='GK01'):
    """An aftermarket gear knob on a short collar.

    The ND's stock knob is moulded into its cabin mesh, so on the ND the
    new knob is sized to swallow it (27 mm ball radius against the stock
    knob's 23 mm); on the NA the stock knob and lever are one node, which is
    hidden, and the new knob stands on its own lever out of the boot.
    """
    knob_mat, collar_mat, shape = KNOBS[ident]
    coll = m.start_mod(k.GEN, ident)
    (cx, cy, cz), boot_y, _ = cfg()['knob']
    centre = Vector((cx, cy, cz))
    if shape == 'ball':
        # A sphere, as a closed profile pole to pole.
        prof = [(-27 * math.cos(math.radians(a)), max(1.5, 27 * math.sin(math.radians(a))))
                for a in range(0, 181, 6)]
        spun(name(ident, 'knob'), coll, centre, UP, prof, knob_mat, 40)
        collar_top = cy - 21
    else:
        # Tall cylinder with a domed top and a slight waist.
        base = cy - 30
        prof = [(0, 1.5), (0, 22), (6, 24), (30, 25), (52, 26)]
        prof += [(52 + 12 * math.sin(math.radians(a)), max(1.5, 26 * math.cos(math.radians(a))))
                 for a in range(10, 91, 10)]
        spun(name(ident, 'knob'), coll, (cx, base, cz), UP, prof, knob_mat, 40)
        collar_top = base + 2
    # Collar down into the boot (and lever, on the NA).
    shaft = [(0, 1.5), (0, 19), (6, 18.5), (collar_top - boot_y - 4, 16), (collar_top - boot_y, 17),
             (collar_top - boot_y, 1.5)]
    spun(name(ident, 'collar'), coll, (cx, boot_y, cz), UP, shaft, collar_mat, 32)
    return k.finish(coll)


# ---------------------------------------------------------- fire extinguisher ----

def fire_extinguisher(ident='FX01'):
    """A 1 kg extinguisher on a quick-release floor bracket, lying across the
    passenger footwell just ahead of the seat, as fitted for track days."""
    coll = m.start_mod(k.GEN, ident)
    xc, floor, zc, _ = cfg()['extinguisher']
    r = 42.0
    yc = floor + 14 + r
    body = [(0, 1.5), (0, 30), (8, 40), (18, r), (250, r), (262, 38), (272, 28), (276, 1.5)]
    x0 = xc - 140
    spun(name(ident, 'body'), coll, (x0, yc, zc), (1, 0, 0), body, ACCENT, 40)
    # Valve head, handle and gauge at the outboard end.
    spun(name(ident, 'valve'), coll, (x0 + 276, yc, zc), (1, 0, 0),
         [(-2, 1.5), (-2, 16), (30, 16), (34, 13), (34, 1.5)], CHROME, 24)
    p4.bar(name(ident, 'handle'), coll, (x0 + 290, yc + 14, zc), (x0 + 330, yc + 24, zc), 18, 5, UP, SATIN)
    spun(name(ident, 'gauge'), coll, (x0 + 296, yc, zc + 16), (0, 0, 1),
         [(0, 1.5), (0, 11), (6, 11), (7, 9), (7, 1.5)], CHROME, 24)
    # Two straps over the body and a base plate on the floor.
    for n, dx in enumerate((70.0, 200.0)):
        prof = [(-12, r + 0.5), (-12, r + 3.5), (12, r + 3.5), (12, r + 0.5)]
        spun(name(ident, f'strap_{n}'), coll, (x0 + dx, yc, zc), (1, 0, 0), prof, SATIN, 40)
    k.box(name(ident, 'bracket'), coll, (x0 + 135, floor + 6, zc), (300, 10, 80), ALLOY, 2)
    for dx in (70.0, 200.0):
        k.box(name(ident, f'post_{int(dx)}'), coll, (x0 + dx, floor + 12, zc), (24, 18, 70), SATIN, 2)
    return k.finish(coll)


# ------------------------------------------------------------ rally lamps ----

def rally_lamps(ident='DL01', covered=False):
    """A pair of round 150 mm driving lamps on stalks in front of the bumper.

    Black housings with chrome bezels, a clear lens over a chrome reflector,
    each on a short stalk bolted to the bumper face.
    """
    coll = m.start_mod(k.GEN, ident)
    half, yc, foot_y, parts = cfg()['lamps']
    parts = [k.base(n) for n in parts]
    for side in (1, -1):
        tag = 'L' if side > 0 else 'R'
        xc = k.CX + side * half
        face, _ = x.hit_any(parts, (xc, foot_y, 3000), (0, 0, -1))
        assert face is not None, (tag, xc)
        zb = face.z + 62
        # Housing: a deep can, rounded at the back.
        spun(name(ident, f'housing_{tag}'), coll, (xc, yc, zb), (0, 0, 1),
             [(-58, 1.5), (-58, 50), (-50, 66), (-30, 75), (0, 77), (0, 1.5)], SATIN, 40)
        spun(name(ident, f'reflector_{tag}'), coll, (xc, yc, zb), (0, 0, 1),
             [(-2, 1.5), (-2, 70), (2, 70), (2, 1.5)], CHROME, 40)
        if covered:
            # Push-on stone-guard covers in the accent colour, as used by day.
            spun(name(ident, f'cover_{tag}'), coll, (xc, yc, zb), (0, 0, 1),
                 [(2, 1.5), (2, 73), (10, 73), (16, 64), (19, 40), (20, 1.5)], ACCENT, 40)
        else:
            spun(name(ident, f'lens_{tag}'), coll, (xc, yc, zb), (0, 0, 1),
                 [(2, 1.5), (2, 71), (8, 70), (12, 60), (14, 1.5)], GLASS, 40)
        spun(name(ident, f'bezel_{tag}'), coll, (xc, yc, zb), (0, 0, 1),
             [(-2, 70), (-2, 80), (6, 80), (10, 76), (10, 71), (4, 72)], CHROME, 40)
        # Stalk from under the housing back to the bumper face.
        foot = face
        k.tube(f'stalk_{tag}', coll, [(xc, yc - 60, zb - 30), (xc, (yc - 60 + foot_y) / 2, (zb - 30 + foot.z) / 2),
                                      (xc, foot_y, foot.z - 4)], 9, SATIN, 12)
        k.cylinder(f'foot_{tag}', coll, (xc, foot_y, foot.z - 6), 'z', 16, 8, SATIN, 16)
    return k.finish(coll)


# ----------------------------------------------------------------- roundels ----

def roundels(ident='RN01', material=WHITE, plate=None):
    """Vintage-racing number roundels: a 300 mm disc on each door.

    Laid on the door like the stripes, as a thin film fitted point by point
    (a square grid mapped onto the disc, so the slab stays closed)."""
    coll = m.start_mod(k.GEN, ident)
    doors, zc, yc, radius = cfg()['roundel']
    # `plate` = (width, height): a rally door plate, a rounded rectangle,
    # instead of the disc.
    half_z, half_y = (plate[0] / 2, plate[1] / 2) if plate else (radius, radius)
    for side, part in doors.items():
        door = k.base(part)
        axis = Vector((side, 0, 0))
        rows = []
        n = 25
        for i in range(n):
            row = []
            u = -1 + 2 * i / (n - 1)
            for j in range(n):
                v = -1 + 2 * j / (n - 1)
                disc_u = u * math.sqrt(max(0.0, 1 - v * v / 2))
                disc_v = v * math.sqrt(max(0.0, 1 - u * u / 2))
                if plate:
                    # Mostly square, with a little of the disc for round corners.
                    disc_u, disc_v = u + (disc_u - u) * 0.25, v + (disc_v - v) * 0.25
                dz, dy = half_z * disc_u, half_y * disc_v
                hit = k.ray(door, (k.CX + side * 1300, yc + dy, zc + dz), (-side, 0, 0))
                assert hit is not None, (side, dz, dy)
                row.append(hit)
            rows.append(row)
        # The NA door has a seam that steps the surface; take the outermost
        # hit among neighbours so the film bridges it, and lift along the
        # side axis (the doors are near vertical over a 300 mm disc).
        bridged = []
        for i in range(n):
            row = []
            for j in range(n):
                near = [rows[a][b].x for a in range(max(0, i - 2), min(n, i + 3))
                        for b in range(max(0, j - 2), min(n, j + 3))]
                q = rows[i][j].copy()
                q.x = max(near) if side > 0 else min(near)
                row.append((q, axis))
            bridged.append(row if side > 0 else list(reversed(row)))
        rows = bridged
        # 1.2 mm clear: the NA door has a crease that a 0.6 mm film rides into.
        x.film(name(ident, f'disc_{"L" if side > 0 else "R"}'), coll, rows, 1.2, 0.4, material)
    return k.finish(coll)


# ----------------------------------------------------------- offset stripe ----

def offset_stripe(ident='DT62', material=WHITE):
    """A single 240 mm stripe over bonnet and boot, offset to the driver's
    side as on period endurance racers."""
    coll = m.start_mod(k.GEN, ident)
    for panel_name, tag in x.cfg()['stripe_panels']:
        panel = k.base(panel_name)
        # Rows only where both stripe edges land on the panel (the boot
        # narrows toward its rear edge).
        zs = [z for z in range(-2000, 2000, 4)
              if all(k.ray(panel, (k.CX + xe, 2000, z), (0, -1, 0)) for xe in (60, 180, 300))]
        z_front, z_back = max(zs) - 14, min(zs) + 14
        rows = []
        for i in range(61):
            z = z_front - (z_front - z_back) * i / 60
            row = []
            for j in range(7):
                xx = k.CX + 60 + 240 * j / 6
                hit, nrm = k.ray_normal(panel, (xx, 2000, z), (0, -1, 0))
                assert hit is not None, (tag, xx, z)
                row.append((hit, x.outward(nrm, UP)))
            rows.append(row)
        x.film(name(ident, tag), coll, rows, 0.6, 0.4, material)
    return k.finish(coll)


# ------------------------------------------------------------ carbon boot lid ----

def carbon_boot_lid(ident='BP42'):
    """A carbon replacement boot lid for the NA, derived from the stock lid's
    surface (like HD40), 2 mm thick behind the original outer surface so
    anything laid on the lid still sits on it."""
    coll = m.start_mod(k.GEN, ident)
    panel = m.panel_from_base('trunk_Material #71_0', name(ident, 'panel'), coll, gen=k.GEN)
    k.surface_material(panel, CARBON)
    m.clean(panel)
    m.solidify(panel, 2.0, gen=k.GEN, offset=-1.0)
    for f in panel.data.polygons:
        f.use_smooth = True
    m.box_uv(panel, scale=0.05)
    return k.finish(coll, closed=False)


# ------------------------------------------------------------------- wheels ----

def wheel(ident):
    """Two classic alloy faces on the shared tyre, barrel and brake set.

    W12 is an eight-spoke (spokes flaring into the rim, arched windows, a
    polished step lip); W13 a pepperpot disc with eight large and eight
    small round windows. Authored on the ND front-left wheel like W10/W11.
    """
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

    def face_x(r):
        return 44 + 44 * max(0.0, (r - 63) / 184) ** 1.65

    if ident == 'W12':
        for i in range(8):
            a = 2 * math.pi * i / 8
            rings = []
            for j in range(25):
                t = j / 24
                r = 61 + 188 * t
                # Even spokes with filleted ends, so each window is a
                # rounded trapezoid: flared into the centre ring and the rim.
                inner = max(0.0, (0.28 - t) / 0.28)
                outer = max(0.0, (t - 0.78) / 0.22)
                width = 34 + 8 * t + 46 * inner ** 2 + 64 * outer ** 2
                xx = face_x(r)
                section = [(-15, -width / 2 + 3), (-12, -width / 2), (-3, -width / 2), (0, -width / 2 + 3),
                           (0, width / 2 - 3), (-3, width / 2), (-12, width / 2), (-15, width / 2 - 3)]
                rings.append([(axle[0] + xx + dx, axle[1] + r * math.cos(a) - s * math.sin(a),
                               axle[2] + r * math.sin(a) + s * math.cos(a)) for dx, s in section])
            sk.mesh_object(f'spoke_{i}', rings, coll, 'MOD_Rim')
        d.lathe('polished_lip', coll, [(96, 250), (99, 253), (99, 256), (96, 258), (94, 256), (94, 251)],
                axle, 'MOD_Chrome', 'x', 80)
        # Centre ring the spokes grow out of, around the hub and cap.
        d.lathe('centre_ring', coll, [(face_x(66) - 15, 64), (face_x(66) + 1, 64), (face_x(110) + 1, 112),
                                      (face_x(110) - 15, 112)], axle, 'MOD_Rim', 'x', 64)
    else:
        front = [(face_x(r), r) for r in range(66, 248, 6)]
        prof = front + [(px - 12, r) for px, r in reversed(front)]
        disc = d.lathe('disc_face', coll, prof, axle, 'MOD_Rim', 'x', 72)
        k.use('nd')
        cutters = []
        for i in range(8):
            for radius, rr, offset in ((168.0, 40.0, 0.0), (106.0, 15.0, math.pi / 8)):
                a = 2 * math.pi * i / 8 + offset
                c = k.cylinder(f'_cut_{i}_{int(radius)}', coll,
                               (axle[0] - 40, axle[1] + radius * math.cos(a), axle[2] + radius * math.sin(a)),
                               'x', rr, 180, 'MOD_Rim', 24 if rr > 20 else 12)
                cutters.append(c)
        for c in cutters:
            m.boolean(disc, c)
        for c in cutters:
            bpy.data.objects.remove(c, do_unlink=True)
        d.lathe('polished_lip', coll, [(96, 250), (99, 253), (99, 256), (96, 258), (94, 256), (94, 251)],
                axle, 'MOD_Chrome', 'x', 80)
    angle = .55
    d.lathe('valve', coll, [(0, 0), (0, 4), (15, 4), (17, 3), (17, 0)],
            (axle[0] + 83, axle[1] + 230 * math.cos(angle), axle[2] + 230 * math.sin(angle)), d.SATIN, 'x', 12)
    return d.finish(coll)
