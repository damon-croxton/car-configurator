"""Independent, surface-fitted NA accessories.

Run with build_na_kit.py, or interactively in a session that has the NA
imported. Design dimensions are millimetres in the app frame. The NA asset is
only ray-cast: no vertex is copied, displaced, hidden or exported from it.

The NA is not quite centred in its own asset: wheels, bumpers and boot all
mirror about x = -8.5 mm, not 0, so symmetric parts are built about CX.
"""
import math
import bpy
import bmesh
from mathutils import Vector
import mx5_lib as m

GEN = 'na'
GAP = 0.7
CX = -8.5

#: Where each asset's centreline sits. Most of this kit is NA-only; the
#: shared accessories at the end are built for either car via `use()`.
CENTRES = {'na': -8.5, 'nd': 0.0, 'nb': 0.0, 'nc': 0.0}


def use(gen):
    """Point every helper here at one generation's reference car."""
    global GEN, CX
    GEN, CX = gen, CENTRES[gen]

SATIN = 'MOD_SatinBlack'
PAINT = 'MOD_BodyPaint'
TITANIUM = 'MOD_Titanium'
CARBON = 'MOD_CarbonWeave'
ALLOY = 'MOD_Alloy'
CHROME = 'MOD_Chrome'
ACCENT = 'MOD_AccentPaint'
GLOSS = 'MOD_GlossBlack'


# ---------------------------------------------------------------- frame ----

def app(v):
    """Raw Blender point -> app mm, unrounded (ray hits need sub-mm)."""
    s, (ox, oy, oz) = m._frame(GEN)
    k = m._yaw_sign(GEN)
    return Vector((k * v[0] * s * 1000 + ox, v[2] * s * 1000 + oy, -k * v[1] * s * 1000 + oz))


def to_blender(p):
    return m.app_to_blender(p[0], p[1], p[2], gen=GEN)


def base(name):
    """A reference part by node name. The ND wraps each mesh in an empty."""
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise KeyError(f'{name!r} is not in this scene; import the {GEN.upper()} first')
    if obj.type != 'MESH':
        kids = [c for c in obj.children_recursive if c.type == 'MESH']
        if len(kids) != 1:
            raise ValueError(f'{name!r} has {len(kids)} mesh children, expected 1')
        obj = kids[0]
    return obj


def ray(obj, origin, direction):
    inv = obj.matrix_world.inverted()
    start = to_blender(origin)
    end = to_blender(Vector(origin) + Vector(direction))
    hit, location, _, _ = obj.ray_cast(inv @ start, (inv.to_3x3() @ (end - start)).normalized())
    return app(obj.matrix_world @ location) if hit else None


def ray_normal(obj, origin, direction):
    """Like `ray`, but also the surface normal at the hit, in app axes."""
    inv = obj.matrix_world.inverted()
    start = to_blender(origin)
    end = to_blender(Vector(origin) + Vector(direction))
    hit, location, normal, _ = obj.ray_cast(inv @ start, (inv.to_3x3() @ (end - start)).normalized())
    if not hit:
        return None, None
    world_n = (obj.matrix_world.to_3x3().inverted().transposed() @ normal)
    k = m._yaw_sign(GEN)
    app_n = Vector((k * world_n.x, world_n.z, -k * world_n.y)).normalized()
    return app(obj.matrix_world @ location), app_n


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def gaussian(values, sigma):
    """Smooth a sampled rail so mesh discontinuities never reach a silhouette."""
    out = []
    reach = int(sigma * 2)
    for i in range(len(values)):
        num = den = 0.0
        for j in range(max(0, i - reach), min(len(values), i + reach + 1)):
            w = math.exp(-((j - i) / sigma) ** 2)
            num += values[j] * w
            den += w
        out.append(num / den)
    return out


# ------------------------------------------------------------- materials ----

def surface_material(obj, material):
    m.assign(obj, material)
    shader = obj.data.materials[0]
    bsdf = shader.node_tree.nodes.get('Principled BSDF')
    if material == CARBON:
        # The ND kit's baked weave, so carbon reads the same on both cars.
        import nd_street_kit
        nd_street_kit.carbon_material(shader)
    elif material == SATIN:
        # Same restrained satin as the ND kit: textured plastic, not paint.
        bsdf.inputs['Base Color'].default_value = (0.004, 0.005, 0.006, 1)
        bsdf.inputs['Metallic'].default_value = 0
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Specular IOR Level'].default_value = 0.18
    if material == 'MOD_StripeWhite':
        shader.diffuse_color = (0.8, 0.8, 0.8, 1)
        return obj
    shader.diffuse_color = (0.45, 0.008, 0.012, 1) if material == PAINT else (
        (0.3, 0.28, 0.33, 1) if material in (TITANIUM, 'MOD_Chrome', 'MOD_Alloy') else (0.022, 0.025, 0.03, 1))
    return obj


# -------------------------------------------------------------- builders ----

