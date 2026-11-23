import {readFile,stat,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {homedir} from 'node:os';
const cache=new Map(),sha=x=>createHash('sha256').update(x).digest('hex');
export async function fileIdentity(path){
  const s=await stat(path),key=path+'|'+s.size+'|'+s.mtimeMs;
  if(cache.has(key))return cache.get(key);
  const h=createHash('sha256');for await(const b of createReadStream(path))h.update(b);
  const result={sha256:h.digest('hex'),bytes:s.size};cache.set(key,result);return result;
}
export async function modelIdentity(){
  if(process.env.NOWPAST_BACKEND==='mlx'){
    const base=process.env.NOWPAST_TRAIN_BASE || new URL('../training/cache/qwen-base/',import.meta.url).pathname;
    const variant=process.env.NOWPAST_MODEL_VARIANT || 'base';
    if(!['base','finetuned'].includes(variant))throw Error('未知模型版本');
    const adapter=process.env.NOWPAST_ADAPTER;
    const python=process.env.NOWPAST_MLX_PYTHON || new URL('../training/.venv/bin/python',import.meta.url).pathname;
    if(variant==='finetuned'&&!adapter)throw Error('finetuned 必须明确指定 adapter，不会回退冒充已训练模型。');
    return {baseRevision:'7ae557604adf67be50417f59c2c2f167def9a775',base:await fileIdentity(join(base,'model.safetensors')),
      adapter:variant==='finetuned'?await fileIdentity(join(adapter,'adapters.safetensors')):null,
      tokenizer:await fileIdentity(join(base,'tokenizer.json')),chatTemplate:await fileIdentity(join(base,'tokenizer_config.json')),
      runtime:{backend:'mlx',python:await fileIdentity(python),decoding:process.env.NOWPAST_MLX_DECODING==='free'?'free':'outlines-json-schema',repetitionPenalty:Number(process.env.NOWPAST_MLX_REPETITION_PENALTY || '1'),repetitionContext:Number(process.env.NOWPAST_MLX_REPETITION_CONTEXT || '256'),dependencies:await fileIdentity(new URL('../training/requirements.txt',import.meta.url)),worker:await fileIdentity(new URL('../training/worker.py',import.meta.url)),prompting:await fileIdentity(new URL('../training/prompting.py',import.meta.url))},quantization:null,variant};
  }
  const home=process.env.NOWPAST_MODEL_HOME || (process.platform==='darwin'?join(homedir(),'Library','Caches','NowPast','models'):join(process.env.LOCALAPPDATA || '.','NowPast','models'));
  const runtime=join(home,'b12559'),name=process.platform==='win32'?'llama-server.exe':'llama-server';
  const executable=(await readdir(runtime,{recursive:true})).find(path=>path.split(/[\\/]/).at(-1)===name);
  if(!executable)throw Error('本地模型未准备');
  return {baseRevision:'9217f5db79a29953eb74d5343926648285ec7e67',base:await fileIdentity(join(home,'model.gguf')),adapter:null,
    tokenizer:'embedded in hashed GGUF',chatTemplate:'embedded in hashed GGUF',runtime:{version:'llama.cpp b12559',binary:await fileIdentity(join(runtime,executable))},quantization:'Q4_K_M',variant:'base'};
}
export function inferenceKey(identity,{system,input,schema,parameters}){return sha(JSON.stringify({version:2,identity,system,input,schema,parameters}));}
