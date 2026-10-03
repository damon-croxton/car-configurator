"""Round-four parts: cabin replacements, NA body parts and shared details.

Built on na_kit's helpers, for whichever car `na_kit.use(gen)` points at.
Dimensions are app-space millimetres. Names follow real accessories by type
(a classic wood-rimmed three-spoke, a fixed-back bucket, a factory-style NA
hardtop); none reproduces a branded product, logo or measured design.

Every replacement here hides only whole base parts: the steering wheel and
seat meshes (the ND's seats are split out of its cabin tub at load as
`CabinSeats`, see CarModel.rebuildLining), the NA bonnet and mirrors.
"""
import math
import bpy
from mathutils import Vector
import mx5_lib as m
import na_kit as k
import nd_extras as x

SATIN, PAINT, CARBON = k.SATIN, k.PAINT, k.CARBON
ALLOY, CHROME, ACCENT, GLOSS = k.ALLOY, k.CHROME, k.ACCENT, k.GLOSS
TITANIUM = k.TITANIUM
WOOD = 'MOD_Wood'
RUBBER = 'MOD_Rubber'
MESH = 'MOD_Mesh'


def name(ident, part):
    return x.name(ident, part)


#: Per-car cabin geometry, measured from the reference meshes.
CABIN = {
    'nd': {
        # Steering wheel: rim centre, column axis (toward the dash), rim radius.
        'wheel': ((340.8, 784.1, 19.9), (0.003, -0.281, 0.960), 182.0),
        'wheel_node': 'M_Interior_Max.001_21',
        # Seats: centre x per side, floor y, cushion front z, back z, top y.
        'seats': ((345.0, -345.0), 265.0, -40.0, -700.0, 1040.0),
        'seat_hide': ['CabinSeats'],
    },
    'na': {
        'wheel': ((395.7, 712.8, 114.3), (0.0, -0.203, 0.979), 172.0),
        'wheel_node': 'steeringwheel_Material #155_0',
        'seats': ((403.0, -376.0), 262.0, 10.0, -660.0, 1020.0),
        'seat_hide': ['seats_Material #170_0'],
    },
}


def cab():
    return CABIN[k.GEN]


# ----------------------------------------------------------------- helpers ----

def frame(axis):
    """An orthonormal (u, v, a) frame: a along the column, u roughly lateral."""
    a = Vector(axis).normalized()
    u = Vector((1, 0, 0)) - a * a.x
    u.normalize()
    v = a.cross(u).normalized()
    if v.y < 0:
        v = -v
    return u, v, a


def ring_loft(label, coll, centre, u, v, a, profile, material, segments=48, squash=1.0):
    """A body of revolution about axis `a` through `centre`.

    `profile` is a closed loop of (along, radius); rings are laid out in the
    (u, v) plane, optionally squashed along v.
    """
    rings = []
    for along, rad in profile:
        base = centre + a * along
        rings.append([tuple(base + (u * math.cos(t) + v * squash * math.sin(t)) * rad)
                      for t in (2 * math.pi * j / segments for j in range(segments))])
    verts, faces = [], []
    n = len(rings)
    for ring in rings:
        verts.extend(k.to_blender(p) for p in ring)
    for i in range(n):
        j2 = (i + 1) % n
        for s in range(segments):
            t2 = (s + 1) % segments
            faces.append((i * segments + s, i * segments + t2, j2 * segments + t2, j2 * segments + s))
    data = bpy.data.meshes.new(label)
    data.from_pydata([p[:] for p in verts], [], faces)
    data.validate()
    data.update()
    obj = bpy.data.objects.new(label, data)
    coll.objects.link(obj)
    m.clean(obj)
    for f in data.polygons:
        f.use_smooth = True
    return k.surface_material(obj, material)