def mesh_object(name, rings, coll, material):
    """Closed quad loft through app-space rings, with strip UVs."""
    n = len(rings[0])
    verts = [to_blender(p) for ring in rings for p in ring]
    faces = []
    for i in range(len(rings) - 1):
        for j in range(n):
            k = (j + 1) % n
            faces.append((i * n + j, i * n + k, (i + 1) * n + k, (i + 1) * n + j))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple((len(rings) - 1) * n + j for j in range(n)))
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    surface_material(obj, material)
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    for face in data.polygons:
        face.use_smooth = len(face.vertices) == 4
    uv = data.uv_layers.new(name='UVMap')
    distances = [0.0]
    for a, b in zip(rings, rings[1:]):
        distances.append(distances[-1] + (Vector(b[0]) - Vector(a[0])).length)
    for face in data.polygons:
        if face.index < (len(rings) - 1) * n:
            i, j = divmod(face.index, n)
            u0, u1 = distances[i] / 50, distances[i + 1] / 50
            strip = j * 4.0
            v1 = strip + (Vector(rings[i][(j + 1) % n]) - Vector(rings[i][j])).length / 50
            for loop, co in zip(face.loop_indices, [(u0, strip), (u0, v1), (u1, v1), (u1, strip)]):
                uv.data[loop].uv = co
        else:
            for loop in face.loop_indices:
                p = data.vertices[data.loops[loop].vertex_index].co
                uv.data[loop].uv = (p.x * 20, p.y * 20 + n * 4 + face.index)
    return obj


def tube(name, coll, path, radius, material=SATIN, segments=16):
    return surface_material(m.sweep(name, coll, path, radius, segments=segments, gen=GEN), material)


def lathe(name, coll, profile, centre, material, segments=40, axis='z'):
    obj = m.revolve(name, coll, profile, centre, segments=segments, axis=axis, gen=GEN)
    for face in obj.data.polygons:
        face.use_smooth = True
    return surface_material(obj, material)


def box(name, coll, centre, size, material=SATIN, bevel=1.5):
    obj = m.block(name, coll, centre, size, gen=GEN)
    if bevel:
        m.bevel_smooth(obj, width=bevel / 1000 / m._frame(GEN)[0], segments=2)
    return surface_material(obj, material)


def finish(coll, closed=True):
    """Name everything to the contract and prove each part is a closed solid."""
    prefix = coll.name + '_'
    for obj in coll.objects:
        if obj.type != 'MESH':
            continue
        if not obj.name.startswith(prefix):
            obj.name = prefix + obj.name.split('.')[0]
        if not obj.data.uv_layers:
            m.box_uv(obj, scale=0.05)
    m.finalise_names(coll)
    for obj in coll.objects:
        if obj.type != 'MESH':
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bad = [e for e in bm.edges if not e.is_manifold]
        loose = [v for v in bm.verts if not v.link_faces]
        volume = bm.calc_volume(signed=True)
        bm.free()
        if closed:
            assert not bad and not loose and volume > 0, (obj.name, len(bad), len(loose), volume)
    return coll


# ------------------------------------------------------------ front lip ----

def build_front_lip(ident='FA40', material=SATIN):
    """A slim satin blade under the bumper's lower edge, corner to corner.

    The NA's bumper bottoms out at 232 mm on the centreline and sweeps up to
    320 mm round the corners, curving back hard in plan. The blade follows
    that edge (smoothed, so the fascia's facets never reach the silhouette),
    tucks a mounting flange 25 mm back under the skin, and stands up to
    28 mm proud of the face, thinning to 3 mm at each end.
    """
    coll = m.start_mod(GEN, ident)
    bumper = base('frontbumper_Material #71_0')
    half = 688.0
    count = 121
    samples = []
    for i in range(count):
        x = CX - half + 2 * half * i / (count - 1)
        bottom = next((y for y in range(200, 360) if ray(bumper, (x, y, 2600), (0, 0, -1))), None)
        assert bottom is not None, x
        face = ray(bumper, (x, bottom + 10, 2600), (0, 0, -1))
        low = ray(bumper, (x, bottom + 1, 2600), (0, 0, -1))
        samples.append((x, bottom, face.z, low.z))
    bottoms = gaussian([s[1] for s in samples], 2)
    rail = gaussian([s[2] for s in samples], 5)
    lows = gaussian([s[3] for s in samples], 5)
    rings = []
    for i, (x, _, _, _) in enumerate(samples):
        a, b = max(0, i - 1), min(count - 1, i + 1)
        normal = Vector((-(rail[b] - rail[a]), 0, samples[b][0] - samples[a][0])).normalized()
        # Ends thin out to almost nothing so they disappear under the skin
        # where the bumper's edge sweeps up, instead of stopping square.
        end = smooth(min(i, count - 1 - i) / 20)
        reach = 3 + 25 * end
        bottom = bottoms[i]
        outer = Vector((x + normal.x * reach, bottom - 1 - 6 * end, rail[i] + normal.z * reach))
        inner = Vector((x - normal.x * 25, bottom - GAP, lows[i] - normal.z * 25))
        top = []
        for t in [0, 0.15, 0.35, 0.55, 0.75, 0.9, 1]:
            p = inner.lerp(outer, t)
            # The mounting face sits just under the skin wherever there is skin.
            hit = ray(bumper, (p.x, 0, p.z), (0, 1, 0))
            if hit is not None:
                p.y = min(p.y, hit.y - GAP)
            top.append(tuple(p))
        # Rounded leading edge, then a flat closed underside.
        thick = 2.5 + 7.5 * end
        nose = Vector(top[-1])
        top.append((nose.x + normal.x * 1.5, nose.y - thick * 0.5, nose.z + normal.z * 1.5))
        underside = [(px, py - thick, pz) for px, py, pz in reversed(top[:-1])]
        rings.append(top + underside)
    mesh_object(f'MOD_NA_{ident}_blade', rings, coll, material)
    return finish(coll)


