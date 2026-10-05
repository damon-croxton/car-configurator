"""Build/export the round-eleven parts for all four cars.

blender --background --factory-startup --python blender/build_r11.py

Imports the ND/NA references (as build_na_kit does) and the NB/NC models (as
build_nbnc does), then builds every spec below for each car. Geometry lives
in parts_r11.py. Writes blender/build/r11_report.json.
"""
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(r"C:/Users/Damon/car-configurator")
sys.path.insert(0, str(ROOT / 'blender'))
import mx5_lib as m
import na_kit as k
import parts_r11 as p

ALL = ('nd', 'na', 'nb', 'nc')

#: (ident, generations, file name, builder)
SPECS = [
    ('ZG01', ALL, 'ZG01_zunsport_grille_black.glb', lambda: p.grille('ZG01', 'black')),
    ('ZG02', ALL, 'ZG02_zunsport_grille_stainless.glb', lambda: p.grille('ZG02', 'stainless')),
]


def build(only=None, gens=ALL, export=True):
    reports = {}
    for gen in gens:
        k.use(gen)
        for ident, spec_gens, filename, fn in SPECS:
            if gen not in spec_gens or (only and ident not in only):
                continue
            coll = fn()
            bpy.context.view_layer.update()
            reports[f'{ident}/{gen}'] = m.stats(list(coll.objects), gen=gen)
            if export:
                m.export_glb(gen, ident, filename, coll)
                p.mask_alpha(str(ROOT / f'public/assets/mods/{gen}/{filename}'))
    return reports


def main():
    ns = {'__name__': 'r11'}
    exec(open(ROOT / 'blender/build_na_kit.py').read(), ns)   # reuse its reference import
    for gen in ('nd', 'na'):
        ns['import_reference'](gen)
        assert m.verify_frame(gen, ns['ASSETS'][gen][2]), f'{gen} frame must match anchors'
    nbnc = {'__name__': 'nbnc'}
    exec(open(ROOT / 'blender/build_nbnc.py').read(), nbnc)
    nbnc['import_cars']()
    reports = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/r11_report.json').write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
