"""Blender --background --factory-startup --python blender/build_nd_club_expansion.py.

Build, validate topology, export and register the new collection in one pass.
Optional -- --only=W10,W11 rebuilds only those assets.
"""
import json
import re
import sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
import mx5_lib as m
from nd_club_expansion import BUILDERS

SPECS=[
 ('W10','wheelStyle','concave_split_five','Concave Split Five','CR Kiwami-inspired splayed spokes, a deep centre and four exposed lugs.'),
 ('W11','wheelStyle','retro_three_spoke','Retro Three Spoke','Three swept paddles, an inset centre and a polished step lip.'),
 ('FA30','frontLip','carbon_corner_splitters','Carbon Corner Splitters','Two separate fitted corner blades with an open centre.'),
 ('RA30','sideSkirts','race_side_steps','Race Side Steps','Wide flat carbon blades with integrated end fences.'),
 ('RA31','rearWing','gurney_flap','Gurney Flap','A slim satin L-section blade following the boot edge.'),
 ('RA32','rearWing','club_bridge_spoiler','Club Bridge Spoiler','A low body-colour airfoil on two sculpted pedestals.'),
 ('EX30','exhaust','slash_cut_twin','Slash-cut Titanium Twins','Two hollow angled tips with recessed bores.'),
 ('EX31','exhaust','rolled_single','Rolled-edge Single','A large rolled stainless outlet with an open dark bore.'),
 ('DT30',None,None,'Rally Mud Flaps','Four shaped rubber flaps with metal fasteners.'),
 ('DT31',None,None,'Rear Tow Eye','An accent-colour rear tow ring with a metal shaft and fitted socket.'),
]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/mx5_sketchfab/scene.gltf'))
bpy.context.view_layer.update()
assert m.verify_frame()
mods_path=ROOT/'src/data/modsData.json'
raw=mods_path.read_text(encoding='utf-8')
car_path=ROOT/'src/data/carData.json'
car=json.loads(car_path.read_text(encoding='utf-8'))
nd=next(g for g in car['generations'] if g['id']=='nd')
only=next((a.split('=')[1].split(',') for a in sys.argv if a.startswith('--only=')),None)
out=ROOT/'blender/build'
out.mkdir(exist_ok=True)
report_path=out/'nd_club_report.json'
reports=json.loads(report_path.read_text()) if only and report_path.exists() else {}
for ident,slot,option,name,hint in SPECS:
    if only and ident not in only:continue
    coll=BUILDERS[ident]()
    bpy.context.view_layer.update()
    info=m.stats(coll)
    wheel=slot=='wheelStyle'
    budget=18000 if wheel else 6500
    assert info['loose_verts']==0 and info['non_manifold_edges']==0,(ident,info)
    assert info['triangles']<=budget,(ident,info['triangles'])
    origin=[734,0,1194] if wheel else None
    bounds=info['bbox_app_mm']
    if origin:bounds={key:[v-o for v,o in zip(values,origin)] for key,values in bounds.items()}
    anchor='Tire_Regular_S_FL 1_193' if wheel else ('BumperF 6.003_111' if ident=='FA30' else
           'Skirts 6.003_57' if ident in ['RA30','DT30'] else 'Boot 6.001_157' if slot=='rearWing' else
           'Exhausts 6_124' if slot=='exhaust' else 'BumperR 6.001_146')
    entry={'id':ident,'gen':['nd'],'category':'wheel' if wheel else 'exhaust' if slot=='exhaust' else
           'details' if slot is None else 'front aero' if ident=='FA30' else 'rear aero',
           'displayName':name,'slot':slot,'optionId':option,'attachType':'replace' if wheel or slot=='exhaust' else 'bolt_on',
           'attachTo':'wheel' if wheel else 'body','hides':{'nd':['Exhausts 6_124'] if slot=='exhaust' else []},
           'incompatibleWith':['RA26'] if ident=='DT30' else [],'requires':[],
           'anchors':{'nd':[anchor]},'materials':sorted(set(re.sub(r'\.\d{3}$','',s) for s in info['materials'])),
           'bboxMm':{'nd':bounds},'triangleBudget':budget,'uiHint':hint,
           'file':{'nd':f'assets/mods/nd/{ident}_{option or ("mud_flaps" if ident=="DT30" else "rear_tow_eye")}.glb'},
           'flags':{'requiresFenderRoll':False,'trackWidening':0},'derivedFromBaseMesh':False,
           '$note':'Original visual concept; no vendor mesh, logo, measured product dimensions or performance claims. Rebuild with blender/build_nd_club_expansion.py.'}
    if wheel:
        entry['originMm']={'nd':origin}
        entry['hidesSurfaceClasses']=['rim','rim_badge','tyre']
    m.export_glb('nd',ident,Path(entry['file']['nd']).name,coll,origin=origin)
    encoded=json.dumps(entry,indent=2)
    encoded='\n'.join('    '+line if i else line for i,line in enumerate(encoded.splitlines()))
    start=raw.find(f'"id": "{ident}"',raw.index('"mods":'))
    if start<0:
        end=raw.rfind(']')
        raw=raw[:end].rstrip()+',\n    '+encoded+'\n  '+raw[end:]
    else:
        start=raw.rfind('{',0,start)
        _,length=json.JSONDecoder().raw_decode(raw[start:])
        raw=raw[:start]+encoded+raw[start+length:]
    if slot:
        if wheel:
            if option not in nd['wheels']:nd['wheels'].append(option)
            items=car['wheelStyles']
            value={'id':option,'name':name,'brand':'Club','spokeType':'split_five' if ident=='W10' else 'three_spoke',
                   'spokeCount':5 if ident=='W10' else 3,'lipDepth':.045,'weightPerCorner':9.1,'oem':False,'description':hint}
        else:
            if option not in nd['aero'][slot]:nd['aero'][slot].append(option)
            items=car['aeroParts'][slot]
            value={'id':option,'name':name,'node':f'MOD_ND_{ident}',
                   'material':'paint' if ident=='RA32' else 'carbon' if ident in ['FA30','RA30'] else 'trim',
                   'downforce':0,'weight':0,'description':hint}
        old=next((i for i,p in enumerate(items) if p['id']==option),None)
        if old is None:items.append(value)
        else:items[old]=value
    # Persist each successful asset so an interrupted batch can resume safely.
    mods_path.write_text(raw,encoding='utf-8')
    car_path.write_text(json.dumps(car,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    reports[ident]=info
    report_path.write_text(json.dumps(reports,indent=2))
print('CLUB COLLECTION COMPLETE:',', '.join(reports))
