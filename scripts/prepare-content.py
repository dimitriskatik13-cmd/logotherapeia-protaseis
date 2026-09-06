"""Import approved staged content/art. Run in the upgrade workspace, not at runtime."""
from pathlib import Path
import json, shutil, hashlib
from fontTools import subset
from fontTools.ttLib import TTFont

APP=Path(__file__).resolve().parent.parent
STAGE=APP.parent
ART=STAGE/'03-eikonografisi'
read=lambda p: json.loads(p.read_text())
source=read(STAGE/'01-periechomeno/baseline-data.json')
scene=read(ART/'scene-coverage.json')
reasons=read(ART/'reason-coverage.json')['reasons']
web=read(ART/'web-manifest.json')['files']
actions={tuple(x['key']):x['destination'] for x in scene['actions']}
reason_by_id={sid:x['destination'] for x in reasons for sid in x['sentence_ids']}
selected=read(ART/'production-manifest.json')['assets']
places={}
for x in selected:
    if x['status']!='superseded' and x['destination'].startswith('masters/place-'):
        key=Path(x['destination']).stem[6:].split('-v')[0];places[key]=x['destination']
def image(path):
    assert path in web,path
    return 'assets/pictures/'+Path(web[path]).name

forms=source['verbForms']
forms['brushTeeth']={'past':'βούρτσισε','future':'θα βουρτσίσει'}
reason_forms=source['reasonForms']
for key,past in {'wantsNews':'γιατί ήθελε να μάθει τα νέα','wantsCleanTeeth':'γιατί ήθελε να έχει καθαρά δόντια','wantsPlay':'γιατί ήθελε να παίξει','goOutside':'για να βγει έξω'}.items():
    reason_forms[key]={'past':past,'future':scene['labels']['reasons'][key]}
full=[]
for raw in scene['mode5']:
    row=dict(raw);s,v,o,p=(row[k] for k in ('subject','verb','object','place'))
    obj=scene['object_context_overrides'].get(s+':'+o,scene['object_files'].get(o))
    row['images']={'subject':image(scene['subject_files'][s]),'verb':image(actions[s,v,o]),'object':image(obj),'place':image(places[p]),'reason':image(reason_by_id[row['id']])}
    full.append(row)
mode2=[]
for row in scene['mode2_mapping']:
    s,v,o=row['key'];mode2.append({'id':row['sentence'],'subject':s,'verb':v,'images':{'subject':image(scene['subject_files'][s]),'verb':image(actions[s,v,o])}})
data={'version':1,'labels':scene['labels'],'verbForms':forms,'reasonForms':reason_forms,'mode5':full,'mode2':mode2,
      'times':[dict(x,image=image('masters/time-'+x['id']+'-v1.png')) for x in source['times']]}
(APP/'data').mkdir(exist_ok=True)
(APP/'data/content.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
(APP/'assets/pictures').mkdir(parents=True,exist_ok=True)
for master,path in web.items():shutil.copy2(ART/path,APP/image(master))
# Subset local OFL fonts to Greek, Latin and punctuation. No network font requests.
(APP/'assets/fonts').mkdir(exist_ok=True)
for name in ['Inter','Comfortaa']:
    font=TTFont(STAGE/'04-othoni/fonts'/f'{name}-Variable.ttf')
    options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*']
    sub=subset.Subsetter(options=options);sub.populate(unicodes=list(range(0x20,0x250))+list(range(0x370,0x400))+list(range(0x1f00,0x2000))+list(range(0x2000,0x2070))+[0x20ac]);sub.subset(font)
    font.flavor='woff2';font.save(APP/'assets/fonts'/f'{name}.woff2')
    shutil.copy2(STAGE/'04-othoni/fonts'/f'{name}-OFL.txt',APP/'assets/fonts'/f'{name}-OFL.txt')
print('Approved content:',len(full),'full sentences;',len(mode2),'two-part sentences; images:',len(web))
