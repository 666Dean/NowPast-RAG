// Probe raw teacher notices, score only after inference; never expose expected to the model.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {analyzeNotice} from '../generation/notice.mjs';
import {structuredCompletion,closeModel} from '../generation/model.mjs';
import {modelIdentity} from '../generation/identity.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=readFileSync(new URL('../experiments/raw-notices/fixtures.jsonl',import.meta.url));
const rows=fixture.toString().trim().split('\n').map(l=>JSON.parse(l));
const mode=process.env.NOWPAST_INTAKE_V2==='1'?'v2':'legacy',tag=process.env.NOWPAST_PROBE_TAG || 'development';
if(!/^[\w-]+$/.test(tag))throw Error('Invalid tag');
const out=new URL('./runs/raw-notices/',import.meta.url);mkdirSync(out,{recursive:true});
const files=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','-z','--','generation','knowledge','temporal','training','experiments/raw-notices'],{encoding:'utf8'}).split('\0').filter(f=>/\.(?:mjs|py)$|requirements\.txt$/.test(f)))].sort();
const sourceFiles=Object.fromEntries(files.map(f=>[f,sha(readFileSync(f))]));
const result={purpose:'observed development diagnostics, not independent test; no training gain claim',synthetic:true,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),sourceFiles,sourceDigest:sha(JSON.stringify(sourceFiles)),fixtureSha256:sha(fixture),identity:await modelIdentity(),mode,repetitionPenalty:Number(process.env.NOWPAST_MLX_REPETITION_PENALTY || 1),cases:[]};
const key=c=>JSON.stringify([c.course,c.classId,c.lessonDate || null,c.assignment || null,c.field,c.value,c.published,c.effective]);
const normalized=c=>({course:c.course || c.campus?.course,classId:c.scope,lessonDate:c.lessonDate || c.campus?.lessonDate || null,assignment:c.noticeType==='assignment'?(c.activity || '').match(/(?:作业[一二三四五六七八九十\d]+|第[一二三四五六七八九十\d]+次作业)$/)?.[0] || null:null,field:c.field || c.campus?.field,value:c.value,published:c.published,effective:c.effective});
try{
 for(const row of rows){
  const start=performance.now(),calls=[];let response,error;
  try{response=await analyzeNotice([],row.input,async request=>{
    // This transport receives only the user's notice and source candidates.
    const t=performance.now();try{const r=await structuredCompletion(request);calls.push({request,response:r,ms:performance.now()-t});return r;}
    catch(e){calls.push({request,error:e.message,rawModel:e.rawModel || null,ms:performance.now()-t});throw e;}
  });}catch(e){error=e.message;}
  const actual=(response?.clauses || []).map(normalized),grounded=!!response?.clauses?.length&&response.clauses.every(c=>row.input.text.includes(c.excerpt)&&c.excerpt.includes(c.value));
  const exact=!!response&&!row.expected.pending&&grounded&&JSON.stringify(actual.map(key).sort())===JSON.stringify(row.expected.clauses.map(key).sort());
  const modelRunFailure=!!error&&/运行环境|推理超时|未完成|输出未通过核验|未返回完整|模型已关闭/.test(error);
  const pendingCorrect=row.expected.pending&&!response&&!modelRunFailure;
  result.cases.push({id:row.id,scenario:row.scenario,input:row.input,expected:row.expected,actual,grounded,exact,pendingCorrect,error:error || null,response:response || null,calls,ms:performance.now()-start,modelRunFailure,ok:row.expected.pending?pendingCorrect:exact});
  const cs=result.cases;result.summary={n:cs.length,pass:cs.filter(c=>c.ok).length,published:cs.filter(c=>c.response).length,correctPublished:cs.filter(c=>c.exact).length,incorrectPublished:cs.filter(c=>c.response&&!c.exact).length,rejected:cs.filter(c=>!c.response).length,correctPending:cs.filter(c=>c.pendingCorrect).length,modelRunFailure:cs.filter(c=>c.modelRunFailure).length,promptTokens:cs.flatMap(c=>c.calls).reduce((s,c)=>s+(c.response?.usage?.prompt_tokens || 0),0),completionTokens:cs.flatMap(c=>c.calls).reduce((s,c)=>s+(c.response?.usage?.completion_tokens || 0),0)};
  result.byScenario=Object.fromEntries([...new Set(cs.map(c=>c.scenario))].map(scene=>{const group=cs.filter(c=>c.scenario===scene);return [scene,{n:group.length,pass:group.filter(c=>c.ok).length,published:group.filter(c=>c.response).length,incorrectPublished:group.filter(c=>c.response&&!c.exact).length}];}));
  const latencies=cs.map(c=>c.ms).sort((a,b)=>a-b);result.summary.p50ms=latencies[Math.ceil(latencies.length*.5)-1];result.summary.p95ms=latencies[Math.ceil(latencies.length*.95)-1];
  writeFileSync(new URL(`${mode}-${tag}.json`,out),JSON.stringify(result,null,2));
  console.log(row.id,result.cases.at(-1).ok?'pass':'FAIL',error || actual.map(c=>[c.course,c.lessonDate || c.assignment,c.field,c.value]),Math.round(performance.now()-start)+'ms');
 }
}finally{closeModel();}
console.log(result.summary);