# -------------------------------------------------------- side extensions ----

def build_side_extensions(ident='RA40', material=SATIN):
    """Slim blades under the NA's black sill strip, both sides.

    The strip bottoms out at 172-176 mm with its outer face at 706-743 mm
    from the asset origin. Each blade is a ~14 mm fitted flange that steps
    out to 9-30 mm proud and drops 4-13 mm, closed underneath, tapering in
    plan and depth at both ends so it never reads as a curtain.
    """
    coll = m.start_mod(GEN, ident)
    sill = base('sideskirt_Material #118_0')
    for side in (-1, 1):
        far = CX + side * 1300

        def hit(y, z):
            return ray(sill, (far, y, z), (-side, 0, 0))

        stations = [z for z in range(-760, 860, 4) if hit(200, z)]
        z0, z1 = stations[0] + 30, stations[-1] - 12
        rings = []
        for i in range(91):
            t = i / 90
            z = z0 + (z1 - z0) * t
            bottom = next((y for y in range(150, 240) if hit(y, z)), None)
            assert bottom is not None, z

            def sx(y):
                p = hit(y, z)
                assert p is not None, (y, z)
                return abs(p.x - CX)

            end = smooth(min(t, 1 - t) / 0.09)
            reach = 8 + 20 * end
            drop = 4 + 8 * end
            top = bottom + 14
            xt, xb = sx(top), sx(bottom + 1)
            section = [
                (xt + GAP, top), (xt + GAP + 2, top + 0.4),
                (xt + reach - 3, bottom + 7), (xt + reach, bottom + 4),
                (xt + reach, bottom - drop + 3), (xt + reach - 2, bottom - drop),
                (xb + 2, bottom - drop), (xb + GAP, bottom - drop + 2),
                (xb + GAP, bottom + 1),
                (sx(bottom + 7) + GAP, bottom + 7),
            ]
            rings.append([(CX + side * d, y, z) for d, y in section])
        mesh_object(f'MOD_NA_{ident}_blade_{"L" if side > 0 else "R"}', rings, coll, material)
    return finish(coll)


# ----------------------------------------------------------- boot spoiler ----

def build_boot_spoiler(ident='RA41', rise=22.0, chord=58.0, half=430.0, material=PAINT):
    """A low painted lip along the boot's rear edge.

    The NA deck runs flat at ~800 mm and rolls down at a rear edge that
    curves forward from z -1888 on the centreline to about -1820 at the
    corners. The lip's trailing edge follows that curve 22 mm inboard of it,
    on the flat just before the roll, and fades over the last quarter of the
    span rather than ending square.

    The boot is coarse, and its height steps by a few millimetres from one
    facet to the next. Following it point by point makes a lumpy lip, so
    the deck under every chord station is smoothed along the span first,
    then lifted back wherever smoothing would have sunk the lip into it.
    """
    coll = m.start_mod(GEN, ident)
    boot = base('trunk_Material #71_0')

    def deck(x, z):
        p = ray(boot, (x, 1400, z), (0, -1, 0))
        if p is None:
            raise ValueError(f'no deck at x={x:.0f} z={z:.0f}')
        return p.y

    count = 81
    xs = [CX - half + 2 * half * i / (count - 1) for i in range(count)]
    rears = []
    for x in xs:
        rear = next((z for z in range(-1900, -1700) if ray(boot, (x, 1400, z), (0, -1, 0))), None)
        assert rear is not None, x
        rears.append(rear + 22.0)
    rears = gaussian(rears, 8)

    stations = [0, 0.08, 0.25, 0.5, 0.76, 0.94, 1]
    tapers, chords, grid = [], [], []
    for x, trailing in zip(xs, rears):
        u = abs(x - CX) / half
        taper = 1 - smooth((u - 0.72) / 0.28)
        local_chord = chord * (0.55 + 0.45 * taper)
        tapers.append(taper)
        chords.append(local_chord)
        grid.append([deck(x, trailing + local_chord * (1 - t)) for t in stations])
    for j in range(len(stations)):
        raw = [row[j] for row in grid]
        fair = gaussian(raw, 4)
        for i, row in enumerate(grid):
            row[j] = max(fair[i], raw[i])

    rings = []
    for x, trailing, taper, local_chord, heights in zip(xs, rears, tapers, chords, grid):
        local_rise = 2.0 + (rise - 2.0) * taper
        lifts = [0.9, 1.8, 0.16 * local_rise + 1, 0.45 * local_rise, 0.8 * local_rise, local_rise, local_rise - 0.9]
        ring = [(x, h + max(GAP, lift), trailing + local_chord * (1 - t))
                for t, h, lift in zip(stations, heights, lifts)]
        for t in [1, 0.76, 0.5, 0.25, 0]:
            j = stations.index(t)
            ring.append((x, heights[j] + GAP, trailing + local_chord * (1 - t)))
        rings.append(ring)
    mesh_object(f'MOD_NA_{ident}_spoiler', rings, coll, material)
    return finish(coll)


