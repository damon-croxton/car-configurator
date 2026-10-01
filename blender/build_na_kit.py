"""Build/export the NA kit, and the accessories it shares with the ND.

blender --background --factory-startup --python blender/build_na_kit.py
Add `-- --render` to save review renders under blender/build.

Both reference cars are imported into one scene, in NA_REF and ND_REF, so
the shared accessories (sun strip, mirror caps) are built for each from the
same code. Also usable inside a live session:
    exec(open(r"C:/Users/Damon/car-configurator/blender/build_na_kit.py").read())
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

NA_SPECS = [
    ('FA40', 'FA40_front_lip.glb', kit.build_front_lip),
    ('RA40', 'RA40_side_extensions.glb', kit.build_side_extensions),
    ('RA41', 'RA41_boot_spoiler.glb', kit.build_boot_spoiler),
    ('EX40', 'EX40_big_bore.glb', kit.build_big_bore),
    ('RB40', 'RB40_style_bar.glb', kit.build_style_bar),
    ('RB41', 'RB41_track_hoop.glb', kit.build_track_hoop),
    ('FA41', 'FA41_carbon_splitter.glb', kit.build_splitter),
    ('RA42', 'RA42_side_extenders_carbon.glb', lambda: kit.build_side_extensions('RA42', kit.CARBON)),
    ('RA43', 'RA43_rear_valance.glb', kit.build_rear_valance),
    ('RA44', 'RA44_gt_wing.glb', kit.build_gt_wing),
    ('BP41', 'BP41_bonnet_vents.glb', kit.build_bonnet_vents),
    ('EX41', 'EX41_twin_oval.glb', kit.build_twin_oval),
    ('FA42', 'FA42_tow_hook.glb', kit.build_tow_hook),
    ('DT40', 'DT40_sun_strip.glb', kit.build_sun_strip),
    ('DT41', 'DT41_mirror_caps.glb', kit.build_mirror_caps),
]

ND_SPECS = [
    ('DT40', 'DT40_sun_strip.glb',
     lambda: kit.build_sun_strip(glass_names=('Glass 6.002_6', 'Glass 6.001_5'), half=560.0, band=115.0)),
    ('DT41', 'DT41_mirror_caps.glb', kit.build_mirror_caps),
]

ASSETS = {
    'na': ('NA_REF', 'public/assets/models/mx5_na_sketchfab/scene.gltf', 'hood_Material #71_0'),
    'nd': ('ND_REF', 'public/assets/models/mx5_sketchfab/scene.gltf', 'Hood 6.001_120'),
}


def import_reference(gen):
    name, path, probe = ASSETS[gen]
    if bpy.data.objects.get(probe):
        return
    scene = bpy.context.scene
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if coll.name not in scene.collection.children:
        scene.collection.children.link(coll)
    layer = bpy.context.view_layer
    layer.active_layer_collection = layer.layer_collection.children[coll.name]
    bpy.ops.import_scene.gltf(filepath=str(ROOT / path))
    layer.update()


def build(render=False):
    if not bpy.data.objects.get(ASSETS['na'][2]) and not bpy.data.objects.get(ASSETS['nd'][2]):
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
    for gen in ('na', 'nd'):
        import_reference(gen)
        assert m.verify_frame(gen, ASSETS[gen][2]), f'{gen} frame must match anchors before authoring'
    m.reset_mods()
    reports = {}
    for gen, specs in (('na', NA_SPECS), ('nd', ND_SPECS)):
        kit.use(gen)
        for ident, filename, fn in specs:
            coll = fn()
            bpy.context.view_layer.update()
            reports[f'{ident}/{gen}'] = m.stats(list(coll.objects), gen=gen)
            m.export_glb(gen, ident, filename, coll)
    out = ROOT / 'blender/build'
    out.mkdir(exist_ok=True)
    (out / 'na_kit_report.json').write_text(json.dumps(reports, indent=2))
    if render:
        exec(open(ROOT / 'blender/na_review.py').read(), globals())
        only('FA41', 'RA43', 'RA44', 'BP41', 'EX41', 'FA42', 'DT40', 'DT41', 'RB40')
        review('kit', views=['front_low', 'side', 'rear34', 'cabin'])
    return reports


if __name__ == '__main__':
    build(render='--render' in sys.argv)
