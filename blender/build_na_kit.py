"""Build/export the NA kit in an isolated Blender process.

blender --background --factory-startup --python blender/build_na_kit.py
Add `-- --render` to save review renders under blender/build (na_kit_*.png).

Also usable inside a live session that already has the NA imported:
    exec(open(r"C:/Users/Damon/car-configurator/blender/build_na_kit.py").read())
"""
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(r"C:/Users/Damon/car-configurator")
sys.path.insert(0, str(ROOT / 'blender'))
import mx5_lib as m
import na_kit as kit

SPECS = [
    ('FA40', 'FA40_front_lip.glb', kit.build_front_lip),
    ('RA40', 'RA40_side_extensions.glb', kit.build_side_extensions),
    ('RA41', 'RA41_boot_spoiler.glb', kit.build_boot_spoiler),
    ('EX40', 'EX40_big_bore.glb', kit.build_big_bore),
    ('RB40', 'RB40_style_bar.glb', kit.build_style_bar),
    ('RB41', 'RB41_track_hoop.glb', kit.build_track_hoop),
]


def import_reference():
    if bpy.data.objects.get('frontbumper_Material #71_0'):
        return
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models/mx5_na_sketchfab/scene.gltf'))
    bpy.context.view_layer.update()


def build(render=False):
    import_reference()
    assert m.verify_frame('na', 'hood_Material #71_0'), 'NA frame must match anchors before authoring'
    m.reset_mods()
    reports = {}
    for ident, filename, fn in SPECS:
        coll = fn()
        bpy.context.view_layer.update()
        reports[ident] = m.stats(list(coll.objects), gen='na')
        m.export_glb('na', ident, filename, coll)
    out = ROOT / 'blender/build'
    out.mkdir(exist_ok=True)
    (out / 'na_kit_report.json').write_text(json.dumps(reports, indent=2))
    if render:
        exec(open(ROOT / 'blender/na_review.py').read(), globals())
        only('FA40', 'RA40', 'RA41', 'EX40', 'RB40')
        review('kit', views=['front_low', 'side', 'rear34', 'spoiler', 'cabin'])
    return reports


if __name__ == '__main__':
    build(render='--render' in sys.argv)