# ---------------------------------------------------------------- exhaust ----

#: The stock tail pipe ends here: centre (x, y), end z, radius — measured from
#: the loose parts of `Cylinder003_Material #168_0`.
TIP = (-604.0, 283.0, -1846.0, 27.5)


def build_big_bore(ident='EX40', radius=41.0):
    """An 82 mm rolled-edge titanium tip sleeved over the stock pipe.

    The silencer and tail pipe are one mesh in the asset, so the stock tip
    cannot be hidden without losing the silencer. The new sleeve encloses the
    pipe instead: a barrel from 80 mm ahead of the stock end, a reducer cone
    onto the 27.5 mm pipe, and a dark bore cap just behind the stock end, so
    from behind only the new tip is visible.
    """
    coll = m.start_mod(GEN, ident)
    x, y, end, pipe = TIP
    r = radius
    out = end - 24          # the new tip finishes 24 mm behind the stock one
    lathe('tip', coll, [
        # Outer skin, front to back: reducer cone, barrel, rolled lip...
        (end + 80, pipe + 1.5), (end + 62, r - 4), (end + 50, r - 1),
        (out + 6, r), (out + 2, r - 0.5), (out, r - 2.5),
        # ...then the inner wall back to the front, 5 mm thick.
        (out + 1, r - 4.5), (out + 8, r - 5), (end + 52, r - 5),
        (end + 66, pipe + 0.5),
    ], (x, y, 0), TITANIUM, segments=48)
    # A capped disc rather than a lathe: spinning a profile through r = 0
    # collapses its centre into a non-manifold edge.
    disc = [[(x + (r - 5.4) * math.cos(a), y + (r - 5.4) * math.sin(a), z)
             for a in (2 * math.pi * j / 48 for j in range(48))] for z in (end - 3, end - 5)]
    mesh_object(f'MOD_NA_{ident}_bore', disc, coll, SATIN)
    return finish(coll)


# -------------------------------------------------------------- roll bars ----

def _deck(x, z):
    """Height of the shelf behind the seats, read off the cabin tub."""
    p = ray(base('insidebed_Material #170_0'), (x, 2000, z), (0, -1, 0))
    if p is None:
        raise ValueError(f'no shelf at x={x:.0f} z={z:.0f}')
    return p.y


def build_style_bar(ident='RB40', material=SATIN):
    """A low satin hoop behind the headrests, footed on the shelf.

    The headrests top out at 1037 mm and the shelf behind the seat well is
    at ~825 mm from z -880 rearward. The hoop stands on that shelf at
    z -905, crowns at 1045, and carries a cross tube at shoulder height.
    """
    coll = m.start_mod(GEN, ident)
    z, half, crown = -905.0, 520.0, 1045.0
    feet = [_deck(CX + s * half, z) for s in (-1, 1)]
    path = m.rounded_path([(CX - half, feet[0], z), (CX - half + 40, crown, z - 12),
                           (CX + half - 40, crown, z - 12), (CX + half, feet[1], z)], 110, 12)
    tube('hoop', coll, path, 19, material)
    tube('cross_bar', coll, [(CX - half + 14, 930, z - 4), (CX + half - 14, 930, z - 4)], 15, material)
    for s, foot in zip((-1, 1), feet):
        box(f'foot_{"L" if s > 0 else "R"}', coll, (CX + s * half, foot + 3, z), (70, 6, 80))
    return finish(coll)


def build_track_hoop(ident='RB41'):
    """A taller single hoop with rear stays, harness bar and a diagonal.

    Crowns 95 mm above the headrests. The stays run back to the shelf at
    z -1090, where the folded-roof well is still flat enough to foot on.
    """
    coll = m.start_mod(GEN, ident)
    z, half, crown, back = -900.0, 470.0, 1132.0, -1090.0
    feet = [_deck(CX + s * half, z) for s in (-1, 1)]
    rear_feet = [_deck(CX + s * 400, back) for s in (-1, 1)]
    path = m.rounded_path([(CX - half, feet[0], z), (CX - half, crown, z),
                           (CX + half, crown, z), (CX + half, feet[1], z)], 100, 12)
    tube('main_hoop', coll, path, 20)
    for s, foot, rear in zip((-1, 1), feet, rear_feet):
        tag = 'L' if s > 0 else 'R'
        tube(f'rear_stay_{tag}', coll, [(CX + s * 340, crown - 3, z - 8), (CX + s * 400, rear + 6, back)], 17.5)
        box(f'front_foot_{tag}', coll, (CX + s * half, foot + 3, z), (80, 6, 90))
        box(f'rear_foot_{tag}', coll, (CX + s * 400, rear + 3, back), (80, 6, 90))
    tube('harness_bar', coll, [(CX - half + 2, 905, z), (CX + half - 2, 905, z)], 17.5)
    tube('diagonal', coll, [(CX - half + 12, 850, z), (CX + half - 60, crown - 30, z)], 17.5)
    return finish(coll, closed=False)


