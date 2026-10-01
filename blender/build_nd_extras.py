"""Build/export the twelve ND accessories in blender/nd_extras.py.

blender --background --factory-startup --python blender/build_nd_extras.py

Also usable in a live session that already has the ND imported:
    exec(open(r"C:/Users/Damon/car-configurator/blender/build_nd_extras.py").read())
    build()
"""
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(r"C:/Users/Damon/car-configurator")
sys.path.insert(0, str(ROOT / 'blender'))
import mx5_lib as m
import na_kit as kit
import nd_extras as x

SPECS = [
    ('DT42', 'DT42_headlight_eyelids.glb', x.eyelids),
    ('DT43', 'DT43_racing_stripes.glb', x.racing_stripes),
    ('DT44', 'DT44_side_stripes.glb', x.side_stripes),
    ('DT45', 'DT45_boot_rack.glb', x.boot_rack),
    ('DT46', 'DT46_wind_deflector.glb', x.wind_deflector),
    ('DT47', 'DT47_rain_light.glb', x.rain_light),
    ('DT48', 'DT48_fender_vents.glb', x.fender_vents),
    ('DT49', 'DT49_aero_mirrors.glb', x.aero_mirrors),
    ('DT50', 'DT50_rear_canards.glb', x.rear_canards),
    ('DT51', 'DT51_front_tow_strap.glb', x.front_strap),
    ('DT52', 'DT52_rear_bumper_vents.glb', x.rear_vents),
    ('DT53', 'DT53_fender_flares.glb', x.fender_flares),
    ('RA04', 'RA04_rear_diffuser.glb', lambda: x.rear_diffuser('RA04')),
    ('RA04B', 'RA04B_rear_diffuser_carbon.glb', lambda: x.rear_diffuser('RA04B')),
]


def build():
    if not bpy.data.objects.get('Hood 6.001_120'):
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models/mx5_sketchfab/scene.gltf'))
        bpy.context.view_layer.update()
    assert m.verify_frame('nd'), 'ND frame must match anchors before authoring'
    kit.use('nd')
    reports = {}
    for ident, filename, fn in SPECS:
        coll = fn()
        bpy.context.view_layer.update()
        reports[ident] = m.stats(list(coll.objects), gen='nd')
        m.export_glb('nd', ident, filename, coll)
    out = ROOT / 'blender/build'
    out.mkdir(exist_ok=True)
    (out / 'nd_extras_report.json').write_text(json.dumps(reports, indent=2))
    return reports


if __name__ == '__main__':
    build()
