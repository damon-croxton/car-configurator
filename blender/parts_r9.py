"""Round-nine parts: the NA nose bra and two more wheel faces.

Built on na_kit's helpers for whichever car `na_kit.use(gen)` points at,
except the wheels (authored on the ND front-left wheel and shared). Each
part follows a real accessory type; none copies a product or logo.
"""
import math
from mathutils import Vector
import mx5_lib as m
import na_kit as k
import nd_extras as x
import parts_r7 as p7

SATIN = k.SATIN
UP = Vector((0, 1, 0))


def name(ident, part):
    return x.name(ident, part)


# --------------------------------------------------------------- NA nose bra ----

def nose_bra(ident='NB01'):
    """A black vinyl nose bra for the NA, the period front-end cover.

    Laid on the front bumper by rays from ahead and slightly above (so the
    front face and the nose top are both hit squarely), in three pieces that
    frame the oval parking-lamp openings in the bumper's upper corners and
    stop above the intake mouth, plus a band over the bonnet's leading edge.
    """
    coll = m.start_mod(k.GEN, ident)
    bumper = k.base('frontbumper_Material #71_0')
    bonnet = k.base('hood_Material #71_0')
    d = Vector((0, -0.45, -1)).normalized()
    out = -d

    def on_bumper(xx, s):
        hit, nrm = k.ray_normal(bumper, (k.CX + xx, s, 3000), tuple(d))
        assert hit is not None, (xx, s)
        return hit, x.outward(nrm, out)

    def panel(label, x0, x1, s0, s1, nx, ns):
        rows = [[on_bumper(x0 + (x1 - x0) * i / (nx - 1), s0 + (s1 - s0) * j / (ns - 1)) for j in range(ns)]
                for i in range(nx)]
        x.film(name(ident, label), coll, rows, 1.5, 1.2, SATIN)

    # Centre: between the lamp openings, from above the mouth over the nose.
    panel('centre', -320.0, 320.0, 905.0, 1150.0, 41, 25)
    # Lower corners: below the lamp openings, out to the bumper's sides.
    panel('corner_L', 320.0, 690.0, 930.0, 1010.0, 21, 7)
    panel('corner_R', -690.0, -320.0, 930.0, 1010.0, 21, 7)

    # Bonnet band: the leading 170 mm of the bonnet, edge to edge.
    zs = [z for z in range(1000, 2000, 4) if k.ray(bonnet, (k.CX, 2000, z), (0, -1, 0))]
    z_front = max(zs) - 6
    rows = []
    for i in range(9):
        z = z_front - 170 * i / 8
        hits = {xx for xx in range(-900, 901, 3) if k.ray(bonnet, (k.CX + xx, 2000, z), (0, -1, 0))}
        xa = xb = 0
        while xa - 3 in hits:
            xa -= 3
        while xb + 3 in hits:
            xb += 3
        row = []
        for j in range(31):
            xx = k.CX + xa + 8 + (xb - xa - 16) * j / 30
            hit, nrm = k.ray_normal(bonnet, (xx, 2000, z), (0, -1, 0))
            assert hit is not None, (xx, z)
            row.append((hit, x.outward(nrm, UP)))
        rows.append(row)
    x.film(name(ident, 'bonnet'), coll, rows, 1.2, 1.2, SATIN)
    return k.finish(coll)


# ------------------------------------------------------------------- wheels ----

def wheel(ident):
    """W22 six Y-spoke: six spokes that fork into a Y toward the rim.
    W23 twelve-spoke: twelve slim straight spokes on a flat face."""
    import nd_detail_kit as d
    coll, axle = p7._wheel_base(ident)
    lip = [(96, 250), (99, 253), (99, 256), (96, 258), (94, 256), (94, 251)]
    if ident == 'W22':
        face = lambda t: 34 + 52 * t ** 1.5
        # Trunk from the hub, then two branches splaying apart to the rim.
        p7._spokes(coll, axle, 6, 61, 140, lambda t: 38 - 6 * t, lambda t: face(t * 0.42), prefix='trunk')
        for sign in (-1, 1):
            p7._spokes(coll, axle, 6, 130, 249,
                       lambda t: 20 - 3 * t + 12 * max(0.0, (t - 0.85) / 0.15) ** 2,
                       lambda t: face(0.42 + 0.58 * t), prefix=f'branch{"a" if sign > 0 else "b"}',
                       branch=lambda t, s=sign: s * (0.02 + 0.17 * t))
        d.lathe('polished_lip', coll, lip, axle, 'MOD_Chrome', 'x', 80)
    else:
        p7._spokes(coll, axle, 12, 61, 249, lambda t: 19 - 4 * t + 10 * max(0.0, (t - 0.88) / 0.12) ** 2,
                   lambda t: 46 + 38 * t ** 2)
        d.lathe('centre_ring', coll, [(45, 64), (61, 64), (63, 90), (47, 90)], axle, 'MOD_Rim', 'x', 64)
        d.lathe('polished_lip', coll, lip, axle, 'MOD_Chrome', 'x', 80)
    angle = .55
    d.lathe('valve', coll, [(0, 0), (0, 4), (15, 4), (17, 3), (17, 0)],
            (axle[0] + 83, axle[1] + 230 * math.cos(angle), axle[2] + 230 * math.sin(angle)), d.SATIN, 'x', 12)
    return d.finish(coll)