# ================================================================ round 2 ====
#
# Catalogue options the NA did not offer yet, plus two accessories shared
# with the ND (sun strip, mirror caps). Same rules: ray-cast the reference,
# never copy or hide it.


def oval_lathe(name, coll, profile, centre, squash, material, segments=40):
    """A closed profile spun about the car's length, squashed vertically.

    `profile` is a closed loop of (z, r) in app mm; `centre` is (x, y).
    `m.revolve` cannot squash, and oval tips are the whole point here.
    """
    cx, cy = centre
    rings = []
    for z, rad in profile:
        rings.append([to_blender((cx + rad * math.cos(a), cy + squash * rad * math.sin(a), z))
                      for a in (2 * math.pi * j / segments for j in range(segments))])
    verts = [v for ring in rings for v in ring]
    faces = []
    n = len(rings)
    for a in range(n):
        b = (a + 1) % n
        for j in range(segments):
            k = (j + 1) % segments
            faces.append((a * segments + j, a * segments + k, b * segments + k, b * segments + j))
    data = bpy.data.meshes.new(name)
    data.from_pydata([v[:] for v in verts], [], faces)
    data.validate()
    data.update()
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    m.clean(obj)
    for face in data.polygons:
        face.use_smooth = True
    return surface_material(obj, material)


def cylinder(name, coll, centre, axis, radius, length, material, segments=24):
    """A capped cylinder along app axis 'x', 'y' or 'z', starting at `centre`.

    A closed loft rather than a lathe through r = 0, which collapses into a
    non-manifold edge at the axis.
    """
    cx, cy, cz = centre
    rings = []
    for d in (0.0, length):
        ring = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            u, v = radius * math.cos(a), radius * math.sin(a)
            ring.append({'x': (cx + d, cy + u, cz + v), 'y': (cx + u, cy + d, cz + v),
                         'z': (cx + u, cy + v, cz + d)}[axis])
        rings.append(ring)
    obj = mesh_object(name, rings, coll, material)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return obj


def ellipse_rings(centre, stations, segments=40):
    """Rings of (x, y, z) ellipses for `mesh_object`: stations are (z, a, b)."""
    cx, cy = centre
    return [[(cx + a * math.cos(t), cy + b * math.sin(t), z)
             for t in (2 * math.pi * j / segments for j in range(segments))] for z, a, b in stations]


# ---------------------------------------------------------- carbon splitter ----

def build_splitter(ident='FA41'):
    """A flat carbon plate under the bumper with two adjustable stays.

    The plate follows the bumper's own low footprint, standing 55 mm proud
    on the centreline and wrapping back with the corners, 10 mm below the
    bumper's lowest point. Stays run up to the bumper face either side of
    the intake.
    """
    coll = m.start_mod(GEN, ident)
    bumper = base('frontbumper_Material #71_0')
    half = 700.0
    top, thick = 222.0, 6.0

    def front(x):
        hits = [ray(bumper, (x, y, 2600), (0, 0, -1)) for y in (236, 245, 260, 280, 300)]
        hits = [h.z for h in hits if h is not None]
        return max(hits) if hits else None

    count = 81
    xs = [CX - half + 2 * half * i / (count - 1) for i in range(count)]
    fronts = [front(x) for x in xs]
    assert all(f is not None for f in fronts), fronts
    fronts = gaussian(fronts, 3)
    rings = []
    for x, f in zip(xs, fronts):
        t = abs(x - CX) / half
        reach = 55 * (1 - 0.75 * smooth((t - 0.6) / 0.4))
        lead, back = f + reach, f - 130
        rings.append([(x, top, back), (x, top, lead - 3), (x, top - 1.5, lead),
                      (x, top - thick + 1.5, lead), (x, top - thick, lead - 3), (x, top - thick, back)])
    mesh_object(f'MOD_NA_{ident}_blade', rings, coll, CARBON)
    for side in (-1, 1):
        x = CX + side * 430
        upper = ray(bumper, (x, 300, 2600), (0, 0, -1))
        assert upper is not None
        f = fronts[min(range(count), key=lambda i: abs(xs[i] - x))]
        lower = (x, top, f + 28)
        upper = (x, 300, upper.z + 3)
        tag = 'L' if side > 0 else 'R'
        tube(f'stay_{tag}', coll, [lower, upper], 4.2, ALLOY, 12)
        direction = (Vector(upper) - Vector(lower)).normalized()
        tube(f'adjuster_{tag}', coll, [Vector(lower) + direction * 18, Vector(lower) + direction * 48], 6.5, SATIN, 12)
        cylinder(f'foot_{tag}', coll, lower, 'y', 12, 3, ALLOY)
    return finish(coll)


# ------------------------------------------------------------ rear valance ----