def torus(label, coll, centre, u, v, a, radius, tube_r, material, flat=None, segments=72, tube_segments=14):
    """A steering-wheel rim: a tube swept round the wheel's own plane.

    `flat` cuts a flat bottom at that fraction of the radius (a D-shaped,
    flat-bottom rim)."""
    verts, faces = [], []
    for i in range(segments):
        t = 2 * math.pi * i / segments
        dirn = u * math.cos(t) + v * math.sin(t)
        r = radius
        if flat is not None:
            low = -dirn.dot(v)
            if low > flat:
                r = radius * flat / max(low, 1e-6)
        c = centre + dirn * r
        for j in range(tube_segments):
            s = 2 * math.pi * j / tube_segments
            p = c + (dirn * math.cos(s) + a * math.sin(s)) * tube_r
            verts.append(k.to_blender(tuple(p)))
    for i in range(segments):
        i2 = (i + 1) % segments
        for j in range(tube_segments):
            j2 = (j + 1) % tube_segments
            # Wound so normals face out of the tube (positive volume).
            faces.append((i * tube_segments + j, i2 * tube_segments + j,
                          i2 * tube_segments + j2, i * tube_segments + j2))
    data = bpy.data.meshes.new(label)
    data.from_pydata([p[:] for p in verts], [], faces)
    data.validate()
    data.update()
    obj = bpy.data.objects.new(label, data)
    coll.objects.link(obj)
    for f in data.polygons:
        f.use_smooth = True
    m.box_uv(obj, scale=0.05)
    return k.surface_material(obj, material)


def bar(label, coll, p0, p1, width, thick, normal, material):
    """A flat bar from p0 to p1, `width` across, `thick` along `normal`."""
    p0, p1, n = Vector(p0), Vector(p1), Vector(normal).normalized()
    d = (p1 - p0).normalized()
    side = d.cross(n).normalized()
    rings = []
    for p in (p0, p1):
        rings.append([tuple(p + side * w + n * h) for w, h in
                      ((-width / 2, -thick / 2), (width / 2, -thick / 2), (width / 2, thick / 2), (-width / 2, thick / 2))])
    return k.mesh_object(label, rings, coll, material)


# ---------------------------------------------------------- steering wheels ----

WHEELS = {
    # ident: (rim material, spoke material, dish mm, rim tube radius, flat-bottom, spoke style, label)
    'SW01': (WOOD, CHROME, 22.0, 13.0, None, 'slotted', 'Classic wood three-spoke'),
    'SW02': (SATIN, SATIN, 78.0, 15.0, None, 'dished', 'Deep-dish suede'),
    'SW03': (RUBBER, SATIN, 30.0, 16.0, 0.80, 'sport', 'Flat-bottom leather sport'),
    'SW04': (SATIN, ALLOY, 48.0, 15.5, None, 'race', 'Quick-release race wheel'),
}


def steering_wheel(ident='SW01'):
    """An aftermarket wheel on the OEM column, replacing the stock wheel.

    The rim sits where the stock rim was (same plane, same driver reach);
    a dished wheel moves its hub forward toward the column instead. Three
    spokes at 3, 9 and 6 o'clock, a boss down the column and a horn button.
    """
    rim_mat, spoke_mat, dish, tube_r, flat, style, _ = WHEELS[ident]
    coll = m.start_mod(k.GEN, ident)
    (cx, cy, cz), axis, radius = cab()['wheel']
    centre = Vector((cx, cy, cz))
    u, v, a = frame(axis)
    radius = radius - 4
    torus(name(ident, 'rim'), coll, centre, u, v, a, radius, tube_r, rim_mat, flat=flat)
    hub = centre + a * dish
    for n, ang in enumerate((0.0, math.pi, -math.pi / 2)):
        dirn = u * math.cos(ang) + v * math.sin(ang)
        reach = radius - tube_r * 0.6
        if flat is not None and ang < 0:
            reach = radius * flat - tube_r * 0.6
        tip = centre + dirn * reach
        root = hub + dirn * 34
        if style == 'slotted':
            # Two parallel slotted alloy bars per spoke, classic style.
            for off in (-9.0, 9.0):
                side = dirn.cross(a).normalized()
                bar(name(ident, f'spoke{n}_{"a" if off < 0 else "b"}'), coll,
                    tuple(root + side * off), tuple(tip + side * off), 10, 4, a, spoke_mat)
        else:
            width = {'dished': 34, 'sport': 40, 'race': 30}[style]
            bar(name(ident, f'spoke{n}'), coll, tuple(root), tuple(tip), width, 6, a, spoke_mat)
    # Hub boss down the column, horn button facing the driver.
    ring_loft(name(ident, 'boss'), coll, hub, u, v, a,
              [(-4, 1.5), (-4, 40), (0, 46), (62, 34), (95, 30), (95, 1.5)], ALLOY if style != 'sport' else SATIN, 32)
    ring_loft(name(ident, 'horn'), coll, hub, u, v, a, [(-12, 1.5), (-12, 31), (-6, 36), (-4, 36), (-4, 1.5)],
              SATIN, 32)
    if style in ('race', 'dished'):
        # Centre marker at 12 o'clock, as on competition wheels.
        top = centre + v * radius
        ring_loft(name(ident, 'marker'), coll, top, u, v, a, [(-tube_r - 0.5, 1.5), (-tube_r - 0.5, 9),
                                                               (tube_r + 0.5, 9), (tube_r + 0.5, 1.5)], ACCENT, 16, squash=2.2)
    if style == 'race':
        # Quick-release hub between boss and column.
        ring_loft(name(ident, 'qr'), coll, hub + a * 95, u, v, a,
                  [(0, 1.5), (0, 33), (22, 33), (22, 26), (34, 26), (34, 1.5)], ACCENT, 6)
    return k.finish(coll)


