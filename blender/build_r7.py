"""Build/export the round-seven parts for both cars.

blender --background --factory-startup --python blender/build_r7.py

Imports both reference cars (as build_na_kit does) and builds every spec
below for each generation it lists. Geometry lives in parts_r7.py, with
variants of nd_extras builders. Writes blender/build/r7_report.json.
"""
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(r"C:/Users/Damon/car-configurator")
sys.path.insert(0, str(ROOT / 'blender'))
import mx5_lib as m
import na_kit as k
import nd_extras as x
import parts_r7 as p

BOTH = ('nd', 'na')
NA = ('na',)
ND = ('nd',)

#: (ident, generations, file name, builder)
SPECS = [
    ('DT70', BOTH, 'DT70_riveted_overfenders.glb',
     lambda: x.fender_flares('DT70', k.PAINT, width=60.0, swell=42.0, rivets=k.CHROME)),
    ('DT71', BOTH, 'DT71_fender_flares_painted.glb', lambda: x.fender_flares('DT71', k.PAINT)),
    ('DT72', BOTH, 'DT72_naca_ducts.glb', p.naca_ducts),
    ('FA45', NA, 'FA45_dive_planes.glb', p.dive_planes),
    ('RA50', NA, 'RA50_rear_spats.glb', p.rear_spats),
    ('DT73', NA, 'DT73_brake_ducts.glb', p.brake_ducts),
    ('W16', ND, 'W16_classic_five_spoke.glb', lambda: p.wheel('W16')),
    ('W17', ND, 'W17_ten_spoke.glb', lambda: p.wheel('W17')),
    ('W18', ND, 'W18_steel_wheel.glb', lambda: p.wheel('W18')),
    ('W19', ND, 'W19_three_piece_multi_spoke.glb', lambda: p.wheel('W19')),
]


def build(only=None, export=True):
    reports = {}
    for gen in BOTH:
        k.use(gen)
        for ident, gens, filename, fn in SPECS:
            if gen not in gens or (only and ident not in only):
                continue
            coll = fn()
            bpy.context.view_layer.update()
            reports[f'{ident}/{gen}'] = m.stats(list(coll.objects), gen=gen)
            if export:
                # Wheels export about their contact patch (brief §2.2).
                origin = [734, 0, 1194] if ident.startswith('W') else None
                m.export_glb(gen, ident, filename, coll, origin=origin)
    return reports


def main():
    ns = {'__name__': 'r7'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in BOTH:
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    reports = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r7_report.json').write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