def build_rear_valance(ident='RA43', material=SATIN, depth=26.0):
    """A satin valance blade under the rear bumper with four strakes.

    The silencer hangs lower than the bumper (220 mm against 244) and ends at
    z -1812, so a full diffuser tray would run straight into it. Instead the
    blade sits behind the silencer, under the bumper's rolled lower edge,
    and stops short of the exhaust on the right.
    """
    coll = m.start_mod(GEN, ident)
    bumper = base('rearbumper_Material #71_0')
    half = 520.0
    count = 81
    xs = [CX - half + 2 * half * i / (count - 1) for i in range(count)]
    bottoms, faces = [], []
    for x in xs:
        bottom = next((y for y in range(200, 420) if ray(bumper, (x, y, -2600), (0, 0, 1))), None)
        assert bottom is not None, x
        bottoms.append(bottom)
        faces.append(ray(bumper, (x, bottom + 3, -2600), (0, 0, 1)).z)
    bottoms = gaussian(bottoms, 3)
    faces = gaussian(faces, 3)
    rows = []
    rings = []
    for i, (x, bottom, face) in enumerate(zip(xs, bottoms, faces)):
        end = smooth(min(i, count - 1 - i) / 10)
        rear = face - 12 * end
        fore = face + 55 * (0.4 + 0.6 * end)
        if -526 <= x <= 32:
            fore = min(fore, -1824.0)       # stay clear of the silencer
        y = bottom - GAP
        thick = 3 + 2.5 * end
        rows.append((y - thick, fore, rear))
        rings.append([(x, y, fore), (x, y, rear + 2), (x, y - thick * 0.5, rear),
                      (x, y - thick, rear + 2), (x, y - thick, fore)])
    mesh_object(f'MOD_NA_{ident}_blade', rings, coll, material)
    for n, dx in enumerate((-370, -140, 140, 370)):
        x = CX + dx
        i = min(range(count), key=lambda j: abs(xs[j] - x))
        y, fore, rear = rows[i]
        y += 0.5
        strake = []
        for j in range(17):
            t = j / 16
            z = fore - (fore - rear - 3) * t
            d = 4 + depth * smooth(t)
            strake.append([(x - 2, y + 1, z), (x + 2, y + 1, z), (x + 2, y - d, z), (x - 2, y - d, z)])
        mesh_object(f'MOD_NA_{ident}_strake_{n}', strake, coll, material)
    return finish(coll)


# ---------------------------------------------------------------- GT wing ----

def build_gt_wing(ident='RA44', drop=0.0, half=640.0, scale=1.0):
    """A carbon wing on two swept uprights, sized to the NA's short boot.

    Span 1280 mm (the boot is 1100 wide), chord 200 mm, about 250 mm above
    the deck. Uprights foot on the deck through fitted plates; shaped
    endplates finish the tips. `drop` lowers the wing, `half` sets the
    half-span and `scale` the chord (and endplates) for a low-mount variant.
    """
    coll = m.start_mod(GEN, ident)
    boot = base('trunk_Material #71_0')

    def deck(x, z):
        p = ray(boot, (x, 1400, z), (0, -1, 0))
        assert p is not None, (x, z)
        return p.y

    y0, z0 = 1062.0 - drop, -1640.0
    section = [(dz * scale, dy * scale) for dz, dy in
               [(0, 0), (9, 4.5), (32, 6.5), (82, 6.5), (155, 12), (200, 20),
                (200, 17), (155, 5), (82, -8), (32, -9), (9, -4.5)]]
    rings = []
    for i in range(29):
        x = CX - half + 2 * half * i / 28
        u = abs(x - CX) / half
        y, z = y0 + 9 * u * u, z0 - 12 * u * u
        rings.append([(x, y + dy, z - dz) for dz, dy in section])
    mesh_object(f'MOD_NA_{ident}_airfoil', rings, coll, CARBON)
    for side in (-1, 1):
        tag = 'L' if side > 0 else 'R'
        x = CX + side * 300
        zf = -1600
        yf = deck(x, zf) + 3
        rings = []
        for t in (0, 0.1, 0.85, 1):
            y = yf + (y0 - 8 - yf) * t
            z = zf - 50 * t
            chord = 100 - 36 * t
            rings.append([(x - 4, y, z + chord / 2), (x + 4, y, z + chord / 2),
                          (x + 4, y, z - chord / 2), (x - 4, y, z - chord / 2)])
        mesh_object(f'MOD_NA_{ident}_upright_{tag}', rings, coll, SATIN)
        foot = []
        for j in range(13):
            z = zf - 62 + j * 124 / 12
            a, b = x - 32, x + 32
            ya, yb = deck(a, z) + 3, deck(b, z) + 3
            foot.append([(a, ya, z), (b, yb, z), (b, yb - 3, z), (a, ya - 3, z)])
        mesh_object(f'MOD_NA_{ident}_foot_{tag}', foot, coll, SATIN)
        xe = CX + side * (half + 2)
        outline = [(z0 + (z + 1640) * scale, y0 + (y - 1062) * scale) for z, y in
                   [(-1608, 1100), (-1622, 1118), (-1820, 1112), (-1858, 1062),
                    (-1838, 1006), (-1650, 1016), (-1608, 1036)]]
        mesh_object(f'MOD_NA_{ident}_endplate_{tag}',
                    [[(xe + dx, y, z) for z, y in outline] for dx in (-2, 2)], coll, CARBON)
    return finish(coll)


# ------------------------------------------------------------ bonnet vents ----

