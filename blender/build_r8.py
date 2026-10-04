"""Build/export the round-eight parts for both cars.

blender --background --factory-startup --python blender/build_r8.py

Imports both reference cars (as build_na_kit does) and builds every spec
below for each generation it lists. Geometry lives in parts_r8.py, with
variants of nd_extras builders. Writes blender/build/r8_report.json.
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
import parts_r5 as p5
import parts_r8 as p

BOTH = ('nd', 'na')
NA = ('na',)
ND = ('nd',)

#: (ident, generations, file name, builder)
SPECS = [
    ('BP43', BOTH, 'BP43_carbon_front_fenders.glb', p.carbon_fenders),
    ('DT74', BOTH, 'DT74_twin_stalk_mirrors.glb', lambda: x.aero_mirrors('DT74', k.CARBON, twin=True)),
    ('DT75', BOTH, 'DT75_mirror_caps_accent.glb', lambda: k.build_mirror_caps('DT75', material=k.ACCENT)),
    ('DT77', BOTH, 'DT77_side_stripes_accent.glb', lambda: x.side_stripes('DT77', k.ACCENT)),
    ('RN03', BOTH, 'RN03_rally_door_plates.glb', lambda: p5.roundels('RN03', plate=(340.0, 230.0))),
    ('EX44', NA, 'EX44_twin_tips.glb', p.twin_tips),
    ('W20', ND, 'W20_wire_wheel.glb', lambda: p.wheel('W20')),
    ('W21', ND, 'W21_seven_twin_spoke.glb', lambda: p.wheel('W21')),
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
    ns = {'__name__': 'r8'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in BOTH:
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    reports = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r8_report.json').write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
