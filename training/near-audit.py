"""Entity-normalized MinHash LSH audit, separate from exact hash leakage checks."""
import json,gzip,pathlib,re,hashlib,collections,random
root=pathlib.Path(__file__).resolve().parent
def norm(text):
    text=re.sub(r'《[^》]+》','《课程》',text)
    text=re.sub(r'"(?:course|classId|activityId)":"[^"]*"',lambda m:m[0].split(':')[0]+':"<ENTITY>"',text)
    text=re.sub(r'(?:数媒|计科|软件|信管)\d+班','<CLASS>',text)
    return re.sub(r'\d+|[A-Z]\d{3}','#',text)
unique={};counts=collections.Counter();totals=collections.Counter()
for split in ['train','valid','test']:
    with gzip.open(root/f'data/v2/{split}.jsonl.gz','rt') as f:
        for line in f:
            r=json.loads(line);s=norm(r['messages'][1]['content']);key=hashlib.sha256(s.encode()).hexdigest();counts[(split,key)]+=1;totals[split]+=1
            if (split,key) not in unique:unique[(split,key)]=(r['audit']['id'],s)
salts=[random.Random(i+923).randrange(1,2**32) for i in range(24)];buckets=collections.defaultdict(list);sets={};pairs=set();results=[]
for key,(id,text) in unique.items():
    shingles={int.from_bytes(hashlib.blake2s(text[i:i+5].encode(),digest_size=4).digest(),'little') for i in range(max(1,len(text)-4))};sets[key]=shingles
    signature=tuple(min(((v^salt)*2654435761)&0xffffffff for v in shingles) for salt in salts)
    for band in range(12):
        bucket=(band,signature[band*2:band*2+2])
        for other in buckets[bucket]:
            pair=tuple(sorted([key,other]));
            if pair in pairs:continue
            pairs.add(pair);a=sets[other];j=len(a&shingles)/len(a|shingles)
            if j>=.85:results.append({'a':unique[other][0],'b':id,'splits':[other[0],key[0]],'normalizedJaccard':j,'weightA':counts[other],'weightB':counts[key]})
        buckets[bucket].append(key)
report={'method':'entity-normalized character-5gram MinHash (24 hashes, 12 bands) candidate generation; exact Jaccard >= .85 within candidates','caveat':'approximate candidate search may miss pairs; normalized template similarities are not independent event counts',
  'totalSamples':dict(totals),'uniqueNormalizedPrompts':{s:sum(k[0]==s for k in unique) for s in totals},'normalizedExactDuplicates':{s:totals[s]-sum(k[0]==s for k in unique) for s in totals},
  'candidatePairs':len(pairs),'highSimilarityPairs':len(results),'crossSplitHighSimilarityPairs':sum(r['splits'][0]!=r['splits'][1] for r in results),'examples':results[:200]}
(root/'NEAR-DUPLICATE-AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='examples'}))
