"""Refresh metadata from measured build reports without reformatting the catalogue."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'src/data/modsData.json'
raw=path.read_text(encoding='utf-8')
reports={}
for name in ['nd_details_report.json','nd_sourced_report.json']:
    reports.update(json.loads((ROOT/'blender/build'/name).read_text()))
catalogue=json.loads(raw)
decoder=json.JSONDecoder()
notes={
 'FA03':'Fitted 10 mm carbon blade with slim angled stays and mounting feet.',
 'FA05':'One curved carbon canard per corner, fitted along the bumper surface.',
 'FA06':'Forward-facing tow eye with a threaded shaft and bumper socket.',
 'RA02':'Curved carbon airfoil, shaped endplates and swept uprights on fitted boot feet.',
 'RA04':'Underbody tray with downward strakes and open side-exit exhaust clearance.',
 'RA04B':'Carbon underbody tray with downward strakes and open side-exit exhaust clearance.',
 'BP01':'Original bonnet perimeter with clean bounded apertures, fitted louvres and embedded carbon weave.',
 'BP03':'Original bonnet perimeter with a bounded tapered inlet and recessed throat.',
 'BP04':'Original boot surface and shut lines with a thin carbon skin and embedded weave.',
 'DT01':'Slim 80 mm mast with a foot fitted to the quarter-panel slope.',
 'DT02':'Small black delete cap fitted to the quarter-panel slope.',
 'DT07':'Low-profile pins with retaining clips and curved thin tethers.',
 'DT08':'Rounded fabric loop attached at its upper bolt.',
 'RB01':'Single bent hoop behind the seats with rear stays; clears the soft top.',
 'RB02':'Single bent hoop with a diagonal and harness crossbar; clears the soft top.',
 'EX01':'Single rolled-edge round tip with a recessed open bore.',
 'EX02':'Compact twin round tips with recessed open bores.',
 'EX06':'Compact twin oval tips with recessed open bores.',
 'EX03':'Four titanium tips in two symmetric pairs, with recessed open bores.',
}
for entry in catalogue['mods']:
    ident=entry['id']
    if ident not in reports:continue
    report=reports[ident]
    origin=entry.get('originMm',{}).get('nd',[0,0,0])
    bbox={edge:[round(v-origin[i]) for i,v in enumerate(report['bbox_app_mm'][edge])] for edge in ['min','max']}
    update={'bboxMm':{'nd':bbox},'materials':sorted({re.sub(r'\.\d+$','',n) for n in report['materials']})}
    note=notes.get(ident,'Curved spoke geometry with a stepped barrel, four lug nuts and inset brake hardware.' if ident.startswith('W0') else 'Original sourced rim retained; brake hardware recessed behind its spokes.')
    update['uiHint']=note
    update['$note']=note+' Rebuilt by blender/build_nd_details.py and blender/fix_nd_sourced_brakes.py; dimensions are visual concepts, not manufacturing specifications.'
    if ident=='DT07':update['triangleBudget']=2200
    if ident=='EX03':update['displayName']='Quad Titanium Tips'
    if ident=='RB02':update['displayName']='Braced Hoop + Harness Bar'
    if ident=='W01':update['displayName']='Lightweight Twin 6-Spoke'
    # Locate the actual shipped entry, never the earlier roadmap row.
    start=raw.index('"id": "'+ident+'"',raw.index('"mods":'))
    start=raw.rfind('{',0,start)
    _,length=decoder.raw_decode(raw[start:])
    end=start+length
    block=raw[start:end]
    for field,value in update.items():
        match=re.search(r'"'+re.escape(field)+r'"\s*:\s*',block)
        encoded=json.dumps(value,ensure_ascii=False)
        if match:
            _,n=decoder.raw_decode(block[match.end():])
            block=block[:match.end()]+encoded+block[match.end()+n:]
        else:
            block=block.rstrip()[:-1].rstrip()+',\n      '+json.dumps(field)+': '+encoded+'\n    }'
    raw=raw[:start]+block+raw[end:]
path.write_text(raw,encoding='utf-8')
