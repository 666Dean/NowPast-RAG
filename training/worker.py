"""Offline stdio inference worker; never exposes a network listener."""
import os,sys,json,pathlib,time
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
ROOT=pathlib.Path(__file__).resolve().parent
os.environ['OUTLINES_CACHE_DIR']=str(ROOT/'cache/outlines')
variant=os.environ.get('NOWPAST_MODEL_VARIANT','base');base=os.environ.get('NOWPAST_TRAIN_BASE',str(ROOT/'cache/qwen-base'))
if variant not in ['base','finetuned']:raise RuntimeError('Unknown model variant')
adapter=os.environ.get('NOWPAST_ADAPTER') if variant=='finetuned' else None
if variant=='finetuned':
    if not adapter:raise RuntimeError('Explicit adapter path required')
    if (pathlib.Path(adapter)/'INVALID.json').exists():raise RuntimeError('This archived adapter was invalidated by data/loss audit and cannot be served')
    manifest=json.loads((pathlib.Path(adapter)/'training-manifest.json').read_text())
    if manifest.get('status','').startswith('tooling') and os.environ.get('NOWPAST_ALLOW_SMOKE')!='1':raise RuntimeError('Smoke adapter is not an approved formal model; opt in explicitly for development')
# Force denial of external socket connections even if an imported library tries.
import socket
connect=socket.socket.connect
def guarded(sock,address):
    if isinstance(address,tuple) and address[0] not in ['127.0.0.1','localhost','::1']:raise RuntimeError('External network disabled in local worker')
    return connect(sock,address)
socket.socket.connect=guarded
from mlx_lm import load,generate
from mlx_lm.sample_utils import make_sampler,make_logits_processors
import outlines
from outlines.types import JsonSchema
from outlines.inputs import Chat
from prompting import prepare_messages,decoder_schema
def diagnostic(req,phase):
    (ROOT/'runs').mkdir(parents=True,exist_ok=True)
    with (ROOT/'runs/worker-events.jsonl').open('a') as f:f.write(json.dumps({'id':req['id'],'phase':phase,'monotonic':time.perf_counter()})+'\n')
model,tok=load(base,adapter_path=adapter)
structured_model=outlines.from_mlxlm(model,tok)
class ProcessorChain:
    def __init__(self,grammar,processors):self.grammar,self.processors=grammar,processors
    def reset(self):self.grammar.reset()
    def __call__(self,tokens,logits):
        for processor in self.processors:logits=processor(tokens,logits)
        return self.grammar(tokens,logits)
for line in sys.stdin:
    text=None
    try:
        req=json.loads(line);messages,prompt=prepare_messages(tok,req['system'],req['input'],req['schema'])
        t=time.perf_counter()
        penalty=float(os.environ.get('NOWPAST_MLX_REPETITION_PENALTY','1'))
        processors=make_logits_processors(repetition_penalty=penalty,repetition_context_size=int(os.environ.get('NOWPAST_MLX_REPETITION_CONTEXT','256'))) if penalty!=1 else []
        if os.environ.get('NOWPAST_MLX_DECODING')=='free':
            text=generate(model,tok,prompt=prompt,max_tokens=req.get('maxTokens',1200),sampler=make_sampler(temp=0),logits_processors=processors,verbose=False)
        else:
            diagnostic(req,'compile-start')
            generator=outlines.Generator(structured_model,output_type=JsonSchema(decoder_schema(req['schema'])))
            if processors:generator.logits_processor=ProcessorChain(generator.logits_processor,processors)
            diagnostic(req,'compile-end')
            text=generator(Chat(messages),max_tokens=req.get('maxTokens',1200),sampler=make_sampler(temp=0))
            diagnostic(req,'generate-end')
        value=json.loads(text)
        with (ROOT/'runs/worker-output.jsonl').open('a') as f:f.write(json.dumps({'id':req['id'],'request':req,'raw':text,'data':value},ensure_ascii=False)+'\n')
        print(json.dumps({'id':req['id'],'model':'Qwen2.5-0.5B-Instruct · MLX · '+variant,'data':value,'raw':text,'usage':{'prompt_tokens':len(tok.encode(prompt)),'completion_tokens':len(tok.encode(text))},'ms':(time.perf_counter()-t)*1000},ensure_ascii=False),flush=True)
    except Exception as e:
        (ROOT/'runs').mkdir(parents=True,exist_ok=True)
        with (ROOT/'runs/worker-output.jsonl').open('a') as f:f.write(json.dumps({'id':req.get('id') if 'req' in locals() else None,'request':req if 'req' in locals() else None,'error':str(e),'raw':text},ensure_ascii=False)+'\n')
        print(json.dumps({'id':req.get('id') if 'req' in locals() else None,'error':str(e),'raw':text}),flush=True)
