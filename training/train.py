"""Real MLX LoRA smoke run, masked loss, before/after inference and reload."""
import argparse,hashlib,json,pathlib,time,platform,subprocess,os
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
import mlx.core as mx
import mlx.optimizers as optim
import numpy as np
from mlx_lm import load,generate
from mlx_lm.sample_utils import make_sampler
from mlx_lm.tuner.utils import linear_to_lora_layers,load_adapters
from mlx_lm.tuner.trainer import train,TrainingArgs
from mlx_lm.tuner.callbacks import TrainingCallback
from mlx.utils import tree_flatten
from loss import masked_loss
ROOT=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--iters',type=int);parser.add_argument('--reload-only',action='store_true');parser.add_argument('--reuse-base',type=pathlib.Path);args=parser.parse_args()
cfg=json.loads((ROOT/'smoke-config.json').read_text());out=ROOT/'runs/smoke-1k';out.mkdir(parents=True,exist_ok=True)
hash=lambda b:hashlib.sha256(b).hexdigest()
snapshot={name:((out/('input-'+name)) if args.reload_only else (ROOT/f'data/smoke/{name}')).read_bytes() for name in ['train.jsonl','valid.jsonl','validation-audit.json','ids.json']}
if not args.reload_only:
    for name,content in snapshot.items():(out/('input-'+name)).write_bytes(content)
def write(name,value):(out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def event(kind,data):
    with (out/'events.jsonl').open('a') as f:f.write(json.dumps({'kind':kind,**data})+'\n')
class Callback(TrainingCallback):
    def on_train_loss_report(self,info):event('train',info)
    def on_val_loss_report(self,info):event('valid',info)
def infer(model,tok,name):
    records=[]
    rows=json.loads(snapshot['validation-audit.json'])
    for row in rows:
        prompt=tok.apply_chat_template(row['messages'][:-1],tokenize=False,add_generation_prompt=True);start=time.perf_counter()
        text=generate(model,tok,prompt=prompt,max_tokens=cfg['generationMaxTokens'],sampler=make_sampler(temp=0),verbose=False)
        try:value=json.loads(text);error=None
        except Exception:value=None;error='not complete JSON (includes truncation if token limit reached)'
        target=json.loads(row['messages'][-1]['content']);records.append({'id':row['audit']['id'],'task':row['audit']['task'],'input':row['messages'][:-1],'expected':target,'raw':text,'parsed':value,'jsonValid':value is not None,'exact':value==target,'error':error,'ms':(time.perf_counter()-start)*1000,'generatedTokens':len(tok.encode(text))})
        write(name,records)
    return records
start=time.perf_counter();mx.random.seed(cfg['seed']);np.random.seed(cfg['seed'])
model,tok=load(str(ROOT/'cache/qwen-base'))
if args.reload_only:
    load_adapters(model,str(out));result=infer(model,tok,'reloaded.json');write('reload-manifest.json',{'reloaded':True,'n':len(result),'adapterSha256':hash((out/'adapters.safetensors').read_bytes()),'seconds':time.perf_counter()-start});raise SystemExit
write('config.json',cfg)
if args.reuse_base:
    before=json.loads(args.reuse_base.read_text());expected=json.loads(snapshot['validation-audit.json']);assert [r['id'] for r in before]==[r['audit']['id'] for r in expected]
    assert all(r['input']==e['messages'][:-1] for r,e in zip(before,expected));write('base-validation.json',before);write('baseline-provenance.json',{'type':'reused ORIGINAL pre-update inference, not rerun','path':str(args.reuse_base),'sha256':hash(args.reuse_base.read_bytes())})
else:before=infer(model,tok,'base-validation.json')
model.freeze();linear_to_lora_layers(model,cfg['num_layers'],cfg['lora_parameters'])
trainable=dict(tree_flatten(model.trainable_parameters()));assert trainable
initial={k:mx.array(v) for k,v in trainable.items()};mx.eval(initial)
def data(name):
    rows=[json.loads(l) for l in snapshot[name+'.jsonl'].decode().splitlines()];result=[]
    for row in rows:
        tokens=tok.apply_chat_template(row['messages'],tokenize=True,return_dict=False);prefix=tok.apply_chat_template(row['messages'][:-1],tokenize=True,add_generation_prompt=True,return_dict=False)
        assert tokens[:len(prefix)]==prefix and len(tokens)<=cfg['max_seq_length']
        assert tok.eos_token_id in tokens[len(prefix):];result.append((tokens,len(prefix)))
    return result
train_data=data('train');valid_data=data('valid')
assert len(train_data)==1000
write('mask-check.json',{'samples':len(train_data),'promptMasked':True,'eosSupervised':True,'truncated':0,'targetTokensAvailable':sum(len(t)-o for t,o in train_data),'allTokensAvailable':sum(len(t) for t,o in train_data),'padInBackend':0,'paddingExcludedByLengthMask':True})
write('adapter_config.json',{'fine_tune_type':'lora','num_layers':cfg['num_layers'],'lora_parameters':cfg['lora_parameters']})
train_start=time.perf_counter();steps=args.iters or cfg['iters']
training=TrainingArgs(**{k:cfg[k] for k in ['batch_size','max_seq_length','grad_checkpoint','grad_accumulation_steps','steps_per_report','steps_per_eval','val_batches']},iters=steps,steps_per_save=cfg['steps_per_save'],adapter_file=str(out/'adapters.safetensors'))
train(model,optim.AdamW(learning_rate=cfg['learning_rate']),train_data,valid_data,training,loss=masked_loss,training_callback=Callback())
model.eval();mx.eval(model.parameters());changed=any(not bool(mx.array_equal(v,initial[k])) for k,v in dict(tree_flatten(model.trainable_parameters())).items())
assert changed,'No weight update'
write('training-manifest.json',{'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'configSha256':hash((ROOT/'smoke-config.json').read_bytes()),'baseRevision':cfg['revision'],'baseSha256':hash((ROOT/'cache/qwen-base/model.safetensors').read_bytes()),'adapterSha256':hash((out/'adapters.safetensors').read_bytes()),
    'actualSteps':steps,'actualSamplesSeen':steps*cfg['batch_size'],'uniqueSamplesClaim':1000 if steps==500 else 'not all dataset necessarily seen','dataHashes':{k:hash(v) for k,v in snapshot.items()},'weightChanged':changed,'seconds':time.perf_counter()-train_start,'peakMemoryBytes':mx.get_peak_memory(),'parameters':sum(v.size for v in trainable.values()),'trainingQuantization':None,'exportQuantization':None,'status':'tooling smoke, not formal 100k training'})
after=infer(model,tok,'adapter-validation.json');write('comparison.json',{'n':len(before),'baseExact':sum(r['exact'] for r in before)/len(before),'adapterExact':sum(r['exact'] for r in after)/len(after),'baseJSON':sum(r['jsonValid'] for r in before)/len(before),'adapterJSON':sum(r['jsonValid'] for r in after)/len(after),'notIndependentTest':True,'negativeResultsPreserved':True})
print('Saved real adapter and validation outputs; reload in fresh process with --reload-only',flush=True)
