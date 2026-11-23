// Replay original bytes/outputs; no inference and no rewriting historical scores.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync,existsSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {publicEvidence,setMetrics,visible,match} from './engine.mjs';
import {answer} from '../qa/answer.mjs';
const root=new URL(process.env.NOWPAST_AUDIT_DATA || './full/',import.meta.url),out=new URL(process.env.NOWPAST_AUDIT_OUTPUT || './next-audit/',import.meta.url);mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(readFileSync(new URL(p,root))),unzip=p=>JSON.parse(gunzipSync(readFileSync(new URL(p,root))));
const original=unzip('results/generation.json.gz'),cache=json('results/model-cache.json'),freeze=json('freeze.json');
const source=execFileSync('git',['show','39f23b5:experiments/generate-answers.mjs'],{encoding:'utf8'});
const system=source.match(/const system='([^']+)';/)[1],object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const rows=[],core=[],missing=[{artifact:'raw HTTP completion body / finish_reason',status:'无法复核：旧 transport 只保存解析后的 data / usage，不保存原始响应字节或 finish_reason'},
  {artifact:'old original request byte log',status:'未保存原始请求日志；本次由固定源码、原候选重建。cacheKey 完全匹配时仅能证明规范 JSON 输入一致，不能称新文件为旧日志'},
  {artifact:'old runtime binary at run instant / model cache identity',status:'权重和当前 binary 可散列，旧 key 未纳入其身份；旧时刻文件是否相同仍未知'}];
