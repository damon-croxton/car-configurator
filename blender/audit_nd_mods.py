"""Render every shipped ND accessory against its mounting surface.

Run in background Blender; --after writes a separate comparison set.
Wheel views are isolated at their exported contact-patch origin.
"""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'blender'))
import mx5_lib as m

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models/mx5_sketchfab/scene.gltf'))
bpy.context.view_layer.update()
base = set(bpy.data.objects)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'
scene.display.shading.show_shadows = True
scene.render.resolution_x = 720
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
data = bpy.data.cameras.new('AuditCamera')
camera = bpy.data.objects.new('AuditCamera', data)
scene.collection.objects.link(camera)
scene.camera = camera
data.type = 'ORTHO'
out = ROOT / 'blender/build' / ('audit_after' if '--after' in sys.argv else 'audit_before')
out.mkdir(parents=True, exist_ok=True)
catalogue = json.loads((ROOT / 'src/data/modsData.json').read_text())['mods']
reports = {}
only = next((s.split('=')[1].split(',') for s in sys.argv if s.startswith('--only=')), None)
icons='--icons' in sys.argv
if icons:
    scene.render.resolution_x=256
    scene.render.resolution_y=256
    scene.render.film_transparent=True
for mod in catalogue:
    ident = mod['id']
    if 'nd' not in mod['gen'] or (only and ident not in only):
        continue
    if icons and mod.get('attachTo')!='wheel':continue
    for obj in base:
        obj.hide_render = mod.get('attachTo') == 'wheel'
    for name in mod.get('hides', {}).get('nd', []):
        m.base_mesh(name).hide_render = True
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public' / mod['file']['nd']))
    bpy.context.view_layer.update()
    imported = set(bpy.data.objects) - before
    for obj in imported:
        if obj.parent not in imported:
            obj.matrix_world = m.export_matrix().inverted() @ obj.matrix_world
    bpy.context.view_layer.update()
    if mod.get('attachTo') == 'wheel':
        pos, target, scale = (1500, 600, 550), (0, 320, 0), 0.88
        if icons:scale=0.78
    elif ident.startswith('FA'):
        pos, target, scale = (1900, 1100, 4200), (0, 350, 1700), 2.3
    elif ident.startswith('EX') or mod.get('slot') == 'rearDiffuser' or ident in ['DT08','RA26']:
        pos, target, scale = (-1100, 550, -3900), (-160, 250, -1720), 1.9
    elif ident.startswith('RB'):
        pos, target, scale = (2100, 2300, -2800), (0, 950, -870), 2.1
    elif ident.startswith('BP0') and ident != 'BP04' or ident == 'DT07':
        pos, target, scale = (1800, 3200, 3300), (0, 750, 1130), 2.1
    elif ident in ['DT01', 'DT02']:
        pos, target, scale = (-2500, 1900, -3000), (-560, 890, -1560), 0.9
    elif mod.get('slot') == 'sideSkirts':
        pos, target, scale = (4000, 650, 200), (0, 260, 0), 3.8
    else:
        pos, target, scale = (-2600, 1800, -4000), (0, 950, -1570), 2.2
    camera.location = m.app_to_blender(*pos)
    camera.rotation_euler = (m.app_to_blender(*target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    data.ortho_scale = scale
    scene.render.filepath = str(out / f'{ident}.png')
    if icons:
        scene.render.filepath=str(ROOT/'public/assets/icons/wheels'/f"{mod.get('optionId') or ident}.png")
    bpy.ops.render.render(write_still=True)
    reports[ident] = mod['displayName']
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
if not icons:
    (out / 'labels.json').write_text(json.dumps(reports, indent=2))