# -------------------------------------------------------------- bucket seats ----

SEATS = {
    # ident: (shell, insert/cushion, headrest style, label)
    'BS01': (CARBON, SATIN, 'integrated', 'Carbon fixed-back bucket'),
    'BS02': (SATIN, RUBBER, 'separate', 'Reclining sports seat'),
}


def seat_shell(label, coll, xc, floor, front, back, top, mat, recline):
    """A one-piece seat: a cushion with raised bolsters and a reclined back.

    Both are closed lofts of U-shaped cross-sections, wider at the shoulder
    wings than at the hips, so the silhouette reads as a modern bucket.
    """
    hip_y = floor + 95
    seat_len = front - (back + 70)
    rings = []
    # Cushion: lofted front-to-rear.
    for i in range(9):
        t = i / 8
        z = front - seat_len * t
        w = 230 - 20 * t
        bol = 45 + 15 * math.sin(math.pi * t)
        y0 = floor + 30
        y1 = hip_y - 10 * t
        rings.append([(xc - w, y0, z), (xc + w, y0, z), (xc + w, y1 + bol, z), (xc + w - 50, y1 + 10, z),
                      (xc, y1, z), (xc - w + 50, y1 + 10, z), (xc - w, y1 + bol, z)])
    k.mesh_object(f'{label}_cushion', rings, coll, mat)
    # Backrest: lofted bottom-to-top, reclined.
    rings = []
    tan = math.tan(math.radians(recline))
    for i in range(11):
        t = i / 10
        y = hip_y + (top - hip_y) * t
        z = back + 40 - (y - hip_y) * tan
        w = 235 + 30 * math.sin(math.pi * min(1, t * 1.4)) - 70 * max(0, (t - 0.75) / 0.25)
        wing = 70 - 40 * t
        rings.append([(xc - w, y, z - 40), (xc + w, y, z - 40), (xc + w, y, z + wing),
                      (xc + w - 45, y, z + 10), (xc, y, z), (xc - w + 45, y, z + 10), (xc - w, y, z + wing)])
    k.mesh_object(f'{label}_back', rings, coll, mat)
    return hip_y


