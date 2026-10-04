"""Build/export the round-ten parts for both cars.

blender --background --factory-startup --python blender/build_r10.py

Imports both reference cars (as build_na_kit does) and builds every spec
below for each generation it lists. Geometry lives in parts_r10.py, with
new builders. Writes blender/build/r10_report.json.
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
import parts_r10 as p

BOTH = ('nd', 'na')
NA = ('na',)
ND = ('nd',)

#: (ident, generations, file name, builder)
SPECS = [
    ('WB01', BOTH, 'WB01_widebody_fenders.glb', lambda: p.wide_fenders('WB01', k.PAINT, k.CHROME)),
    ('WB02', BOTH, 'WB02_widebody_fenders_carbon.glb', lambda: p.wide_fenders('WB02', k.CARBON, k.CHROME)),
    ('WB03', BOTH, 'WB03_widebody_fenders_satin.glb', lambda: p.wide_fenders('WB03', k.SATIN, k.ALLOY)),
    ('WB10', BOTH, 'WB10_widebody_lip.glb', p.wide_lip),
    ('WB11', BOTH, 'WB11_widebody_skirts.glb', p.wide_skirts),
    ('WB12', BOTH, 'WB12_widebody_diffuser.glb', p.wide_diffuser),
    ('WB13', BOTH, 'WB13_widebody_ducktail.glb', p.ducktail),
    ('WB14', BOTH, 'WB14_widebody_ducktail_carbon.glb', lambda: p.ducktail('WB14', material=k.CARBON)),
    ('RA60', BOTH, 'RA60_double_element_wing.glb', lambda: p.wing('RA60', 'double')),
    ('RA61', BOTH, 'RA61_time_attack_wing.glb', lambda: p.wing('RA61', 'time_attack')),
    ('RA62', NA, 'RA62_swan_neck_wing.glb', lambda: p.wing('RA62', 'swan')),
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
                origin = [734, 0, 1194] if ident[0] == 'W' and ident[1:].isdigit() else None
                m.export_glb(gen, ident, filename, coll, origin=origin)
    return reports


def main():
    ns = {'__name__': 'r10'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in BOTH:
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    reports = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r10_report.json').write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
