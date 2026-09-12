"""Idempotently recess sourced-wheel brakes behind the measured spoke face.

Keeps the third-party rims and their materials intact. Run after rebuilding
WS01/WS02 from their original source scripts.
"""
import json,sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
import mx5_lib as m
import nd_street_kit as k
import nd_detail_kit as d

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
reports={}
entries=json.loads((ROOT/'src/data/modsData.json').read_text())['mods']
for ident in ['WS01','WS02']:
    entry=next(e for e in entries if e['id']==ident)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public'/entry['file']['nd']))
    bpy.context.view_layer.update()
    imported=set(bpy.data.objects)-before
    origin=entry['originMm']['nd']
    translate=Matrix.Translation((origin[0]/1000,-origin[2]/1000,origin[1]/1000))
    for o in imported:
        if o.parent not in imported:o.matrix_world=m.export_matrix().inverted()@translate@o.matrix_world
    bpy.context.view_layer.update()
    coll=m.start_mod('nd',ident)
    for o in list(imported):
        if o.type!='MESH':continue
        world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
        m.put(o,coll);m.activate(o)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    brakes=[o for o in coll.objects if o.name.endswith(('_disc','_caliper'))]
    # Sample only the middle of the spokes, excluding tyre/barrel and hub.
    points=[]
    for o in coll.objects:
        if o in brakes or o.name.endswith(('_tyre','_lugs')):continue
        for v in o.data.vertices:
            p=k.app(v.co);r=((p.y-320.5)**2+(p.z-1194)**2)**0.5
            if 110<r<185:points.append(p.x)
    assert points and brakes
    if ident=='WS02' and max(points)<origin[0]:
        # This source was shipped with the mounting side facing outward.
        # Rotate the rim around its hub; tyre and caliper remain independent.
        for o in coll.objects:
            if o in brakes or o.name.endswith(('_tyre','_lugs')):continue
            for v in o.data.vertices:
                p=k.app(v.co);p.x=2*734-p.x;p.z=2*1194-p.z
                v.co=m.app_to_blender(*p)
        points=[2*734-x for x in points]
    # Frontmost spoke envelope is sampled well away from the hub. A generous
    # 65 mm setback clears the full spoke thickness and the caliper body.
    target=max(points)-65
    current=max(k.app(v.co).x for o in brakes for v in o.data.vertices)
    delta=target-current
    for o in brakes:
        for v in o.data.vertices:
            p=k.app(v.co);p.x+=delta;v.co=m.app_to_blender(*p)
        if o.name.endswith('_caliper') and len(o.data.polygons)<=12:
            m.bevel_smooth(o,width=0.006,segments=3)
    d.finish(coll)
    reports[ident]=m.stats(coll)
    reports[ident]['brakeShiftMm']=round(delta,2)
    m.export_glb('nd',ident,Path(entry['file']['nd']).name,coll,origin=origin)
(ROOT/'blender/build/nd_sourced_report.json').write_text(json.dumps(reports,indent=2))
