"""Actual frozen BGE ONNX dense retrieval and independent BM25 ranking."""
import argparse, collections, gzip, hashlib, json, math, pathlib, re, time, os
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT=pathlib.Path(__file__).resolve().parent / os.environ.get('NOWPAST_EXPERIMENT_DIR','.')
CONFIG=json.loads((ROOT/'config.json').read_text())
parser=argparse.ArgumentParser();parser.add_argument('--seed',type=int);parser.add_argument('--scale',action='store_true');args=parser.parse_args()
seeds=[args.seed] if args.seed is not None else CONFIG['seeds']
cache=ROOT/'cache';out=ROOT/'results';out.mkdir(exist_ok=True)
opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
session=ort.InferenceSession(str(cache/'bge/onnx/model_quantized.onnx'),sess_options=opts,providers=['CPUExecutionProvider'])
tokenizer=Tokenizer.from_file(str(cache/'bge/tokenizer.json'))
tokenizer.enable_truncation(max_length=CONFIG['embeddingMaxLength']);tokenizer.enable_padding()

def embed(texts,label):
    vectors=[];tokens=0;t=time.perf_counter()
    for start in range(0,len(texts),32):
        enc=tokenizer.encode_batch(texts[start:start+32])
        feeds={'input_ids':np.array([x.ids for x in enc],dtype=np.int64),'attention_mask':np.array([x.attention_mask for x in enc],dtype=np.int64),'token_type_ids':np.array([x.type_ids for x in enc],dtype=np.int64)}
        feeds={x.name:feeds[x.name] for x in session.get_inputs()}
        result=session.run(None,feeds)[0]
        cls=result[:,0,:] if result.ndim==3 else result
        cls=cls/np.maximum(np.linalg.norm(cls,axis=1,keepdims=True),1e-12)
        vectors.append(cls.astype(np.float32));tokens+=int(feeds['attention_mask'].sum())
        if start%1024==0: print(f'{label}: {start}/{len(texts)}',flush=True)
    return np.concatenate(vectors),dict(seconds=time.perf_counter()-t,tokens=tokens,count=len(texts))

def tokens(s):
    s=s.lower();return re.findall(r'[a-z0-9]+|[\u4e00-\u9fff]{1,2}',s)+[s[i:i+2] for i in range(len(s)-1) if re.fullmatch('[\u4e00-\u9fff]{2}',s[i:i+2])]

def metadata_mask(docs,q):
    return np.array([d['scope'] in [q['classId'],'全班','全校'] and d['campus']['course']==q['course'] and
      (d['campus'].get('activityId')==q.get('activityId') if q.get('activityId') else d['campus'].get('lessonDate')==q.get('lessonDate')) and
      d['campus']['field'] in q['fields'] for d in docs])

def filtered(scores,docs,q):
    vals=scores.copy();vals[~metadata_mask(docs,q)]=-np.inf
    return [int(i) for i in np.argsort(-vals,kind='stable')[:CONFIG['topK']] if np.isfinite(vals[i])]