def bucket_seats(ident='BS01'):
    """Aftermarket seats replacing both stock seats.

    BS01 is a fixed-back carbon bucket with harness slots and a black fabric
    pad; BS02 a reclining sports seat in black fabric with a separate
    headrest on posts. Both sit on side-mount rails on the stock floor.
    """
    shell, pad, head, _ = SEATS[ident]
    coll = m.start_mod(k.GEN, ident)
    xs, floor, front, back, top = cab()['seats']
    recline = 14.0 if ident == 'BS01' else 20.0
    top_y = top if head == 'integrated' else top - 130
    for xc in xs:
        tag = 'L' if xc > 0 else 'R'
        hip_y = seat_shell(name(ident, tag), coll, xc, floor, front, back, top_y, shell, recline)
        tan = math.tan(math.radians(recline))
        # Fabric pads on the cushion and back faces.
        z_pad = back + 52
        k.box(f'pad_back_{tag}', coll, (xc, (hip_y + top_y) / 2, z_pad - ((hip_y + top_y) / 2 - hip_y) * tan + 4),
              (300, (top_y - hip_y) * 0.7, 10), pad, 3)
        k.box(f'pad_seat_{tag}', coll, (xc, hip_y + 6, (front + back + 70) / 2), (300, 10, (front - back - 70) * 0.75), pad, 3)
        if head == 'integrated':
            # Harness slots: dark recesses at shoulder height.
            for dx in (-75.0, 75.0):
                y = top_y - 130
                k.box(f'slot_{tag}{"a" if dx < 0 else "b"}', coll,
                      (xc + dx, y, back + 40 - (y - hip_y) * tan + 2), (70, 22, 8), SATIN, 2)
        else:
            y = top + 10
            zc = back + 40 - (y - hip_y) * tan
            k.box(f'headrest_{tag}', coll, (xc, y, zc + 8), (250, 150, 80), pad, 12)
            for dx in (-70.0, 70.0):
                k.tube(f'post_{tag}{"a" if dx < 0 else "b"}', coll,
                       [(xc + dx, top_y - 20, back + 40 - (top_y - 20 - hip_y) * tan + 10),
                        (xc + dx, y - 50, zc + 12)], 6, CHROME, 10)
            k.box(f'lever_{tag}', coll, (xc - 250 if xc > 0 else xc + 250, hip_y - 20, back + 60), (12, 30, 90), SATIN, 3)
        # Side-mount rails to the floor.
        for dx in (-215.0, 215.0):
            k.box(f'rail_{tag}{"a" if dx < 0 else "b"}', coll, (xc + dx, floor + 18, (front + back) / 2),
                  (14, 36, front - back - 80), ALLOY, 2)
    return k.finish(coll)


# ----------------------------------------------------------------- NA hardtop ----

def hardtop(ident='HT40', material=PAINT):
    """A factory-style removable hardtop for the NA.

    A closed shell from the windscreen header (z -20, 1125 mm) over a
    gently crowned roof to C-pillars that land on the rear deck at z -1090,
    with a dark rear window on the rear slope. The section keeps to the
    side-window line (1060 mm) until behind the headrests, then drops to
    the deck, so it clears the seats.
    """
    coll = m.start_mod(k.GEN, ident)
    CX = k.CX
    stations = []
    for i in range(31):
        t = i / 30
        z = -20 - 1070 * t
        # Roof height along the car: crown mid-roof, rear slope to the deck.
        if z > -700:
            top = 1125 + 40 * math.sin(math.pi * (z + 20) / -680 * 0.9)
        else:
            s = (z + 700) / -390
            top = 1150 - (1150 - 868) * (s ** 1.25)
        bot = 1060 if z > -720 else max(858, 1060 - (z + 720) / -100 * 200)
        bot = min(bot, top - 12)
        half_bot = 690 + 12 * t
        half_top = 560 - 40 * max(0, t - 0.6)
        stations.append((z, top, bot, half_top, half_bot))
    rings = []
    for z, top, bot, ht, hb in stations:
        ring = [(CX - hb, bot, z), (CX + hb, bot, z), (CX + hb, bot + 6, z), (CX + ht + 40, top - 30, z)]
        for j in range(1, 10):
            f = j / 10
            xx = CX + ht - 2 * ht * f
            ring.append((xx, top + 14 * math.sin(math.pi * f) - (0 if 0.1 < f < 0.9 else 6), z))
        ring += [(CX - ht - 40, top - 30, z), (CX - hb, bot + 6, z)]
        rings.append(ring)
    k.mesh_object(name(ident, 'shell'), rings, coll, material)
    # Rear window: a dark film on the rear slope, inside the C-pillars.
    rows = []
    for i in range(9):
        z = -760 - 280 * i / 8
        st = min(stations, key=lambda s_: abs(s_[0] - z))
        row = []
        for j in range(7):
            xx = CX - 420 + 840 * j / 6
            from_top = (xx, 1400, z)
            p, n = k.ray_normal(bpy.data.objects[name(ident, 'shell')], from_top, (0, -1, 0))
            if p is None:
                p, n = Vector((xx, st[1], z)), Vector((0, 1, 0))
            row.append((p, n if n.y > 0 else -n))
        rows.append(row)
    x.film(name(ident, 'rear_window'), coll, rows, 0.8, 1.2, GLOSS)
    return k.finish(coll)


