"""Build/export the shared mods for the NB and NC.

blender --background --factory-startup --python blender/build_nbnc.py

Imports the shipped NB/NC models (public/assets/models/mx5_<id>/scene.glb),
rebuilds the ray-cast helpers (prepare_nb_nc.make_helpers), then runs the
same builders as the ND/NA rounds with each car's GEN_CFG/CFG row. File
names match the ND/NA files of the same mod. Writes blender/build/nbnc_report.json.
"""
import json
import os
import sys
from pathlib import Path
import bpy

ROOT = Path(r"C:/Users/Damon/car-configurator")
sys.path.insert(0, str(ROOT / 'blender'))
import mx5_lib as m
import na_kit as k
import nd_extras as x
import parts_r5 as p5
import parts_r6 as p6
import parts_r7 as p7
import parts_r10 as p10

GENS = ('nb', 'nc')

#: (ident, builder). Every builder reads the car from na_kit.use().
SPECS = [
    ('DT43', lambda: x.racing_stripes('DT43')),
    ('DT56', lambda: x.racing_stripes('DT56', k.GLOSS)),
    ('DT57', lambda: x.racing_stripes('DT57', k.ACCENT)),
    ('DT44', lambda: x.side_stripes('DT44')),
    ('DT58', lambda: x.side_stripes('DT58', k.GLOSS)),
    ('DT77', lambda: x.side_stripes('DT77', k.ACCENT)),
    ('DT45', lambda: x.boot_rack('DT45')),
    ('DT65', lambda: x.boot_rack('DT65', k.GLOSS)),
    ('DT53', lambda: x.fender_flares('DT53')),
    ('DT61', lambda: x.fender_flares('DT61', k.CARBON)),
    ('DT70', lambda: x.fender_flares('DT70', k.PAINT, width=60.0, swell=42.0, rivets=k.CHROME)),
    ('DT71', lambda: x.fender_flares('DT71', k.PAINT)),
    ('DT62', lambda: p5.offset_stripe('DT62')),
    ('DT63', lambda: p5.offset_stripe('DT63', k.GLOSS)),
    ('DT69', lambda: p5.offset_stripe('DT69', k.ACCENT)),
    ('RN01', lambda: p5.roundels('RN01')),
    ('RN02', lambda: p5.roundels('RN02', k.ACCENT)),
    ('RN03', lambda: p5.roundels('RN03', plate=(340.0, 230.0))),
    ('DL01', lambda: p5.rally_lamps('DL01')),
    ('DL02', lambda: p5.rally_lamps('DL02', covered=True)),
    ('DT67', lambda: p6.bonnet_wrap('DT67')),
    ('DT78', lambda: p6.bonnet_wrap('DT78', k.CARBON)),
    ('DT79', lambda: p6.bonnet_wrap('DT79', k.ACCENT)),
    ('DT66', lambda: p6.pinstripes('DT66')),
    ('SP01', lambda: p6.skid_plate('SP01')),
    ('DT30', lambda: p6.mud_flaps('DT30')),
    ('DT72', lambda: p7.naca_ducts('DT72')),
    ('WB01', lambda: p10.wide_fenders('WB01', k.PAINT, k.CHROME)),
    ('WB02', lambda: p10.wide_fenders('WB02', k.CARBON, k.CHROME)),
    ('WB03', lambda: p10.wide_fenders('WB03', k.SATIN, k.ALLOY)),
    ('WB10', lambda: p10.wide_lip('WB10')),
    ('WB11', lambda: p10.wide_skirts('WB11')),
    ('WB12', lambda: p10.wide_diffuser('WB12')),
    ('WB13', lambda: p10.ducktail('WB13')),
    ('WB14', lambda: p10.ducktail('WB14', material=k.CARBON)),
    ('RA60', lambda: p10.wing('RA60', 'double')),
    ('RA61', lambda: p10.wing('RA61', 'time_attack')),
]


def filename(ident):
    """The file name the ND/NA versions of this mod already use."""
    mods = json.loads((ROOT / 'src/data/modsData.json').read_text(encoding='utf8'))['mods']
    entry = next(e for e in mods if e['id'] == ident)
    return os.path.basename(next(iter(entry['file'].values())))


def build(only=None, gens=GENS, export=True):
    reports, errors = {}, {}
    for gen in gens:
        k.use(gen)
        for ident, fn in SPECS:
            if only and ident not in only:
                continue
            try:
                coll = fn()
            except Exception as exc:          # report and carry on with the rest
                errors[f'{ident}/{gen}'] = f'{type(exc).__name__}: {exc}'
                continue
            bpy.context.view_layer.update()
            reports[f'{ident}/{gen}'] = m.stats(list(coll.objects), gen=gen)
            if export:
                m.export_glb(gen, ident, filename(ident), coll)
    return reports, errors


def import_cars():
    """Import the shipped NB/NC models into NB_SRC / NC_SRC and rebuild the
    ray-cast helpers."""
    import prepare_nb_nc
    for gen in GENS:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / f'public/assets/models/mx5_{gen}/scene.glb'))
        coll = bpy.data.collections.new(f'{gen.upper()}_SRC')
        bpy.context.scene.collection.children.link(coll)
        for o in set(bpy.data.objects) - before:
            for c in list(o.users_collection):
                c.objects.unlink(o)
            coll.objects.link(o)
    prepare_nb_nc.make_helpers()


def main():
    import_cars()
    reports, errors = build()
    (ROOT / 'blender/build').mkdir(exist_ok=True)
    (ROOT / 'blender/build/nbnc_report.json').write_text(json.dumps(reports, indent=2))
    if errors:
        print('NB/NC build errors:', json.dumps(errors, indent=2))


if __name__ == '__main__':
    main()
