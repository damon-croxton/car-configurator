"""Build/export the round-nine parts for both cars.

blender --background --factory-startup --python blender/build_r9.py

Imports both reference cars (as build_na_kit does) and builds every spec
below for each generation it lists. Geometry lives in parts_r9.py, with
variants of nd_extras builders. Writes blender/build/r9_report.json.
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
import parts_r6 as p6
import parts_r9 as p

BOTH = ('nd', 'na')
NA = ('na',)
ND = ('nd',)

#: (ident, generations, file name, builder)
SPECS = [
    ('NB01', NA, 'NB01_nose_bra.glb', p.nose_bra),
    ('RA51', NA, 'RA51_low_wing.glb', lambda: k.build_gt_wing('RA51', drop=110.0, half=600.0, scale=0.85)),
    ('DT78', BOTH, 'DT78_bonnet_wrap_carbon.glb', lambda: p6.bonnet_wrap('DT78', k.CARBON)),
    ('DT79', BOTH, 'DT79_bonnet_wrap_accent.glb', lambda: p6.bonnet_wrap('DT79', k.ACCENT)),
    ('W22', ND, 'W22_six_y_spoke.glb', lambda: p.wheel('W22')),
    ('W23', ND, 'W23_twelve_spoke.glb', lambda: p.wheel('W23')),
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
    ns = {'__name__': 'r9'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in BOTH:
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    reports = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r9_report.json').write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
