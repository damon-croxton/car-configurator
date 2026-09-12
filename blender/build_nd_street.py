"""Build/export the ND street kit in an isolated Blender process.

blender --background --factory-startup --python blender/build_nd_street.py
Add `-- --render` to save reference-car inspection views under blender/build.
"""
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
import mx5_lib as m
import nd_street_kit as kit


def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/mx5_sketchfab/scene.gltf'))
    bpy.context.view_layer.update()
    assert m.verify_frame(), 'Reference frame must match anchors before authoring'
    specs=[('FA01','FA01_front_lip.glb',kit.build_front),
           ('RA06','RA06_side_skirts.glb',lambda:kit.build_skirts('RA06')),
           ('RA06B','RA06B_side_skirts_carbon.glb',lambda:kit.build_skirts('RA06B')),
           ('RA01','RA01_ducktail.glb',lambda:kit.build_spoiler('RA01')),
           ('RA05','RA05_lip_spoiler.glb',lambda:kit.build_spoiler('RA05'))]
    reports={}
    for ident,filename,fn in specs:
        coll=fn()
        bpy.context.view_layer.update()
        reports[ident]=m.stats(coll)
        m.export_glb('nd',ident,filename,coll)
    out=ROOT/'blender/build'
    out.mkdir(exist_ok=True)
    (out/'nd_street_report.json').write_text(json.dumps(reports,indent=2))
    if '--render' in sys.argv:
        render_views()


def render_views():
    # Show one of each variant with the untouched reference body.
    for ident in ['RA06B','RA05']:
        for obj in bpy.data.collections[f'MOD_ND_{ident}'].objects:
            obj.hide_render=True
    scene=bpy.context.scene
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.render.resolution_x=1440
    scene.render.resolution_y=1080
    scene.render.resolution_percentage=100
    data=bpy.data.cameras.new('StreetReviewCamera')
    camera=bpy.data.objects.new('StreetReviewCamera',data)
    scene.collection.objects.link(camera)
    scene.camera=camera
    data.type='ORTHO'
    views=[('front',(4300,2400,5800),(0,600,100),5.2),
           ('rear',(-3400,2100,-4800),(0,700,-750),4.3),
           ('top',(0,6500,0),(0,600,0),5.6),
           ('front_detail',(2200,900,4300),(0,180,1770),2.5),
           ('rear_detail',(-2200,1500,-4200),(0,850,-1660),2.1),
           ('side',(5000,900,0),(0,230,0),4.6)]
    for label,pos,target,scale in views:
        camera.location=m.app_to_blender(*pos)
        camera.rotation_euler=(m.app_to_blender(*target)-camera.location).to_track_quat('-Z','Y').to_euler()
        data.ortho_scale=scale
        scene.render.filepath=str(ROOT/f'blender/build/nd_street_{label}.png')
        bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    build()
