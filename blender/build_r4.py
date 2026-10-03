"""Build/export the round-four parts for both cars.

blender --background --factory-startup --python blender/build_r4.py

Imports both reference cars (as build_na_kit does) and builds every spec
below for each generation it lists. Geometry lives in parts_r4.py, with
variants of na_kit / nd_extras builders.
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
import parts_r4 as p

BOTH = ('nd', 'na')
NA = ('na',)

#: (ident, generations, file name, builder)
SPECS = [
    ('SW01', BOTH, 'SW01_classic_wood_wheel.glb', lambda: p.steering_wheel('SW01')),
    ('SW02', BOTH, 'SW02_deep_dish_suede_wheel.glb', lambda: p.steering_wheel('SW02')),
    ('SW03', BOTH, 'SW03_flat_bottom_wheel.glb', lambda: p.steering_wheel('SW03')),
    ('SW04', BOTH, 'SW04_quick_release_wheel.glb', lambda: p.steering_wheel('SW04')),
    ('BS01', BOTH, 'BS01_carbon_buckets.glb', lambda: p.bucket_seats('BS01')),
    ('BS02', BOTH, 'BS02_sports_seats.glb', lambda: p.bucket_seats('BS02')),
    ('DT55', BOTH, 'DT55_qr_fasteners.glb', p.qr_fasteners),
    ('DT56', BOTH, 'DT56_racing_stripes_black.glb', lambda: x.racing_stripes('DT56', k.GLOSS)),
    ('DT57', BOTH, 'DT57_racing_stripes_red.glb', lambda: x.racing_stripes('DT57', k.ACCENT)),
    ('DT58', BOTH, 'DT58_side_stripes_black.glb', lambda: x.side_stripes('DT58', k.GLOSS)),
    ('DT59', BOTH, 'DT59_mirror_caps_gloss.glb', lambda: k.build_mirror_caps('DT59', material=k.GLOSS)),
    ('DT60', BOTH, 'DT60_aero_mirrors_painted.glb', lambda: x.aero_mirrors('DT60', k.PAINT)),
    ('DT61', BOTH, 'DT61_fender_flares_carbon.glb', lambda: x.fender_flares('DT61', k.CARBON)),
    ('DT49', NA, 'DT49_aero_mirrors.glb', lambda: x.aero_mirrors('DT49')),
    ('DT07', NA, 'DT07_bonnet_pins.glb', p.bonnet_pins),
    ('HT40', NA, 'HT40_hardtop.glb', p.hardtop),
    ('HT41', NA, 'HT41_hardtop_carbon.glb', lambda: p.hardtop('HT41', k.CARBON)),
    ('FG40', NA, 'FG40_grille_mesh.glb', p.grille_mesh),
    ('DT51', NA, 'DT51_front_tow_strap.glb', x.front_strap),
    ('DT46', NA, 'DT46_wind_deflector.glb', x.wind_deflector),
    ('EX42', NA, 'EX42_rolled_single.glb', p.rolled_tip),
    ('EX43', NA, 'EX43_slash_cut_single.glb', p.slash_tip),
    ('HD40', NA, 'HD40_carbon_bonnet.glb', p.carbon_bonnet),
    ('FA43', NA, 'FA43_body_colour_lip.glb', lambda: k.build_front_lip('FA43', k.PAINT)),
    ('FA44', NA, 'FA44_carbon_lip.glb', lambda: k.build_front_lip('FA44', k.CARBON)),
    ('RA45', NA, 'RA45_carbon_ducktail.glb', lambda: k.build_boot_spoiler('RA45', material=k.CARBON)),
    ('RA46', NA, 'RA46_tall_ducktail.glb', lambda: k.build_boot_spoiler('RA46', rise=40.0, chord=78.0)),
    ('RA48', NA, 'RA48_body_colour_side_extensions.glb', lambda: k.build_side_extensions('RA48', k.PAINT)),
    ('RB42', NA, 'RB42_chrome_style_bar.glb', lambda: k.build_style_bar('RB42', k.CHROME)),
    ('RA49', NA, 'RA49_carbon_track_valance.glb', lambda: k.build_rear_valance('RA49', k.CARBON, 40.0)),
]


def build():
    ns = {'__name__': 'r4'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in BOTH:
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    reports = {}
    for gen in BOTH:
        k.use(gen)
        for ident, gens, filename, fn in SPECS:
            if gen not in gens:
                continue
            coll = fn()
            bpy.context.view_layer.update()
            reports[f'{ident}/{gen}'] = m.stats(list(coll.objects), gen=gen)
            m.export_glb(gen, ident, filename, coll)
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r4_report.json').write_text(json.dumps(reports, indent=2))
    return reports


if __name__ == '__main__':
    build()