for seed in seeds:
    path=ROOT/f'data/seed-{seed}.json.gz';data=json.loads(gzip.decompress(path.read_bytes()));docs=data['docs'];qs=data['questions']
    metadata=lambda d:' '.join(str(d.get(k,'')) for k in ['title','scope','published','effective','imported'])+' '+json.dumps(d['campus'],ensure_ascii=False)
    # Every corpus chunk is a whole short notice. Identical text/metadata for both rankers.
    texts=[metadata(d)+' '+d['text'] for d in docs]
    unique=list(dict.fromkeys(q['question'] for q in qs));lookup={q:i for i,q in enumerate(unique)}
    print('seed',seed,'notices',len(docs),'unique queries',len(unique),flush=True)
    embedding_identity=hashlib.sha256(json.dumps([texts,unique,CONFIG['embeddingRevision'],CONFIG['embeddingMaxLength']],ensure_ascii=False).encode()).hexdigest()
    embfile=cache/f'embeddings-{seed}-{embedding_identity[:12]}.npz'
    if args.scale and not embfile.exists():
        raise RuntimeError('Run full retrieval to completion before --scale; do not build the same cache concurrently.')
    if embfile.exists():
        saved=np.load(embfile);dv=saved['docs'];qv=saved['questions'];embinfo=json.loads(str(saved['info']))
    else:
        dv,di=embed(texts,f's{seed} docs');qv,qi=embed([CONFIG['queryInstruction']+q for q in unique],f's{seed} queries')
        embinfo={'index':di,'queries':qi,'model':json.loads((cache/'embedding-model.json').read_text())}
        np.savez_compressed(embfile,docs=dv,questions=qv,info=json.dumps(embinfo))
    start=time.perf_counter();counts=[collections.Counter(tokens(s)) for s in texts];lens=np.array([sum(c.values()) for c in counts]);avg=lens.mean();n=len(docs)
    postings=collections.defaultdict(list)
    for i,c in enumerate(counts):
        for term,f in c.items():postings[term].append((i,f))
    bmindex=time.perf_counter()-start
    if args.scale:
        scale=[]
        target=f's{seed}-w10';fixed=[q for q in qs if q['world']==target]
        order=[target]+[w['id'] for w in data['worlds'] if w['id']!=target]
        for size in sorted(set([min(12,len(order)),min(30,len(order)),len(order)])):
            worlds=set(order[:size])
            pool=np.array([d.get('world',re.sub(r'-n\d+$','',d['id'])) in worlds for d in docs]);pn=int(pool.sum());pavg=lens[pool].mean()
            for q in fixed:
                visible=pool & np.array([d['published']<=q['asOf'] and d['imported']<=q['asOf'] for d in docs])
                t=time.perf_counter();dense=dv@qv[lookup[q['question']]];dense[~visible]=-np.inf
                vi=[int(i) for i in np.argsort(-dense,kind='stable')[:CONFIG['topK']] if np.isfinite(dense[i])];vt=(time.perf_counter()-t)*1000
                t=time.perf_counter();scores=np.zeros(n,dtype=np.float32)
                for term in set(tokens(q['question'])):
                    p=[x for x in postings.get(term,[]) if pool[x[0]]]
                    if not p:continue
                    idf=math.log(1+(pn-len(p)+.5)/(len(p)+.5));ii=np.array([x[0] for x in p]);ff=np.array([x[1] for x in p])
                    scores[ii]+=idf*(ff*2.2)/(ff+1.2*(.25+.75*lens[ii]/pavg))
                scores[~visible]=-np.inf;bi=[int(i) for i in np.argsort(-scores,kind='stable')[:CONFIG['topK']] if np.isfinite(scores[i])];bt=(time.perf_counter()-t)*1000
                scale.append({'id':q['id'],'worldCount':size,'notices':pn,'Vector':vi,'BM25':bi,'Vector-filtered':filtered(dense,docs,q),'BM25-filtered':filtered(scores,docs,q),'ms':{'Vector':vt,'BM25':bt,'Vector-filtered':vt,'BM25-filtered':bt}})
        (out/f'scale-ranks-{seed}.json.gz').write_bytes(gzip.compress(json.dumps(scale).encode(),mtime=0))
        print('scale done',seed,len(scale),flush=True)
        continue
    pub=np.array([d['published'] for d in docs]);imp=np.array([d['imported'] for d in docs]);rows=[];vector_seconds=0;bm_seconds=0;k=CONFIG['topK']
    for pos,q in enumerate(qs):
        visible=(pub<=q['asOf']) & (imp<=q['asOf'])
        t=time.perf_counter();dense=dv@qv[lookup[q['question']]];dense[~visible]=-np.inf
        ids=np.argsort(-dense,kind='stable')[:k];vi=[int(i) for i in ids if np.isfinite(dense[i])];vt=time.perf_counter()-t;vector_seconds+=vt
        t=time.perf_counter();scores=np.zeros(n,dtype=np.float32)
        for term in set(tokens(q['question'])):
            p=postings.get(term,[])
            if not p:continue
            df=len(p);idf=math.log(1+(n-df+.5)/(df+.5));ii=np.array([x[0] for x in p]);ff=np.array([x[1] for x in p])
            scores[ii]+=idf*(ff*2.2)/(ff+1.2*(.25+.75*lens[ii]/avg))
        scores[~visible]=-np.inf;bi=[int(i) for i in np.argsort(-scores,kind='stable')[:k] if np.isfinite(scores[i])];bt=time.perf_counter()-t;bm_seconds+=bt
        rows.append({'id':q['id'],'Vector':vi,'BM25':bi,'Vector-filtered':filtered(dense,docs,q),'BM25-filtered':filtered(scores,docs,q),'ms':{'Vector':vt*1000,'BM25':bt*1000,'Vector-filtered':vt*1000,'BM25-filtered':bt*1000}})
    payload={'seed':seed,'datasetSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'embedding':embinfo,'bm25IndexSeconds':bmindex,'indexBytes':int(dv.nbytes),'retrievalSeconds':{'Vector':vector_seconds,'BM25':bm_seconds},'rows':rows}
    (out/f'ranks-{seed}.json.gz').write_bytes(gzip.compress(json.dumps(payload,ensure_ascii=False).encode(),mtime=0))
    print('done',seed,'vector seconds',round(vector_seconds,2),'BM25 seconds',round(bm_seconds,2),flush=True)