const inventory=[];
function walk(dir,prefix=''){for(const name of readdirSync(dir)){const path=new URL(name,dir),rel=prefix+name;if(statSync(path).isDirectory())walk(new URL(name+'/',dir),rel+'/');else {const bytes=readFileSync(path);inventory.push({path:'experiments/full/'+rel,bytes:bytes.length,sha256:hash(bytes)});}}}
walk(root);
const sourceMap=[];const identity=JSON.parse(readFileSync(new URL('./MODELS-AND-SOURCE.json',import.meta.url)));
for(const [path,expected] of Object.entries(identity.sourceFiles)){
 let published=null;try{published=hash(execFileSync('git',['show','39f23b5:'+path],{maxBuffer:2e7}));}catch{}
 const local=existsSync(path)?hash(readFileSync(path)):null;
 sourceMap.push({path,reportedServiceSha256:expected,publishedSha256:published,currentSha256:local,publishedMatchesReported:published===expected});
}
function parents(q,docs){return [...new Set(q.gold.flatMap(g=>docs.get(g.id)?.supersedes || []))];}
function audit(q,docs,pred){
 const evidence=pred.evidence.map(id=>docs.get(id));
 const labels=evidence.map((_,i)=>'E'+(i+1)),options={type:'array',maxItems:5,items:labels.length?{type:'string',enum:labels}:{type:'string'}};if(!labels.length)options.maxItems=0;
 const schema=object({answers:object(Object.fromEntries(q.fields.map(f=>[f,options]))),previous:options});
 const input={question:q.question,asOf:q.asOf,lessonDate:q.lessonDate,activityId:q.activityId,classId:q.classId,course:q.course,fields:q.fields,evidence:evidence.map((d,i)=>({...publicEvidence(d),key:labels[i]}))};
 const key=hash(JSON.stringify({system,input,schema,maxTokens:256,model:'Qwen2.5-0.5B-Instruct-Q4_K_M',temperature:0,seed:42}));
 const cached=cache[pred.cacheKey],inputVerified=key===pred.cacheKey;
 const invalid=[];const selected=[];
 for(const field of q.fields)for(const label of pred.output?.answers?.[field] || []){
   const doc=/^E[1-5]$/.test(label)?evidence[Number(label.slice(1))-1]:null;
   if(!doc)invalid.push({field,label});else selected.push({field,doc});
 }
 const previous=(pred.output?.previous || []).flatMap(label=>evidence[Number(label.slice(1))-1]?[evidence[Number(label.slice(1))-1].id]:[]);
 const distinct=field=>[...new Set(q.gold.filter(g=>g.field===field).map(g=>g.value))];
 const conflict=q.fields.filter(f=>distinct(f).length>1),unsupported=q.fields.filter(f=>!q.gold.some(g=>g.field===f));
 const success=!pred.error&&!invalid.length&&!!pred.output?.answers;
 const temporal=selected.some(x=>!visible(x.doc,q)||x.doc.effective>(q.lessonDate||q.asOf)||q.oldIds.includes(x.doc.id));
 const range=selected.some(x=>!match(x.doc,q)||x.field!==x.doc.campus.field);
 const fieldScores=q.fields.map(f=>setMetrics(selected.filter(x=>x.field===f).map(x=>x.doc.value),distinct(f)));
 const direct=parents(q,docs),transitive=q.oldIds;
 const metrics={runtimeFailure:!success,fieldExact:success?fieldScores.reduce((a,b)=>a+b.exact,0)/q.fields.length:0,
   questionExact:success&&fieldScores.every(s=>s.exact),temporalError:success?temporal:null,rangeError:success?range:null,
   citationPrecision:success?setMetrics(selected.map(x=>x.field+'|'+x.doc.id),q.gold.map(g=>g.field+'|'+g.id)).precision:null,
   directLinkExact:success?setMetrics(previous,direct).exact:0,transitiveLinkExact:success?setMetrics(previous,transitive).exact:0,
   oldLinkNonempty:!!transitive.length,conflictRetention:conflict.length&&success?conflict.every(f=>setMetrics(selected.filter(x=>x.field===f).map(x=>x.doc.value),distinct(f)).exact):null,
   missingAbstention:unsupported.length&&success?unsupported.every(f=>!selected.some(x=>x.field===f)):null,
   coverage:q.fields.filter(f=>selected.some(x=>x.field===f)).length/q.fields.length};
 const tags=[];
 if(!success)tags.push('运行失败/结构错误');
 if(q.gold.some(g=>!pred.evidence.includes(g.id)))tags.push('正确证据未召回');
 if(success){
  if(selected.some(x=>q.oldIds.includes(x.doc.id)&&!q.gold.some(g=>g.field===x.field&&g.value===x.doc.value)))tags.push('旧值作为当前');
  if(selected.some(x=>!q.gold.some(g=>g.field===x.field&&g.id===x.doc.id)&&q.gold.some(g=>g.field===x.field&&g.value===x.doc.value)))tags.push('值正确但引用错误');
  if(selected.some(x=>x.field!==x.doc.campus.field))tags.push('字段混淆');
  if(selected.some(x=>!match(x.doc,q)))tags.push('跨范围');
  if(metrics.conflictRetention===false)tags.push('冲突漏方');
  if(metrics.missingAbstention===false)tags.push('缺证肯定');
  if(metrics.transitiveLinkExact===0)tags.push('旧链接选择/定义');
  if(!metrics.questionExact&&!tags.length)tags.push('其他字段值/弃答错误');
 }
 const scoringFlags=[];
 if(pred.error&&(pred.temporalError||pred.rangeError))scoringFlags.push('旧评分把运行失败计为语义时间/范围错误');
 if(q.fields.some(f=>q.gold.filter(g=>g.field===f).length>1&&distinct(f).length===1))scoringFlags.push('同值多来源并非安排冲突');
 return {qid:q.id,seed:pred.seed,world:q.world,method:pred.method,scene:q.scene,question:q.question,query:{asOf:q.asOf,lessonDate:q.lessonDate,activityId:q.activityId,classId:q.classId,course:q.course,fields:q.fields},
  gold:q.gold,directOldIds:direct,transitiveOldIds:transitive,candidates:evidence.map((d,i)=>({key:labels[i],id:d.id,role:q.gold.some(g=>g.id===d.id)?'gold-current':q.oldIds.includes(d.id)?'gold-ancestor':'other',roleProvenance:'audit gold annotation NOT original model input',doc:d})),
  inputReconstruction:{verifiedByOriginalCacheKey:inputVerified,system,input,schema,maxTokens:256},cacheKey:pred.cacheKey,rawParsedOutput:pred.output,cachedParsedResponse:cached?.data || null,usage:cached?.usage || null,
  error:pred.error,finishReason:null,oldMetrics:Object.fromEntries(['fieldExact','temporalError','rangeError','conflictRetention','oldLinkExact'].map(k=>[k,pred[k]])),metrics,tags,primaryCause:tags[0]||'none',scoringFlags};
}
for(const seed of freeze.datasets.map(d=>d.seed)){
 const bytes=readFileSync(new URL(`data/seed-${seed}.json.gz`,root));if(hash(bytes)!==freeze.datasets.find(d=>d.seed===seed).sha256)throw Error('original dataset hash mismatch');
 const data=JSON.parse(gunzipSync(bytes)),docs=new Map(data.docs.map(d=>[d.id,d])),qs=new Map(data.questions.map(q=>[q.id,q]));
 for(const pred of original.rows.filter(r=>r.seed===seed)) rows.push(audit(qs.get(pred.id),docs,pred));
 for(const q of data.questions.filter(q=>q.split==='test')){
  const r=answer(data.docs,q.question,{...q,domain:'campus'}),current=r.sections.flatMap(s=>s.items.filter(i=>['当前依据','冲突依据'].includes(i.role)).map(i=>({field:s.field,id:i.doc.id,value:i.doc.value})));
  const old=[...new Set(r.items.filter(i=>i.role==='已被替代').map(i=>i.doc.id))];
  core.push({qid:q.id,seed,fieldExact:setMetrics(current.map(x=>x.field+'|'+x.value),q.gold.map(g=>g.field+'|'+g.value)).exact,evidenceExact:setMetrics(current.map(x=>x.field+'|'+x.id),q.gold.map(g=>g.field+'|'+g.id)).exact,
    transitiveLinkExact:setMetrics(old,q.oldIds).exact,statusExact:q.fields.every(f=>{const v=[...new Set(q.gold.filter(g=>g.field===f).map(g=>g.value))];return r.fields[f]?.status===(v.length>1?'conflict':v.length?'ok':'unknown');})});
 }
}
const mean=(xs,k)=>{const a=xs.filter(x=>x[k]!==null&&x[k]!==undefined);return {n:a.length,value:a.length?a.reduce((s,x)=>s+Number(x[k]),0)/a.length:null};};
const methods=[...new Set(rows.map(r=>r.method))],summary=methods.map(method=>{const a=rows.filter(r=>r.method===method),m=a.map(r=>r.metrics);return {method,n:a.length,fieldQuestionFailures:a.filter(r=>!r.metrics.questionExact).length,failures:a.filter(r=>r.tags.length).length,primaryCauseRows:a.filter(r=>r.primaryCause!=='none').length,runtimeFailures:a.filter(r=>r.metrics.runtimeFailure).length,
 ...Object.fromEntries(['fieldExact','questionExact','temporalError','rangeError','citationPrecision','directLinkExact','transitiveLinkExact','conflictRetention','missingAbstention','coverage'].map(k=>[k,mean(m,k)])),nonemptyOldLinks:mean(m.filter(x=>x.oldLinkNonempty),'transitiveLinkExact'),emptyOldLinks:mean(m.filter(x=>!x.oldLinkNonempty),'transitiveLinkExact')};});
