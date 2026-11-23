"""Read-only train/valid format audit. Never opens the frozen test split."""
import collections,gzip,hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
report={'scope':'train/valid only; no model selection or independent-test inference','synthetic':True,'scriptSha256':sha(pathlib.Path(__file__).read_bytes()),'splits':[]}
for split in ['train','valid']:
    path=ROOT/'data/v2'/(split+'.jsonl.gz');before=sha(path.read_bytes())
    counts=collections.Counter();hist=collections.Counter();examples={}
    for line in gzip.open(path,'rt'):
        row=json.loads(line);inp=json.loads(row['messages'][1]['content']);label=json.loads(row['messages'][2]['content'])
        counts['samples']+=1;counts['task_'+inp['task']]+=1
        if inp['task']!='extract':continue
        cs=label['clauses'];hint=inp.get('defaultIdentity',{});counts['extract']+=1;hist[len(cs)]+=1
        flags={
          'full_identity_hint':all(k in hint for k in ['course','classId','activityId','lessonDate']),
          'pending_label':bool(label.get('pending')),
          'multi_clause':len(cs)>1,
          'mixed_publication_dates':len({c['published'] for c in cs})>1,
          'clause_publication_differs_envelope':any(c['published']!=inp['published'] for c in cs),
          'clause_import_differs_envelope':any(c['imported']!=inp['published'] for c in cs),
          'multiple_activity_identities':len({json.dumps(c['identity'],sort_keys=True,ensure_ascii=False) for c in cs})>1,
          'hint_course_literal_absent':bool(hint.get('course')) and hint['course'] not in inp['text'],
          'hint_class_literal_absent':bool(hint.get('classId')) and hint['classId'] not in inp['text'],
          'label_not_source_exact':any(c['quote'] not in inp['text'] or c['value'] not in c['quote'] for c in cs)
        }
        for name,active in flags.items():
            if active:counts[name]+=1;examples.setdefault(name,[])
            if active and len(examples[name])<3:examples[name].append(row['audit']['id'])
    assert before==sha(path.read_bytes()),'Input changed during audit'
    report['splits'].append({'split':split,'inputSha256':before,'counts':dict(counts),'clauseCountHistogram':dict(sorted(hist.items())),'exampleIds':examples})
report['interpretation']=[
 'Full oracle world identity is supplied to training extraction. Live intake supplies only source-proven hints. Training-format diagnostics cannot establish free-notice accuracy.',
 'Some extraction samples concatenate notices with distinct publication/import dates. Live teacher submission has one envelope publication/import date. These conditions must be reported separately, not silently treated as identical.',
 'Literal-absence counters are lexical diagnostics, not proof of semantic mistakes. Source metadata dates may be explicit inside quotes.',
 'This audit does not approve the 500 human semantic reviews and does not change labels, checkpoints or frozen test data.'
]
(ROOT/'INPUT-FORMAT-AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for r in report['splits']:print(r['split'],json.dumps(r['counts'],ensure_ascii=False))
