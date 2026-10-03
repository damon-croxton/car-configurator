"""Round-eight parts: carbon front fenders, NA twin tips and two more wheel
faces (wire wheels and a seven twin-spoke).

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
import parts_r7 as p7

SATIN, CARBON, TITANIUM, CHROME = k.SATIN, k.CARBON, k.TITANIUM, k.CHROME


def name(ident, part):
    return x.name(ident, part)


#: The paint-skin node of each front fender (the ND has one per side; the
#: NA's two fenders are a single node).
FENDERS = {'nd': ['FenderFL 6.002_88', 'FenderFR 6.001_80'], 'na': ['f fender_Material #71_0']}


# ------------------------------------------------------- carbon front fenders ----

def carbon_fenders(ident='BP43'):
    """Carbon replacement front fenders, derived from the stock fender skins
    (like HD40), 2 mm thick behind the original outer surface so flares,
    vents and stripes laid on them still sit on them."""
    coll = m.start_mod(k.GEN, ident)
    for n, node in enumerate(FENDERS[k.GEN]):
        tag = ('L', 'R')[n] if len(FENDERS[k.GEN]) > 1 else 'pair'
        panel = m.panel_from_base(node, name(ident, f'panel_{tag}'), coll, gen=k.GEN)
        k.surface_material(panel, CARBON)
        m.clean(panel)
        m.solidify(panel, 2.0, gen=k.GEN, offset=-1.0)
        for f in panel.data.polygons:
            f.use_smooth = True
        m.box_uv(panel, scale=0.05)
    return k.finish(coll, closed=False)


# ----------------------------------------------------------- NA twin tips ----

def twin_tips(ident='EX44'):
    """Twin 60 mm titanium tips on an oval collector sleeved over the NA's
    stock tail pipe (which can't be hidden: it is one mesh with the
    silencer), side by side as on the common dual-outlet NA silencers."""
    coll = m.start_mod(k.GEN, ident)
    xc, y, end, pipe = k.TIP
    # Oval collector over the pipe: rings front to back, closed by the loft.
    rings = []
    for i in range(9):
        t = i / 8
        z = end + 90 - 70 * t
        hw = pipe + 3 + (66 - pipe - 3) * k.smooth(t / 0.6)
        hh = pipe + 3 + (34 - pipe - 3) * k.smooth(t / 0.6)
        rings.append([(xc + hw * math.cos(a), y + hh * math.sin(a), z)
                      for a in (2 * math.pi * j / 40 for j in range(40))])
    k.mesh_object(name(ident, 'collector'), rings, coll, TITANIUM)
    out = end - 30
    for side in (-1, 1):
        tx = xc + side * 33
        k.lathe(f'tip_{"L" if side > 0 else "R"}', coll, [
            (end + 30, 26), (out + 6, 30), (out + 2, 29.5), (out, 27.5),
            (out + 1, 25.5), (out + 8, 25), (end + 28, 23)], (tx, y, 0), TITANIUM, segments=40)
        disc = [[(tx + 24.4 * math.cos(a), y + 24.4 * math.sin(a), z)
                 for a in (2 * math.pi * j / 40 for j in range(40))] for z in (out + 20, out + 18)]
        k.mesh_object(name(ident, f'bore_{"L" if side > 0 else "R"}'), disc, coll, SATIN)
    return k.finish(coll)


# ------------------------------------------------------------------- wheels ----

def wheel(ident):
    """W20 wire wheel: 48 crossed spokes laced from a two-flange hub to the
    rim, with a two-eared knock-off spinner. W21 seven twin-spoke: seven
    pairs of parallel spokes on a concave face with a polished lip."""
    import nd_detail_kit as d
    coll, axle = p7._wheel_base(ident)
    if ident == 'W20':
        # Hub barrel and flanges, then the spokes.
        d.lathe('hub_barrel', coll, [(20, 50), (100, 50), (100, 62), (88, 66), (34, 66), (20, 62)],
                axle, 'MOD_Chrome', 'x', 48)
        for flange, fx in (('in', 28.0), ('out', 80.0)):
            d.lathe(f'flange_{flange}', coll, [(fx - 4, 60), (fx + 4, 60), (fx + 4, 84), (fx - 4, 84)],
                    axle, 'MOD_Rim', 'x', 48)
        for i in range(48):
            a0 = 2 * math.pi * i / 48
            fx = 28.0 if i % 2 else 80.0
            lead = 0.55 if (i // 2) % 2 else -0.55     # alternate leading and trailing spokes
            a1 = a0 + lead
            start = (axle[0] + fx, axle[1] + 80 * math.cos(a0), axle[2] + 80 * math.sin(a0))
            stop = (axle[0] + 62, axle[1] + 242 * math.cos(a1), axle[2] + 242 * math.sin(a1))
            k.tube(f'spoke_w{i}', coll, [start, stop], 2.2, 'MOD_Rim', 6)
        # Knock-off spinner: a domed nut with two ears.
        d.lathe('spinner_nut', coll, [(100, 0), (100, 44), (112, 42), (122, 30), (126, 0)],
                axle, 'MOD_Chrome', 'x', 40)
        for side in (-1, 1):
            rings = []
            for j in range(7):
                t = j / 6
                r = 36 + 58 * t
                w = 15 - 7 * t
                xx = 112 - 6 * t
                rings.append([(axle[0] + xx + dx, axle[1] + side * r, axle[2] + s) for dx, s in
                              ((-5, -w), (5, -w * 0.8), (5, w * 0.8), (-5, w))])
            k.mesh_object(name(ident, f'ear_{"a" if side > 0 else "b"}'), rings, coll, 'MOD_Chrome')
    else:
        def face(t):
            return 30 + 56 * t ** 1.5

        def width(t):
            return 17 - 4 * t + 10 * max(0.0, (t - 0.86) / 0.14) ** 2

        for sign in (-1, 1):
            p7._spokes(coll, axle, 7, 63, 249, width, face, prefix=f'twin{"a" if sign > 0 else "b"}',
                       branch=lambda t, s=sign: s * 13.0 / (63 + 186 * t))
        d.lathe('centre_ring', coll, [(29, 64), (45, 64), (47, 94), (31, 94)], axle, 'MOD_Rim', 'x', 64)
        d.lathe('polished_lip', coll, [(96, 250), (99, 253), (99, 256), (96, 258), (94, 256), (94, 251)],
                axle, 'MOD_Chrome', 'x', 80)
    angle = .55
    d.lathe('valve', coll, [(0, 0), (0, 4), (15, 4), (17, 3), (17, 0)],
            (axle[0] + 83, axle[1] + 230 * math.cos(angle), axle[2] + 230 * math.sin(angle)), d.SATIN, 'x', 12)
    return d.finish(coll)
