// Real HTTP smoke checks. --model additionally launches the downloaded Qwen.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {seed} from '../knowledge/data.mjs';
import {noticeSeed} from '../knowledge/notices.mjs';
import {answer} from '../qa/answer.mjs';

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
  log.push({name,request,status:response.status,response:body});
  return body;
}
const missing=await mkdtemp(join(tmpdir(),'nowpast-no-model-'));
const server=await start(missing);
try {
  const page=await fetch(server.origin+'/'); assert.equal(page.status,200);
  for (const path of ['/web/app.mjs','/web/notice-relations.mjs','/knowledge/notices.mjs','/knowledge/data.mjs','/temporal/graph.mjs','/retrieval/rank.mjs','/qa/answer.mjs']) {
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
  await post(server,'notice model unavailable',{title:'数据库教室调整',text:'11月27日起，计科2班数据库课教室调整为C205。',published:'2026-11-21',scope:'计科2班'},503,{path:'/api/notices/analyze',docs:noticeSeed});
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
    for (const [name,request,prior,value] of [
      ['teacher room notice',{title:'数据库：11月27日教室调整',text:'自11月27日起，计科2班数据库课教室由B204调整为C205，替代此前的教室安排。上课时间仍为08:00–09:40。'},'DB-ROOM-NEW','C205'],
      ['teacher assignment notice',{title:'数据库：作业一延期',text:'即日起，计科2班数据库作业一截止时间由11月27日18:00顺延至11月28日18:00，替代此前的截止要求。仍在课程平台提交。'},'DB-DUE-NEW','11月28日18:00']
    ]) {
      const result=await post(real,name,{...request,published:'2026-11-21',scope:'计科2班'},200,{path:'/api/notices/analyze',docs:noticeSeed});
      assert.equal(result.clauses.length,1,name);
      assert.equal(result.clauses[0].value,value,name);
      assert.deepEqual(result.clauses[0].supersedes,[prior],name);
      assert.ok(request.text.includes(result.clauses[0].value),name);
    }
  } finally {await stop(real.child);}
}
await writeFile(new URL('api-results.json',output),JSON.stringify({realModel,node:process.version,platform:process.platform,arch:process.arch,staticChecks,checks:log},null,2)+'\n');
console.log('HTTP checks passed; real model:',realModel,'; recorded responses:',log.length);
