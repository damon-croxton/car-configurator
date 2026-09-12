"""Register the ND aero collection; refresh bounds after building its GLBs.

Run once before build_nd_aero_expansion.py and again after it. Existing entries
outside this collection are preserved, including their original formatting.
"""
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SPECS=[
 ('FA20','frontLip','msr_split_lip','MSR-style Split Lip','Two carbon halves with a centre gap and raised corner edges.'),
 ('FA21','frontLip','three_piece_lip','Three-piece Street Lip','Deep satin corner blades, a centre bridge and three small ribs.'),
 ('FA22',None,None,'Stacked Carbon Canards','Two curved dive planes per side; replaces the single canards.'),
 ('RA20','sideSkirts','msr_side_blades','MSR-style Side Blades','Slim carbon steps with a raised rear shoulder.'),
 ('RA21','sideSkirts','rs_sculpted_skirts','RS-style Sculpted Skirts','Deep, curved carbon sill panels with tapered ends.'),
 ('RA22','rearWing','msr_blade_spoiler','MSR-style Blade Spoiler','Thin upright carbon blade with a lower centre section.'),
 ('RA23','rearWing','touring_ducktail','Touring Ducktail','A broad, rounded body-colour spoiler with a swept trailing edge.'),
 ('RA24','rearWing','swan_neck_wing','Low Swan-neck Wing','Curved carbon airfoil on low top-mounted supports.'),
 ('RA25','rearDiffuser','mp_street_diffuser','MP-style Street Diffuser','Curved satin valance and four fins, with clearance for side-exit tips.'),
 ('RA26',None,None,'Carbon Rear Spats','Small fitted corner extensions behind both rear wheels.'),
]
report_path=ROOT/'blender/build/nd_aero_report.json'
report=json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {}
mods_path=ROOT/'src/data/modsData.json'
raw=mods_path.read_text(encoding='utf-8')
entries=json.loads(raw)['mods']
for ident,slot,option,name,hint in SPECS:
    front=ident.startswith('FA')
    anchor='BumperF 6.003_111' if front else ('Skirts 6.003_57' if slot=='sideSkirts' else ('BumperR 6.001_146' if ident in ['RA25','RA26'] else 'Boot 6.001_157'))
    info=report.get(ident,{})
    entry={'id':ident,'gen':['nd'],'category':'front aero' if front else 'rear aero',
           'displayName':name,'slot':slot,'optionId':option,'attachType':'bolt_on','attachTo':'body',
           'hides':{'nd':[]},'incompatibleWith':['FA05'] if ident=='FA22' else [],'requires':[],
           'anchors':{'nd':[anchor]},'materials':sorted(set(re.sub(r'\.\d{3}$','',s) for s in info.get('materials',['MOD_CarbonWeave']))),
           'bboxMm':{'nd':info.get('bbox_app_mm',{'min':[-1,-1,-1],'max':[1,1,1]})},
           'triangleBudget':6500,'uiHint':hint,
           'file':{'nd':f'assets/mods/nd/{ident}_{option or ("stacked_canards" if front else "rear_spats")}.glb'},
           'flags':{'requiresFenderRoll':False,'trackWidening':0},'derivedFromBaseMesh':False,
           '$note':'Original supplier-inspired visual concept. See blender/ND-AERO-REFERENCES.md; no measured product dimensions or aerodynamic claims.'}
    encoded=json.dumps(entry,indent=2)
    encoded='\n'.join('    '+line if i else line for i,line in enumerate(encoded.splitlines()))
    # Limit searches to the actual mods array, excluding the old roadmap.
    start=raw.find(f'"id": "{ident}"',raw.index('"mods":'))
    if start<0:
        end=raw.rfind(']')
        raw=raw[:end].rstrip()+',\n    '+encoded+'\n  '+raw[end:]
    else:
        start=raw.rfind('{',0,start)
        _,length=json.JSONDecoder().raw_decode(raw[start:])
        raw=raw[:start]+encoded+raw[start+length:]
mods_path.write_text(raw,encoding='utf-8')

carpath=ROOT/'src/data/carData.json'
car=json.loads(carpath.read_text(encoding='utf-8'))
nd=next(g for g in car['generations'] if g['id']=='nd')
for ident,slot,option,name,hint in SPECS:
    if not slot:continue
    if option not in nd['aero'][slot]:nd['aero'][slot].append(option)
    material='paint' if ident=='RA23' else ('trim' if ident in ['FA21','RA25'] else 'carbon')
    entry={'id':option,'name':name,'node':f'MOD_ND_{ident}','material':material,
           'downforce':0,'weight':0,'description':hint}
    old=next((i for i,p in enumerate(car['aeroParts'][slot]) if p['id']==option),None)
    if old is None:car['aeroParts'][slot].append(entry)
    else:car['aeroParts'][slot][old]=entry
carpath.write_text(json.dumps(car,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('Registered',len(SPECS),'ND aero concepts;',len(report),'measured bounds')
