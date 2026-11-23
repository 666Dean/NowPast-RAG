import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import {randomUUID} from 'node:crypto';
let proc;const waiting=new Map();
export function validateShape(value,schema){
  if(schema.oneOf){let valid=0;for(const branch of schema.oneOf){try{validateShape(value,branch);valid++;}catch{}}if(valid!==1)throw Error('模型未返回完整结果或明确待确认结构。');}
  if(Array.isArray(schema.type)){
    const actual=value===null?'null':Array.isArray(value)?'array':typeof value;
    if(!schema.type.includes(actual))throw Error('模型联合类型无效。');
    return validateShape(value,{...schema,type:actual});
  }
  if(schema.type==='null'&&value!==null)throw Error('模型空值结构无效。');
  if(schema.enum&&!schema.enum.includes(value))throw Error('模型输出不属于允许候选。');
  if(schema.type==='object'){
    if(!value||Array.isArray(value)||typeof value!=='object')throw Error('模型对象结构无效。');
    for(const k of schema.required || [])if(!(k in value))throw Error('模型输出缺少要求：'+k);
    for(const [k,v] of Object.entries(value)){
      if(!schema.properties?.[k]){if(schema.additionalProperties===false)throw Error('模型输出多余字段：'+k);}
      else validateShape(v,schema.properties[k]);
    }
  }
  if(schema.type==='array'){
    if(!Array.isArray(value)||value.length<(schema.minItems||0)||value.length>(schema.maxItems??Infinity))throw Error('模型数组不完整或超出限制。');
    if(schema.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)throw Error('模型数组含重复内容。');
    for(const v of value)validateShape(v,schema.items);
  }
  if(schema.type==='string'&&typeof value!=='string')throw Error('模型文本结构无效。');
  if(schema.type==='string'&&(value.length<(schema.minLength||0)||value.length>(schema.maxLength??Infinity)))throw Error('模型文本长度超出限制。');
  if(schema.type==='boolean'&&typeof value!=='boolean')throw Error('模型布尔结构无效。');
}
export function closeMlx(){proc?.kill();proc=undefined;for(const {reject,timer} of waiting.values()){clearTimeout(timer);reject(Error('本地模型已关闭。'));}waiting.clear();}
export async function mlxCompletion(request,{timeoutMs=120000}={}){
  if(!proc){
    const python=process.env.NOWPAST_MLX_PYTHON || new URL('../training/.venv/bin/python',import.meta.url).pathname;
    proc=spawn(python,[new URL('../training/worker.py',import.meta.url).pathname],{env:process.env,stdio:['pipe','pipe','pipe']});
    const worker=proc;
    let error='';proc.stderr.on('data',b=>{error=(error+b).slice(-2000);});
    proc.on('error',cause=>{if(proc!==worker)return;for(const {reject,timer} of waiting.values()){clearTimeout(timer);reject(Error('本地 MLX 运行环境未能启动：'+cause.message));}waiting.clear();proc=undefined;});proc.on('exit',()=>{if(proc!==worker)return;for(const {reject,timer} of waiting.values()){clearTimeout(timer);reject(Error('本地 MLX 模型未完成：'+error));}waiting.clear();proc=undefined;});
    createInterface({input:proc.stdout}).on('line',line=>{
      let r;try{r=JSON.parse(line);}catch{return;}
      const p=waiting.get(r.id);if(!p)return;clearTimeout(p.timer);waiting.delete(r.id);
      if(r.error){const error=Error('本地模型输出未通过核验：'+r.error);error.rawModel=r;p.reject(error);}else{try{validateShape(r.data,p.schema);p.resolve(r);}catch(e){e.rawModel=r;p.reject(e);}}
    });
  }
  const id=randomUUID();return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiting.delete(id);reject(Error('本地 MLX 推理超时。'));closeMlx();},timeoutMs);
    waiting.set(id,{resolve,reject,timer,schema:request.schema});proc.stdin.write(JSON.stringify({id,...request})+'\n');
  });
}