def build_bonnet_vents(ident='BP41'):
    """Two painted louvre panels set into the bonnet.

    Each 220 x 230 mm panel is a dark recess lying on the bonnet, a painted
    surround and seven rear-facing painted slats, all fitted to the bonnet's
    crown and slope at every station.
    """
    coll = m.start_mod(GEN, ident)
    hood = base('hood_Material #71_0')

    def surf(x, z):
        p = ray(hood, (x, 2000, z), (0, -1, 0))
        assert p is not None, (x, z)
        return p.y

    w, z_front, z_back = 220.0, 1250.0, 1020.0
    for side in (-1, 1):
        tag = 'L' if side > 0 else 'R'
        cx = CX + side * 285
        x0, x1 = cx - w / 2, cx + w / 2
        rings = []
        for i in range(13):
            x = x0 + (x1 - x0) * i / 12
            zs = [z_front - (z_front - z_back) * j / 6 for j in range(7)]
            top = [(x, surf(x, z) + 1.6, z) for z in zs]
            low = [(px, py - 1.0, pz) for px, py, pz in reversed(top)]
            rings.append(top + low)
        mesh_object(f'MOD_NA_{ident}_recess_{tag}', rings, coll, SATIN)
        rails = [((x0 - 10, z_front + 10), (x1 + 10, z_front + 10)),
                 ((x0 - 10, z_back - 10), (x1 + 10, z_back - 10)),
                 ((x0 - 10, z_front), (x0 - 10, z_back)),
                 ((x1 + 10, z_front), (x1 + 10, z_back))]
        for n, (a, b) in enumerate(rails):
            along_x = a[1] == b[1]
            rings = []
            for i in range(13):
                t = i / 12
                x = a[0] + (b[0] - a[0]) * t
                z = a[1] + (b[1] - a[1]) * t
                pts = [(x, z - 10), (x, z + 10)] if along_x else [(x - 10, z), (x + 10, z)]
                ys = [surf(px, pz) for px, pz in pts]
                rings.append([(pts[0][0], ys[0] + 0.6, pts[0][1]), (pts[0][0], ys[0] + 4, pts[0][1]),
                              (pts[1][0], ys[1] + 4, pts[1][1]), (pts[1][0], ys[1] + 0.6, pts[1][1])])
            mesh_object(f'MOD_NA_{ident}_rail_{tag}{n}', rings, coll, PAINT)
        for n in range(7):
            zl = z_front - 22 - n * (z_front - z_back - 40) / 6
            rings = []
            for i in range(13):
                x = x0 + 4 + (w - 8) * i / 12
                b = surf(x, zl)
                rings.append([(x, b + 1.8, zl + 9), (x, b + 6.5, zl - 2), (x, b + 7.5, zl - 12),
                              (x, b + 5.5, zl - 13), (x, b + 4.5, zl - 3), (x, b + 1.8, zl + 5)])
            mesh_object(f'MOD_NA_{ident}_slat_{tag}{n}', rings, coll, PAINT)
    return finish(coll)


# ---------------------------------------------------------- twin oval tips ----

def build_twin_oval(ident='EX41'):
    """Two chrome oval tips from a collector sleeved over the stock pipe.

    The collector encloses the stock tail pipe's last 70 mm, so the stock tip
    disappears inside it, as with EX40. Tips are 54 x 38 mm with a rolled
    edge and dark bores.
    """
    coll = m.start_mod(GEN, ident)
    x, y, end, pipe = TIP
    mesh_object(f'MOD_NA_{ident}_collector',
                ellipse_rings((x, y), [(-1776, pipe + 1.5, pipe + 1.5), (-1792, 64, 33),
                                       (-1846, 66, 34), (-1856, 62, 31)]), coll, ALLOY)
    squash = 0.7
    for n, dx in enumerate((-34, 34)):
        cx = x + dx
        r = 27.0
        profile = [(-1848, r - 3), (-1876, r), (-1882, r - 0.5), (-1884, r - 2.5),
                   (-1883, r - 4.5), (-1876, r - 5), (-1850, r - 5)]
        oval_lathe(f'MOD_NA_{ident}_tip_{n}', coll, profile, (cx, y), squash, CHROME)
        mesh_object(f'MOD_NA_{ident}_bore_{n}',
                    ellipse_rings((cx, y), [(-1862, r - 5.3, squash * (r - 5.3)),
                                            (-1864, r - 5.3, squash * (r - 5.3))]), coll, SATIN)
    return finish(coll)


# --------------------------------------------------------------- tow hook ----

def build_tow_hook(ident='FA42'):
    """A red anodised tow eye on the lower right of the bumper."""
    coll = m.start_mod(GEN, ident)
    bumper = base('frontbumper_Material #71_0')
    x, y = CX - 515, 292.0
    h = ray(bumper, (x, y, 2600), (0, 0, -1))
    assert h is not None
    z = h.z
    cylinder('socket', coll, (x, y, z - 1), 'z', 17, 6, SATIN, 32)
    cylinder('shaft', coll, (x, y, z - 5), 'z', 6.5, 48, ALLOY)
    lathe('eye', coll, [(0, 24), (0, 35), (7, 35), (9, 32), (9, 24)], (x, y + 28, z + 40), ACCENT, 48)
    tube('neck', coll, [(x, y, z + 28), (x, y + 4, z + 44)], 8, ACCENT, 16)
    return finish(coll)


