"""Token, loss-mask and leakage audit; creates a fixed provisional 1k subset."""
import gzip,json,pathlib,hashlib,collections,re,random,statistics
import sys
from transformers import AutoTokenizer
ROOT=pathlib.Path(__file__).resolve().parent
tokenizer=AutoTokenizer.from_pretrained(ROOT/'cache/qwen-base',local_files_only=True)
hash=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((ROOT/'DATA-MANIFEST.json').read_text());stats=[];splits={};review=[];smoke=[]
input_hashes={split:hash((ROOT/f'data/v2/{split}.jsonl.gz').read_bytes()) for split in ['train','valid','test']}
for record in manifest['splits']:assert input_hashes[record['split']]==record['sha256'],'Input data differs from frozen manifest'
if '--smoke-only' in sys.argv:
    groups=collections.defaultdict(list);quotas={'extract':300,'relation':250,'qa':350,'negative':100};out=ROOT/'data/smoke';out.mkdir(exist_ok=True)
    for split in ['train','valid']:
        rows=[]
        with gzip.open(ROOT/f'data/v2/{split}.jsonl.gz','rt') as f:
            for line in f:
                row=json.loads(line);task=row['audit']['task'];tokens=tokenizer.apply_chat_template(row['messages'],tokenize=True,return_dict=False)
                if len(tokens)>1536:continue
                if split=='train':
                    if len(groups[task])<quotas[task]:groups[task].append(row)
                    if all(len(groups[k])==n for k,n in quotas.items()):break
                else:
                    if not any(x['audit']['task']==task and x['audit']['scene']==row['audit']['scene'] for x in rows):rows.append(row)
                    if len(rows)>=32:break
        if split=='train':rows=[r for a in groups.values() for r in a];random.Random(20261123).shuffle(rows)
        (out/f'{split}.jsonl').write_text('\n'.join(json.dumps({'messages':r['messages']},ensure_ascii=False) for r in rows)+'\n')
        if split=='valid':(out/'validation-audit.json').write_text(json.dumps(rows,ensure_ascii=False))
        else:(out/'ids.json').write_text(json.dumps([r['audit']['id'] for r in rows]))
        print(split,len(rows),flush=True)
    raise SystemExit
for split in ['train','valid','test']:
    counts=[];targets=[];overflow=0;template_counts=collections.Counter();prompt_hashes=set();near=collections.Counter();worlds=set();eligible=[];token_sum=0
    with gzip.open(ROOT/f'data/v2/{split}.jsonl.gz','rt') as f:
        for line in f:
            row=json.loads(line);messages=row['messages'];full=tokenizer.apply_chat_template(messages,tokenize=True,return_dict=False)
            prefix=tokenizer.apply_chat_template(messages[:-1],tokenize=True,add_generation_prompt=True,return_dict=False)
            assert full[:len(prefix)]==prefix,'Loss mask prefix mismatch'
            assert len(full)>len(prefix);assert tokenizer.eos_token_id in full[len(prefix):]
            counts.append(len(full));targets.append(len(full)-len(prefix));token_sum+=len(full)
            overflow+=len(full)>4096;worlds.add(row['audit']['world']);prompt_hashes.add(hash(messages[1]['content'].encode()))
            # Entity replacement, not just numeric replacement.
            obj=json.loads(messages[1]['content']);text=messages[1]['content']
            for entity in set(re.findall(r'《([^》]+)》|((?:数媒|计科|软件|信管)\d+班)',text)):
                for value in entity:
                    if value:text=text.replace(value,'<ENTITY>')
            norm=re.sub(r'\d+|[A-Z]\d{3}','#',text);near[hash(norm.encode())]+=1
            if split=='train' and len(full)<=1536:eligible.append(row['audit']['id'])
    splits[split]={'worlds':worlds,'prompts':prompt_hashes,'normalized':set(near)}
    stats.append({'split':split,'n':len(counts),'tokens':token_sum,'targetTokens':sum(targets),'length':{'p50':statistics.median(counts),'p95':sorted(counts)[int(.95*(len(counts)-1))],'max':max(counts)},'wouldTruncateAt4096':overflow,'truncated':0,'normalizedTemplateDuplicates':sum(v-1 for v in near.values()),'nearDuplicateMethod':'entity/date/number normalized exact collisions; fuzzy MinHash pending, not claimed completed'})
    if split=='train':
        # Pick a fixed stratified subset after length audit, never truncate outputs.
        allowed=set(eligible);buckets=collections.defaultdict(list)
        with gzip.open(ROOT/'data/v2/train.jsonl.gz','rt') as f:
            for line in f:
                row=json.loads(line)
                if row['audit']['id'] in allowed:buckets[row['audit']['task']].append(row)
        rng=random.Random(20261123)
        for b in buckets.values():rng.shuffle(b)
        for task,n in [('extract',300),('relation',250),('qa',350),('negative',100)]:smoke.extend(buckets[task][:n])
        rng.shuffle(smoke)
        out=ROOT/'data/smoke';out.mkdir(exist_ok=True)
        (out/'train.jsonl').write_text('\n'.join(json.dumps({'messages':r['messages']},ensure_ascii=False) for r in smoke)+'\n')
        (out/'ids.json').write_text(json.dumps([r['audit']['id'] for r in smoke]))
    if split=='valid':
        # Validation rows only; no independent test inference here.
        seen=set();selected=[]
        with gzip.open(ROOT/'data/v2/valid.jsonl.gz','rt') as f:
            for line in f:
                row=json.loads(line);pair=(row['audit']['task'],row['audit']['scene'])
                if pair not in seen and len(tokenizer.apply_chat_template(row['messages'],tokenize=True,return_dict=False))<=1536:seen.add(pair);selected.append(row)
                if len(selected)>=32:break
        (ROOT/'data/smoke/valid.jsonl').write_text('\n'.join(json.dumps({'messages':r['messages']},ensure_ascii=False) for r in selected)+'\n')
        (ROOT/'data/smoke/validation-audit.json').write_text(json.dumps(selected,ensure_ascii=False))
leaks=[{'a':a,'b':b,'worldOverlap':len(splits[a]['worlds']&splits[b]['worlds']),'exactPromptOverlap':len(splits[a]['prompts']&splits[b]['prompts']),'entityNormalizedOverlap':len(splits[a]['normalized']&splits[b]['normalized'])} for a in splits for b in splits if a<b]
assert len(smoke)==1000
assert all(hash((ROOT/f'data/v2/{split}.jsonl.gz').read_bytes())==digest for split,digest in input_hashes.items()),'Data changed during audit'
report={'datasetHashes':input_hashes,'tokenizerSha256':hash((ROOT/'cache/qwen-base/tokenizer.json').read_bytes()),'chatTemplateSha256':hash(tokenizer.chat_template.encode()),'eos':tokenizer.eos_token_id,'pad':tokenizer.pad_token_id,'loss':'prompt masked; target including EOS only','stats':stats,'leaks':leaks,'smoke':{'n':len(smoke),'context':1536,'status':'provisional tooling subset; 500 human checks NOT completed'}}
(ROOT/'TOKEN-AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
