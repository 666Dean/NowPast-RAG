// Real HTTP smoke checks. --model additionally launches the downloaded Qwen.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {seed} from '../knowledge/data.mjs';
import {answer} from '../qa/answer.mjs';
import {campusSeed,campusConflictSeed,campusClarifiedSeed} from '../knowledge/campus-data.mjs';

const realModel = process.argv.includes('--model');
const output = new URL('./validation/',import.meta.url);
await mkdir(output,{recursive:true});
const log=[];
const staticChecks=[];
async function start(modelHome) {
  const probe=createServer();
  probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  const child=spawn(process.execPath,['service/server.mjs'],{
    cwd:new URL('../',import.meta.url),
    env:{...process.env,PORT:String(port),NOWPAST_MODEL_HOME:modelHome},stdio:['ignore','pipe','pipe']});
  let errors=''; child.stderr.on('data',b=>{errors+=b;});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(Error('Service startup timed out: '+errors));},10000);
    child.once('error',err=>{clearTimeout(timer);reject(err);});
    child.once('exit',code=>{clearTimeout(timer);reject(Error('Service exited '+code+': '+errors));});
    child.stdout.on('data',b=>{if(String(b).includes('NowPast http://')){clearTimeout(timer);resolve();}});
  });
  return {child,origin:'http://127.0.0.1:'+port};
}
async function stop(child) {
  const done=once(child,'exit'); child.kill('SIGTERM');
  const timer=setTimeout(()=>child.kill('SIGKILL'),5000);
  try {await done;} finally {clearTimeout(timer);}
}
async function post(server,name,request,status,{path='/api/generate',docs=seed}={}) {
  const response=await fetch(server.origin+path,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...request,docs}),signal:AbortSignal.timeout(100000)});
  const body=await response.json();
  assert.equal(response.status,status,name+': '+JSON.stringify(body));
  log.push({name,path,request,status:response.status,response:body});
  return body;
}
const missing=await mkdtemp(join(tmpdir(),'nowpast-no-model-'));
const server=await start(missing);
try {
  const page=await fetch(server.origin+'/'); assert.equal(page.status,200);
  for (const path of ['/web/app.mjs','/knowledge/data.mjs','/temporal/graph.mjs','/retrieval/rank.mjs','/qa/answer.mjs','/qa/campus.mjs','/temporal/campus.mjs','/knowledge/campus-data.mjs']) {
    assert.equal((await fetch(server.origin+path)).status,200,path);
  }
  for(const [path,type] of [['/web/controls.mjs','text/javascript'],['/web/controls.css','text/css'],['/web/assets/mountain-dawn.webp','image/webp']]) {
    const response=await fetch(server.origin+path);
    assert.equal(response.status,200,path);
    assert.ok(response.headers.get('content-type')?.startsWith(type),path+' MIME');
    const bytes=(await response.arrayBuffer()).byteLength;
    assert.ok(bytes>0,path+' empty response');
    staticChecks.push({path,status:response.status,type,bytes});
  }
  await post(server,'evidence unavailable',{question:'电池费用能报销多少钱？',date:'2026-11-20',scope:'B组'},422);
  await post(server,'model unavailable',{question:'验收地点',date:'2026-11-12',scope:'B组'},503);
  await post(server,'research uses primary sources',{question:'论文和源码的融合方式有什么差异？',date:'2026-11-20',scope:'B组'},422);
  const base={domain:'campus',question:'2班周五数据库课几点、在哪上？',asOf:'2026-11-25',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'};
  const campusExamples=[];
  for(const [name,options,docs,room,status] of [
    ['campus before publication',{asOf:'2026-11-24'},campusSeed,'A301','ok'],
    ['campus published adjustment',{},campusSeed,'B204','ok'],
    ['campus other class',{classId:'计科1班'},campusSeed,'A301','ok'],
    ['campus next week',{lessonDate:'2026-12-04'},campusSeed,'A301','ok'],
    ['campus conflict',{asOf:'2026-11-26'},campusConflictSeed,null,'conflict'],
    ['campus clarification',{asOf:'2026-11-26'},campusClarifiedSeed,'B204','ok'],
    ['campus missing fee',{question:'上课在哪，要交多少钱？'},campusSeed,'B204','unknown']
  ]) {
    const request={...base,...options};
    const response=await post(server,name,request,200,{path:'/api/query',docs});
    assert.equal(response.status,status);
    if(room) assert.deepEqual(response.fields.room.values,[room]);
    if(name!=='campus missing fee') assert.deepEqual(response.fields.time.values,['08:00–09:40']);
    if(['campus published adjustment','campus conflict','campus missing fee'].includes(name)) {
      campusExamples.push({name,path:'/api/query',request:{...request,docs},response});
    }
  }
  await post(server,'campus model unavailable',base,503,{docs:campusSeed});
  await post(server,'campus fee has no evidence',{...base,question:'要交多少钱？'},422,{docs:campusSeed});
  await writeFile(new URL('campus-examples.json',output),JSON.stringify({dataType:'fictional',examples:campusExamples},null,2)+'\n');
} finally {await stop(server.child);}

const examples=[{name:'announced, not yet effective',request:{question:'B组该用什么融合方式？',date:'2026-11-08',scope:'B组'}},
  {name:'two conflicting current sources',request:{question:'B组去哪验收？',date:'2026-11-14',scope:'B组'}}]
  .map(e=>({...e,response:answer(seed,e.request.question,e.request)}));
assert.ok(examples[0].response.items.some(i=>i.doc.id==='B13' && i.role==='已公布待生效'));
assert.equal(examples[1].response.status,'conflict');
await writeFile(new URL('engine-examples.json',output),JSON.stringify({docs:seed,examples},null,2)+'\n');

if (realModel) {
  assert.ok(process.env.NOWPAST_MODEL_HOME,'Set NOWPAST_MODEL_HOME to the prepared model cache.');
  const real=await start(process.env.NOWPAST_MODEL_HOME);
  try {
    for (const [name,request] of [
      ['single clause',{question:'A组报告交什么格式？',date:'2026-11-06',scope:'A组'}],
      ['multi-sentence reason',{question:'验收地点为什么变了？',date:'2026-11-18',scope:'B组'}],
      ['unresolved conflict',{question:'验收地点',date:'2026-11-14',scope:'B组'}]]) {
      const generated=await post(real,name,request,200);
      const evidence=answer(seed,request.question,request).sections.flatMap(s=>s.items);
      assert.equal(generated.citations.length,evidence.length);
      for (const c of generated.citations) assert.ok(seed.find(d=>d.id===c.id)?.text.includes(c.quote),c.id);
      if(name==='single clause') assert.deepEqual(generated.citations.map(c=>c.id),['M01']);
      if(name==='multi-sentence reason') assert.ok(generated.citations.find(c=>c.id==='R30')?.quote.includes('源于'));
      if(name==='unresolved conflict') assert.deepEqual(generated.citations.map(c=>c.id).sort(),['M03','R21','R22']);
    }
    for(const [name,docs] of [['campus lesson',campusSeed],['campus conflicting lesson',campusConflictSeed]]) {
      const request={domain:'campus',question:'2班周五数据库课几点、在哪上？',asOf:'2026-11-26',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'};
      const generated=await post(real,name,request,200,{docs});
      for(const citation of generated.citations) assert.ok(docs.find(doc=>doc.id===citation.id)?.text.includes(citation.quote));
      const expected=answer(docs,request.question,request).items.map(item=>item.doc.id).sort();
      assert.deepEqual(generated.citations.map(citation=>citation.id).sort(),expected);
      assert.ok(generated.citations.some(citation=>citation.id==='S2-2026-11-27-time'));
      if(name==='campus conflicting lesson') {
        assert.ok(generated.citations.some(citation=>citation.id==='N25-room'));
        assert.ok(generated.citations.some(citation=>citation.id==='N26-room'));
      }
    }
  } finally {await stop(real.child);}
}
await writeFile(new URL('api-results.json',output),JSON.stringify({realModel,node:process.version,platform:process.platform,arch:process.arch,staticChecks,checks:log},null,2)+'\n');
console.log('HTTP checks passed; real model:',realModel,'; recorded responses:',log.length);
