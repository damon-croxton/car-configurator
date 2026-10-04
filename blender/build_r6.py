"""Build/export the round-six parts for both cars.

blender --background --factory-startup --python blender/build_r6.py

Imports both reference cars (as build_na_kit does) and builds every spec
below for each generation it lists. Geometry lives in parts_r6.py, with
variants of parts_r5 / nd_extras builders. Writes blender/build/r6_report.json.
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
import parts_r6 as p

BOTH = ('nd', 'na')
NA = ('na',)
ND = ('nd',)

#: (ident, generations, file name, builder)
SPECS = [
    ('HN01', BOTH, 'HN01_harnesses.glb', p.harnesses),
    ('GK04', BOTH, 'GK04_cue_ball_knob.glb', lambda: p5.shift_knob('GK04')),
    ('DT64', BOTH, 'DT64_chrome_bullet_mirrors.glb', lambda: x.aero_mirrors('DT64', k.CHROME)),
    ('DT65', BOTH, 'DT65_boot_rack_black.glb', lambda: x.boot_rack('DT65', k.GLOSS)),
    ('DT66', BOTH, 'DT66_pinstripes.glb', p.pinstripes),
    ('DT67', BOTH, 'DT67_bonnet_wrap.glb', p.bonnet_wrap),
    ('DT69', BOTH, 'DT69_offset_stripe_red.glb', lambda: p5.offset_stripe('DT69', k.ACCENT)),
    ('DL02', BOTH, 'DL02_rally_lamps_covered.glb', lambda: p5.rally_lamps('DL02', covered=True)),
    ('SP01', BOTH, 'SP01_skid_plate.glb', p.skid_plate),
    ('DT30', NA, 'DT30_mud_flaps.glb', p.mud_flaps),
    ('W14', ND, 'W14_turbofan.glb', lambda: p.wheel('W14')),
    ('W15', ND, 'W15_deep_dish_six.glb', lambda: p.wheel('W15')),
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
    ns = {'__name__': 'r6'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in BOTH:
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    reports = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r6_report.json').write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
