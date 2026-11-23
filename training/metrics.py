"""Task metrics for actual raw validation predictions; never repairs output."""
import json,pathlib,statistics
root=pathlib.Path(__file__).resolve().parent;out=root/'runs/smoke-1k'
def sets(a,b):
    a=set(a);b=set(b);h=len(a&b);return {'exact':float(a==b),'precision':h/len(a) if a else float(not b),'recall':h/len(b) if b else 1.,'f1':2*h/(len(a)+len(b)) if a or b else 1.}
def evaluate(r):
    y=r['expected'];p=r.get('parsed');task=r['task'];base={'id':r['id'],'task':task,'jsonValid':r['jsonValid'],'rawExact':r['exact'],'ms':r['ms'],'error':r['error']}
    def failed():
        extra={'documentComplete':0.,'clauseF1':0.} if task=='extract' else {'relationPrecision':0.,'relationRecall':0.,'kindExact':0.} if task=='relation' else {'fieldExact':0.,'fieldF1':0.,'statusExact':0.,'citationExact':0.,'oldLinkExact':0.,'conflictRetention':0. if any(a['status']=='conflict' for a in y['answers'].values()) else None,'missingAbstention':0. if any(a['status']=='unknown' for a in y['answers'].values()) else None}
        return {**base,**extra,'taskExact':0.,'runtimeFailure':True}
    if not isinstance(p,dict):return failed()
    try:
        if task=='extract':
            def key(c):return tuple(str(c.get(k,'')) for k in ['field','value','quote','identity','effective','published','imported','operation'])
            # Normalize only identity dictionary order, never source/value/date.
            def canonical(c):return json.dumps({k:c.get(k) for k in ['field','value','quote','identity','effective','published','imported','operation']},ensure_ascii=False,sort_keys=True)
            score=sets(map(canonical,p.get('clauses',[])),map(canonical,y.get('clauses',[])))
            return {**base,'runtimeFailure':False,'taskExact':score['exact']*float(p.get('pending')==y.get('pending')),'clauseF1':score['f1'],'documentComplete':score['exact']}
        if task=='relation':
            score=sets(p.get('relatedIds',[]),y.get('relatedIds',[]));return {**base,'runtimeFailure':False,'taskExact':float(score['exact'] and p.get('kind')==y.get('kind') and p.get('authorization')==y.get('authorization')),'relationPrecision':score['precision'],'relationRecall':score['recall'],'kindExact':float(p.get('kind')==y.get('kind'))}
        fields=list(y['answers']);values=[];states=[];citations=[];conflicts=[];missing=[]
        for f in fields:
            a=p.get('answers',{}).get(f,{});b=y['answers'][f];s=sets(a.get('values',[]),b['values']);values.append(s);states.append(float(a.get('status')==b['status']))
            ck=lambda c:json.dumps(c,sort_keys=True,ensure_ascii=False);citations.append(sets(map(ck,a.get('citations',[])),map(ck,b['citations'])))
            if b['status']=='conflict':conflicts.append(s['exact'])
            if b['status']=='unknown':missing.append(float(a.get('status')=='unknown' and not a.get('values') and not a.get('citations')))
        m=lambda a:sum(a)/len(a) if a else None
        old=sets(p.get('previous',[]),y.get('previous',[]));return {**base,'runtimeFailure':False,'taskExact':float(all(s['exact'] for s in values) and all(states) and all(s['exact'] for s in citations) and old['exact']),
          'fieldExact':m([s['exact'] for s in values]),'fieldF1':m([s['f1'] for s in values]),'statusExact':m(states),'citationExact':m([s['exact'] for s in citations]),'oldLinkExact':old['exact'],'conflictRetention':m(conflicts),'missingAbstention':m(missing)}
    except (KeyError,TypeError,AttributeError):return {**failed(),'error':'schema structure invalid'}
report={};allrows={}
for filename in ['base-validation.json','adapter-validation.json','reloaded.json']:
    if not (out/filename).exists():continue
    rows=[evaluate(r) for r in json.loads((out/filename).read_text())];allrows[filename]=rows
    groups={}
    for task in ['all','extract','relation','qa','negative']:
        a=[r for r in rows if task=='all' or r['task']==task];keys={k for r in a for k,v in r.items() if isinstance(v,(float,int,bool)) and k!='ms'}
        groups[task]={'n':len(a),**{k:{'n':len([r for r in a if r.get(k) is not None]),'value':statistics.mean(float(r[k]) for r in a if r.get(k) is not None)} for k in keys},'latencyMs':{'p50':statistics.median(r['ms'] for r in a) if a else None,'p95':sorted(r['ms'] for r in a)[int(.95*(len(a)-1))] if a else None}}
    report[filename]=groups
(out/'task-metrics.json').write_text(json.dumps({'split':'32 validation diagnostics, NOT independent test','metrics':report,'rawRows':allrows},ensure_ascii=False,indent=2));print(json.dumps({k:v['all'] for k,v in report.items()}))
