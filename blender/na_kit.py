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

SATIN = 'MOD_SatinBlack'
PAINT = 'MOD_BodyPaint'
TITANIUM = 'MOD_Titanium'


# ---------------------------------------------------------------- frame ----

def app(v):
    """Raw Blender point -> app mm, unrounded (ray hits need sub-mm)."""
    s, (ox, oy, oz) = m._frame(GEN)
    k = m._yaw_sign(GEN)
    return Vector((k * v[0] * s * 1000 + ox, v[2] * s * 1000 + oy, -k * v[1] * s * 1000 + oz))


def to_blender(p):
    return m.app_to_blender(p[0], p[1], p[2], gen=GEN)


def base(name):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise KeyError(f'{name!r} is not in this scene; import the NA first')
    return obj


def ray(obj, origin, direction):
    inv = obj.matrix_world.inverted()
    start = to_blender(origin)
    end = to_blender(Vector(origin) + Vector(direction))
    hit, location, _, _ = obj.ray_cast(inv @ start, (inv.to_3x3() @ (end - start)).normalized())
    return app(obj.matrix_world @ location) if hit else None


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
    if material == SATIN:
        # Same restrained satin as the ND kit: textured plastic, not paint.
        bsdf.inputs['Base Color'].default_value = (0.004, 0.005, 0.006, 1)
        bsdf.inputs['Metallic'].default_value = 0
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Specular IOR Level'].default_value = 0.18
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


def lathe(name, coll, profile, centre, material, segments=40):
    obj = m.revolve(name, coll, profile, centre, segments=segments, axis='z', gen=GEN)
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

def build_front_lip(ident='FA40'):
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
    mesh_object(f'MOD_NA_{ident}_blade', rings, coll, SATIN)
    return finish(coll)


# -------------------------------------------------------- side extensions ----

def build_side_extensions(ident='RA40'):
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
        mesh_object(f'MOD_NA_{ident}_blade_{"L" if side > 0 else "R"}', rings, coll, SATIN)
    return finish(coll)


# ----------------------------------------------------------- boot spoiler ----

def build_boot_spoiler(ident='RA41', rise=22.0, chord=58.0, half=430.0):
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
    mesh_object(f'MOD_NA_{ident}_spoiler', rings, coll, PAINT)
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


def build_style_bar(ident='RB40'):
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
    tube('hoop', coll, path, 19)
    tube('cross_bar', coll, [(CX - half + 14, 930, z - 4), (CX + half - 14, 930, z - 4)], 15)
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
