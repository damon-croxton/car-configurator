"""Build/export the round-five parts for both cars.

blender --background --factory-startup --python blender/build_r5.py

Imports both reference cars (as build_na_kit does) and builds every spec
below for each generation it lists. Geometry lives in parts_r5.py, with NA
ports of nd_extras builders. Writes blender/build/r5_report.json.
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
import parts_r5 as p

BOTH = ('nd', 'na')
NA = ('na',)
ND = ('nd',)

#: (ident, generations, file name, builder)
SPECS = [
    ('GK01', BOTH, 'GK01_weighted_ball_knob.glb', lambda: p.shift_knob('GK01')),
    ('GK02', BOTH, 'GK02_wooden_ball_knob.glb', lambda: p.shift_knob('GK02')),
    ('GK03', BOTH, 'GK03_tall_titanium_knob.glb', lambda: p.shift_knob('GK03')),
    ('FX01', BOTH, 'FX01_fire_extinguisher.glb', p.fire_extinguisher),
    ('DL01', BOTH, 'DL01_rally_lamps.glb', p.rally_lamps),
    ('RN01', BOTH, 'RN01_race_roundels.glb', p.roundels),
    ('RN02', BOTH, 'RN02_race_roundels_accent.glb', lambda: p.roundels('RN02', k.ACCENT)),
    ('DT62', BOTH, 'DT62_offset_stripe.glb', p.offset_stripe),
    ('DT63', BOTH, 'DT63_offset_stripe_black.glb', lambda: p.offset_stripe('DT63', k.GLOSS)),
    ('DT48', NA, 'DT48_fender_vents.glb', x.fender_vents),
    ('DT50', NA, 'DT50_rear_canards.glb', x.rear_canards),
    ('DT52', NA, 'DT52_rear_vents.glb', x.rear_vents),
    ('DT54', NA, 'DT54_fuel_cap.glb', x.fuel_cap),
    ('BP42', NA, 'BP42_carbon_boot_lid.glb', p.carbon_boot_lid),
    ('W12', ND, 'W12_classic_eight_spoke.glb', lambda: p.wheel('W12')),
    ('W13', ND, 'W13_pepperpot_disc.glb', lambda: p.wheel('W13')),
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
    ns = {'__name__': 'r5'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in BOTH:
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    reports = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r5_report.json').write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
