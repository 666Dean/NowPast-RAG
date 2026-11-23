"""Fail closed: formal training is not allowed on unaudited synthetic labels."""
import argparse,csv,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--decisions',type=pathlib.Path,required=True);args=p.parse_args()
expected={json.loads(l)['audit']['id'] for l in (root/'review/train-500.jsonl').read_text().splitlines()}
rows=list(csv.DictReader(args.decisions.open()));byid={r['id']:r for r in rows}
errors=[]
if len(rows)!=len(byid):errors.append('duplicate review IDs')
for id in expected:
    r=byid.get(id,{})
    if r.get('decision')!='pass' or not r.get('reviewer','').strip():errors.append('pending/failing/unattributed review '+id)
if errors:
    print(json.dumps({'formalTrainingAllowed':False,'nErrors':len(errors),'examples':errors[:10]}));sys.exit(2)
m=json.load(open(root/'DATA-MANIFEST.json'));t=json.load(open(root/'TOKEN-AUDIT.json'))
if any(s['exactPromptDuplicates'] for s in m['splits']):errors.append('exact duplicate inputs')
if any(x['worldOverlap'] or x['exactPromptOverlap'] for x in t['leaks']):errors.append('leakage')
if not (root/'NEAR-DUPLICATE-AUDIT.json').exists():errors.append('near duplicate audit missing')
print(json.dumps({'formalTrainingAllowed':not errors,'errors':errors,'humanReviews':len(expected),'note':'Passing this gate alone does not launch training or prove data semantics; reviewer provenance must be genuine.'}));sys.exit(2 if errors else 0)