# ------------------------------------------------------------- NA grille mesh ----

def grille_mesh(ident='FG40'):
    """A black mesh insert set back in the NA's front mouth."""
    coll = m.start_mod(k.GEN, ident)
    bumper = k.base('frontbumper_Material #71_0')
    rows = []
    for i in range(23):
        y = 286 + (410 - 286) * i / 22
        xs_ = [xx for xx in range(-420, 420, 3) if k.ray(bumper, (k.CX + xx, y, 2600), (0, 0, -1)) is None]
        if len(xs_) < 10:
            continue
        x0, x1 = k.CX + xs_[0] + 4, k.CX + xs_[-1] - 4
        edge = k.ray(bumper, (x0 - 8, y, 2600), (0, 0, -1))
        zf = (edge.z if edge else 1880) - 22
        rows.append([(x0 + (x1 - x0) * j / 12, y, zf) for j in range(13)])
    rings = []
    for row in rows:
        rings.append([p for p in row] + [(px, py, pz - 3) for px, py, pz in reversed(row)])
    k.mesh_object(name(ident, 'mesh'), rings, coll, MESH)
    return k.finish(coll)


# ------------------------------------------------------------- bonnet pins ----

PINS = {'nd': ('Hood 6.001_120', 525.0, 1580.0), 'na': ('hood_Material #71_0', 300.0, 1650.0)}


def bonnet_pins(ident='DT07'):
    """Two aero catches near the bonnet's front corners, with tethers."""
    coll = m.start_mod(k.GEN, ident)
    part, dx, z = PINS[k.GEN]
    hood = k.base(part)
    for side in (-1, 1):
        xx = k.CX + side * dx
        p, n = k.ray_normal(hood, (xx, 2000, z), (0, -1, 0))
        assert p is not None
        n = n if n.y > 0 else -n
        u_, v_, a_ = frame(n)
        ring_loft(name(ident, f'plate_{"L" if side > 0 else "R"}'), coll, p, u_, v_, n,
                  [(1.5, 1.5), (1.5, 23), (2, 24), (3.5, 21), (3.5, 1.5)], SATIN, 32)
        ring_loft(name(ident, f'pin_{"L" if side > 0 else "R"}'), coll, p + n * 3, u_, v_, n,
                  [(0, 1.5), (0, 4), (12, 4), (12, 1.5)], ALLOY, 16)
        ring_loft(name(ident, f'clip_{"L" if side > 0 else "R"}'), coll, p + n * 10, u_, v_, n,
                  [(0, 9), (0, 12.5), (2.4, 12.5), (2.4, 9)], ALLOY, 24)
    return k.finish(coll)


# ------------------------------------------------- quick-release fasteners ----

QR_POINTS = {
    # (part, side, y, z) on the bumper flanks: two per side at the front, one at the rear.
    'nd': [('BumperF 6.003_111', 470.0, 1560.0), ('BumperF 6.003_111', 360.0, 1600.0),
           ('BumperR 6.001_146', 430.0, -1560.0)],
    'na': [('frontbumper_Material #71_0', 470.0, 1560.0), ('frontbumper_Material #71_0', 380.0, 1600.0),
           ('rearbumper_Material #71_0', 420.0, -1520.0)],
}


def qr_fasteners(ident='DT55', material=ACCENT):
    """Anodised quick-release bumper fasteners, as on time-attack cars."""
    coll = m.start_mod(k.GEN, ident)
    n_ = 0
    for part, y, z in QR_POINTS[k.GEN]:
        obj = k.base(part)
        for side in (-1, 1):
            p, n = k.ray_normal(obj, (k.CX + side * 1300, y, z), (-side, 0, 0))
            if p is None:
                continue
            n = n if n.x * side > 0 else -n
            u_, v_, a_ = frame(n)
            tag = f'{n_}'
            ring_loft(name(ident, f'base{tag}'), coll, p, u_, v_, n,
                      [(1.5, 1.5), (1.5, 17), (2.5, 17), (3.5, 15), (3.5, 1.5)], material, 28)
            ring_loft(name(ident, f'cap{tag}'), coll, p + n * 3.5, u_, v_, n,
                      [(0, 1.5), (0, 9), (4, 9), (5, 7), (5, 1.5)], ALLOY, 20)
            n_ += 1
    return k.finish(coll)