# -------------------------------------------------------------- sun strip ----

def build_sun_strip(ident='DT40', glass_names=('ingaugeglass_glass_0',), half=585.0, band=120.0):
    """A dark film band across the top of the windscreen, 0.6 mm thick.

    Sampled straight off the glass: for each station across the screen the
    screen's top edge is found and the band follows the glass down from it
    to one level lower edge, so the corners shorten rather than droop. It
    sits 2 mm clear of the glass: the screen curves between samples, and
    any closer it pokes through.
    """
    coll = m.start_mod(GEN, ident)
    parts = [base(n) for n in glass_names]

    def on_glass(x, y):
        # The ND's screen has a cut-out round the mirror mount, filled by the
        # black frit part: take the front-most hit across every part.
        hits = [ray(p, (x, y, 3000), (0, 0, -1)) for p in parts]
        hits = [h for h in hits if h is not None]
        return max(hits, key=lambda h: h.z) if hits else None

    count = 61
    xs = [CX - half + 2 * half * i / (count - 1) for i in range(count)]
    tops = [next((y for y in range(1300, 600, -1) if on_glass(x, y)), None) for x in xs]
    assert all(t is not None for t in tops), tops
    # Smooth the edge, but never above the glass actually found there.
    tops = [min(t - 4, f) for t, f in zip(tops, gaussian([t - 4 for t in tops], 3))]
    floor = max(tops) - band
    rings = []
    for x, top in zip(xs, tops):
        local = max(18.0, top - floor)
        front, back = [], []
        for j in range(9):
            yy = top - local * j / 8
            p = on_glass(x, yy)
            q = on_glass(x, yy - 2)
            assert p is not None and q is not None, (x, yy)
            down = (q - p).normalized()
            normal = Vector((0, -down.z, down.y)).normalized()
            if normal.z < 0:
                normal = -normal
            front.append(tuple(p + normal * 2.6))
            back.append(tuple(p + normal * 2.0))
        rings.append(front + list(reversed(back)))
    mesh_object(f'MOD_{GEN.upper()}_{ident}_film', rings, coll, GLOSS)
    return finish(coll)


# ------------------------------------------------------------ mirror caps ----

#: (housing, mirror glass) node names per car.
MIRRORS = {
    'na': [('mirrorbox_Material #70_0', 'mirror_Material #76_0'),
           ('mirrhousingl_Material #70_0', 'mirrorl_Material #76_0')],
    'nd': [('MirrorR 6.002_182', 'MirrorR 6.003_183'),
           ('MirrorL 6.003_176', 'MirrorL 6_173')],
}


def build_mirror_caps(ident='DT41', offset=1.8, thick=1.4, material=CARBON):
    """Carbon shells over the forward face of both door-mirror housings.

    Projected straight off each housing from the front, row by row, then
    lifted 1.8 mm off it along the surface normal and given 1.4 mm of
    thickness. The span runs from the inboard edge of the mirror glass to
    the housing's outboard tip, so the cap covers the head but not the arm.
    """
    coll = m.start_mod(GEN, ident)
    for housing_name, glass_name in MIRRORS[GEN]:
        housing, glass = base(housing_name), base(glass_name)
        g = [app(glass.matrix_world @ v.co) for v in glass.data.vertices]
        h = [app(housing.matrix_world @ v.co) for v in housing.data.vertices]
        gx0, gx1 = min(p.x for p in g) - 6, max(p.x for p in g) + 6
        # Inboard, stop at the glass so the arm stays bare; outboard, run to
        # the housing's own tip so no paint shows at the end.
        if sum(p.x for p in g) > 0:
            gx1 = max(p.x for p in h)
        else:
            gx0 = min(p.x for p in h)
        hy0, hy1 = min(p.y for p in h), max(p.y for p in h)

        def hit(x, y):
            return ray(housing, (x, y, 3000), (0, 0, -1))

        def hit_n(x, y):
            return ray_normal(housing, (x, y, 3000), (0, 0, -1))

        rows = []
        y = hy0 + 1.5
        while y <= hy1 - 1.5:
            xs = [x / 2 for x in range(int(gx0 * 2), int(gx1 * 2) + 1) if hit(x / 2, y)]
            if len(xs) > 20:
                rows.append((y, xs[0] + 0.5, xs[-1] - 0.5))
            y += 3.5
        assert len(rows) > 8, (housing_name, len(rows))
        rings = []
        for y, xa, xb in rows:
            front, back = [], []
            for j in range(23):
                x = xa + (xb - xa) * j / 22
                p, n = hit_n(x, y)
                if p is None:
                    p, n = hit_n(xa + (xb - xa) * 0.5, y)
                # Along the surface normal: where the housing turns away at
                # its ends, a straight-forward offset lets it poke through.
                if n.z < 0:
                    n = -n
                front.append(tuple(p + n * (offset + thick)))
                back.append(tuple(p + n * offset))
            rings.append(front + list(reversed(back)))
        side = 'L' if sum(p.x for p in g) > 0 else 'R'
        mesh_object(f'MOD_{GEN.upper()}_{ident}_cap_{side}', rings, coll, material)
    return finish(coll)