const taxonomy=methods.flatMap(method=>{const a=rows.filter(r=>r.method===method);return [...new Set(rows.flatMap(r=>r.tags))].map(tag=>({method,tag,n:a.filter(r=>r.tags.includes(tag)).length,primaryN:a.filter(r=>r.primaryCause===tag).length,denominator:a.length}));});
const examples=[];
for(const scene of ['room-change','replacement-chain','conflict']) examples.push(...rows.filter(r=>r.method==='NowPast'&&r.scene===scene).slice(0,3));
for(const qid of ['s11-w34-q191','s11-w41-q25','s11-w44-q47'])examples.push(...rows.filter(r=>r.qid===qid&&['NowPast','Vector','Vector-filtered'].includes(r.method)));
for(const file of ['case-audit','representative-cases']){const a=file==='case-audit'?rows:examples;writeFileSync(new URL(file+'.jsonl.gz',out),gzipSync(a.map(r=>JSON.stringify(r)).join('\n')+'\n'));}
writeFileSync(new URL('representative-cases.jsonl',out),examples.map(r=>JSON.stringify(r)).join('\n')+'\n');
writeFileSync(new URL('core-replay.json.gz',out),gzipSync(JSON.stringify(core)));
writeFileSync(new URL('source-map.json',out),JSON.stringify({publicCommit:'39f23b5',reportedService:'4288171',reportedExperiment:'959bbf9',mapping:sourceMap},null,2));
writeFileSync(new URL('MANIFEST.json',out),JSON.stringify({runType:'NEW AUDIT of original outputs, not a rerun of old inference',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),coreSourceHashes:Object.fromEntries(['../qa/answer.mjs','../qa/campus.mjs','../temporal/campus.mjs','../knowledge/notice-adapter.mjs'].map(path=>[path,hash(readFileSync(new URL(path,import.meta.url)))])),inventory,missing,
 rows:rows.length,inputVerified:rows.filter(r=>r.inputReconstruction.verifiedByOriginalCacheKey).length,summary,core:{n:core.length,...Object.fromEntries(['fieldExact','evidenceExact','statusExact','transitiveLinkExact'].map(k=>[k,mean(core,k)]))}},null,2));
writeFileSync(new URL('error-taxonomy.csv',out),'method,tag,n,primaryN,denominator\n'+taxonomy.map(r=>Object.values(r).join(',')).join('\n')+'\n');
writeFileSync(new URL('root-cause-report.md',out),`# 阶段 A：旧输出新审计\n\n核对原 230 题×9 方法共 ${rows.length} 行，${rows.filter(r=>r.inputReconstruction.verifiedByOriginalCacheKey).length} 行可重建出完全相同 cacheKey。候选顺序与原解析输出来自旧产物；角色由审计金标标注，不伪称旧模型见过角色。finish_reason、HTTP原始响应字节缺失，已列无法复核。\n\n完整分类见 error-taxonomy.csv（多标签计数不等于失败题数，primaryN 才是首因互斥计数）。首因是可观察输出分类而非模型内部因果。角色缺失与性能相关，但未做角色配对干预前不能量化因果。10+逐行案例见 representative-cases.jsonl，其中三个指定题同时含相关基线。\n\n规则核心新重放 ${core.length} 题，字段集合 exact=${mean(core,'fieldExact').value}，状态=${mean(core,'statusExact').value}；不得把该成绩替代旧模型成绩。旧表完全保留，新指标把超时排出语义分母；同值多来源按不同值判断冲突；值、引用、直接父链接、全祖先与非空旧链分别统计，覆盖率防止全部弃答被当成正确。\n\n新数据/模型实验不得再把已观察230题当盲测。人工语义审查尚须真实人完成，自动审计不充当人工标注。\n`);
console.log({rows:rows.length,inputVerified:rows.filter(r=>r.inputReconstruction.verifiedByOriginalCacheKey).length,coreN:core.length,NowPast:summary.find(s=>s.method==='NowPast')});