# -------------------------------------------------------------- NA exhaust tips ----

def rolled_tip(ident='EX42'):
    """A big chrome rolled-lip single tip, sleeved like EX40."""
    coll = m.start_mod(k.GEN, ident)
    xx, yy, end, pipe = k.TIP
    r, out = 44.0, end - 30
    k.lathe('tip', coll, [
        (end + 80, pipe + 1.5), (end + 62, r - 6), (end + 50, r - 2), (out + 14, r),
        (out + 6, r + 3), (out, r + 1.5), (out, r - 3), (out + 6, r - 4.5), (end + 52, r - 5),
        (end + 66, pipe + 0.5)], (xx, yy, 0), CHROME, segments=48)
    disc = [[(xx + (r - 5.4) * math.cos(t), yy + (r - 5.4) * math.sin(t), zz)
             for t in (2 * math.pi * j / 48 for j in range(48))] for zz in (end - 3, end - 5)]
    k.mesh_object(name(ident, 'bore'), disc, coll, SATIN)
    return k.finish(coll)


def slash_tip(ident='EX43'):
    """A titanium single tip cut at 30 degrees, sleeved over the stock pipe.

    A hollow closed profile like the other tips (outer skin, rolled lip,
    inner wall), revolved about the pipe; every point behind the stock end
    is pushed back by its height, which is what cuts the slash.
    """
    coll = m.start_mod(k.GEN, ident)
    xx, yy, end, pipe = k.TIP
    r = 40.0
    cut = math.tan(math.radians(30))
    out = end - 12
    profile = [(end + 80, pipe + 1.5), (end + 60, r - 4), (end + 46, r), (out, r), (out - 2, r - 1.5),
               (out - 2, r - 4), (out, r - 5), (end + 46, r - 5), (end + 62, pipe + 0.5)]
    seg = 48
    rings = []
    for zz, rad in profile:
        ring = []
        for j in range(seg):
            t = 2 * math.pi * j / seg
            dy = rad * math.sin(t)
            z = zz if zz > end else zz - (r + dy) * cut
            ring.append(k.to_blender((xx + rad * math.cos(t), yy + dy, z)))
        rings.append(ring)
    verts = [v[:] for ring in rings for v in ring]
    faces = []
    n = len(rings)
    for i in range(n):
        i2 = (i + 1) % n
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append((i * seg + j, i * seg + j2, i2 * seg + j2, i2 * seg + j))
    data = bpy.data.meshes.new(name(ident, 'tip'))
    data.from_pydata(verts, [], faces)
    data.validate()
    data.update()
    obj = bpy.data.objects.new(name(ident, 'tip'), data)
    coll.objects.link(obj)
    m.clean(obj)
    for f in data.polygons:
        f.use_smooth = True
    k.surface_material(obj, TITANIUM)
    disc = [[(xx + (r - 6) * math.cos(t), yy + (r - 6) * math.sin(t), zz)
             for t in (2 * math.pi * j / 48 for j in range(48))] for zz in (end - 3, end - 5)]
    k.mesh_object(name(ident, 'bore'), disc, coll, SATIN)
    return k.finish(coll)


# -------------------------------------------------------------- carbon bonnet ----

def carbon_bonnet(ident='HD40'):
    """A carbon replacement bonnet for the NA, hiding the stock one.

    The panel is derived from the NA's own bonnet surface (so the shut lines
    are right by construction), given a carbon weave and 2 mm of thickness
    behind the original outer surface, so stripes, pins and vents laid on
    the bonnet still sit on it. It is recorded in ATTRIBUTION.md.
    """
    coll = m.start_mod(k.GEN, ident)
    panel = m.panel_from_base('hood_Material #71_0', name(ident, 'panel'), coll, gen=k.GEN)
    k.surface_material(panel, CARBON)
    m.clean(panel)
    m.solidify(panel, 2.0, gen=k.GEN, offset=-1.0)
    for f in panel.data.polygons:
        f.use_smooth = True
    m.box_uv(panel, scale=0.05)
    return k.finish(coll, closed=False)
