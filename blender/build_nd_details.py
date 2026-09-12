"""Rebuild the ND detail catalogue; independent of interactive Blender files."""
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
import mx5_lib as m
import nd_detail_kit as kit
import nd_wheel_refinement as wheels
import nd_street_kit as street


def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/mx5_sketchfab/scene.gltf'))
    bpy.context.view_layer.update()
    assert m.verify_frame()
    specs={'FA03':kit.front_splitter,'FA05':kit.dive_planes,'FA06':kit.tow_hook,
           'RA02':kit.wing,'DT07':kit.pins,'DT08':kit.strap,'BP04':kit.carbon_boot}
    for ident in ['BP01','BP03']:
        specs[ident]=lambda i=ident:kit.bonnet(i)
    for ident in ['RA04','RA04B']:
        specs[ident]=lambda i=ident:kit.diffuser(i)
    for ident in ['EX01','EX02','EX03','EX06']:
        specs[ident]=lambda i=ident:kit.exhaust(i)
    for ident in ['DT01','DT02']:
        specs[ident]=lambda i=ident:kit.antenna(i)
    for ident in ['RB01','RB02']:
        specs[ident]=lambda i=ident:kit.roll_bar(i)
    for ident in ['W01','W04','W05','W07','W09']:
        specs[ident]=lambda i=ident:wheels.build(i)
    catalogue=json.loads((ROOT/'src/data/modsData.json').read_text())['mods']
    out=ROOT/'blender/build'
    out.mkdir(exist_ok=True)
    report_path=out/'nd_details_report.json'
    only=next((s.split('=')[1].split(',') for s in sys.argv if s.startswith('--only=')),None)
    reports=json.loads(report_path.read_text()) if only and report_path.exists() else {}
    for ident,fn in specs.items():
        if only and ident not in only:
            continue
        coll=fn()
        bpy.context.view_layer.update()
        reports[ident]=m.stats(coll)
        assert reports[ident]['loose_verts']==0,ident
        assert reports[ident]['non_manifold_edges']==0,ident
        if ident in ['BP01','BP03']:
            panel=bpy.data.objects[f'MOD_ND_{ident}_panel']
            reference=m.base_mesh('Hood 6.001_120')
            # Regression probes for the former cross-panel band and cowl cut.
            for x,z in [(0,800),(-560,1180),(560,1180),(0,1600)]+([(0,1180)] if ident=='BP01' else []):
                assert abs(street.height(panel,x,z)-street.height(reference,x,z))<0.5,(ident,x,z)
            for x,z in ([(-315,1180),(315,1180)] if ident=='BP01' else [(0,1180)]):
                assert street.ray(panel,(x,2000,z),(0,-1,0)) is None,(ident,'vent closed',x,z)
        entry=next(e for e in catalogue if e['id']==ident)
        origin=entry.get('originMm',{}).get('nd')
        m.export_glb('nd',ident,Path(entry['file']['nd']).name,coll,origin=origin)
    report_path.write_text(json.dumps(reports,indent=2))


if __name__=='__main__':
    build()
