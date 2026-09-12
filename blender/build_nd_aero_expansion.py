"""Rebuild the supplier-inspired ND aero collection and its measured bounds."""
import json
import sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
import mx5_lib as m
import nd_street_kit as k
from nd_aero_expansion import BUILDERS

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/mx5_sketchfab/scene.gltf'))
bpy.context.view_layer.update()
assert m.verify_frame()
catalogue=json.loads((ROOT/'src/data/modsData.json').read_text())['mods']
out=ROOT/'blender/build'
out.mkdir(exist_ok=True)
report_path=out/'nd_aero_report.json'
only=next((s.split('=')[1].split(',') for s in sys.argv if s.startswith('--only=')),None)
reports=json.loads(report_path.read_text()) if only and report_path.exists() else {}
for ident,fn in BUILDERS.items():
    if only and ident not in only:continue
    coll=fn()
    bpy.context.view_layer.update()
    info=m.stats(coll)
    if ident=='RA24':
        # Check the tilted stock antenna at airfoil height, not just its foot.
        for node in ['FendersR 6_39','FendersR 6.002_41']:
            antenna=m.base_mesh(node)
            points=[k.app(antenna.matrix_world@v.co) for v in antenna.data.vertices]
            for edge in antenna.data.edges:
                a,b=(points[j] for j in edge.vertices)
                for y in [1040,1070,1100,1130]:
                    if min(a.y,b.y)<y<max(a.y,b.y):
                        p=a.lerp(b,(y-a.y)/(b.y-a.y))
                        leading=-1690+45*(abs(p.x)/710)**2
                        assert p.z-leading>25,('Antenna/wing clearance',p)
    assert info['loose_verts']==0 and info['non_manifold_edges']==0,(ident,info)
    entry=next(e for e in catalogue if e['id']==ident)
    assert info['triangles'] <= entry['triangleBudget'],(ident,info['triangles'])
    m.export_glb('nd',ident,Path(entry['file']['nd']).name,coll)
    reports[ident]=info
report_path.write_text(json.dumps(reports,indent=2))
print('AERO BUILD COMPLETE:',', '.join(reports))
