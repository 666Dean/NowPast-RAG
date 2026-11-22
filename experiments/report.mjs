import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL(process.env.NOWPAST_EXPERIMENT_DIR || './',import.meta.url);
const json=p=>JSON.parse(readFileSync(new URL(p,root)));
const unzip=p=>JSON.parse(gunzipSync(readFileSync(new URL(p,root))));
const config=json('config.json'),retrieval=json('results/retrieval-summary.json'),gen=json('results/generation-summary.json'),prediction=unzip('results/generation.json.gz');
const cache=json('results/model-cache.json'),sample=json('generation-sample.json');
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const quantile=(a,p)=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)] || 0;};
let state=config.bootstrapSeed;const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
function clusterCI(rows,key){
  const groups=new Map();
  for(const r of rows){if(r[key]===null)continue;const g=groups.get(r.world) || {sum:0,n:0};g.sum+=r[key];g.n++;groups.set(r.world,g);}
  const a=[...groups.values()],boot=[];
  for(let t=0;t<1000;t++){let sum=0,n=0;for(let i=0;i<a.length;i++){const g=a[Math.floor(random()*a.length)];sum+=g.sum;n+=g.n;}boot.push(n?sum/n:0);}
  return {clusters:a.length,lower:quantile(boot,.025),upper:quantile(boot,.975)};
}
const rows=prediction.rows,latency=[],ci=[],errors=[],worldCounts={},datasetAudit=[],sourceArtifacts=[];
const retrievalRows=[];
for(const seed of config.seeds){
  const data=unzip(`data/seed-${seed}.json.gz`),qs=new Map(data.questions.map(q=>[q.id,q]));
  const rr=unzip(`results/retrieval-${seed}.json.gz`).filter(r=>r.split==='test');retrievalRows.push(...rr);
  const devWorlds=new Set(data.questions.filter(q=>q.split==='dev').map(q=>q.world)),testWorlds=new Set(data.questions.filter(q=>q.split==='test').map(q=>q.world));
  const devQ=new Set(data.questions.filter(q=>q.split==='dev').map(q=>q.question));
  const templates=q=>q.question.replaceAll(q.classId,'<class>').replaceAll(q.course,'<course>').replace(/\d+/g,'#');
  const devTemplates=new Set(data.questions.filter(q=>q.split==='dev').map(templates));
  datasetAudit.push({seed,worldOverlap:[...devWorlds].filter(x=>testWorlds.has(x)).length,
    exactQuestionOverlap:data.questions.filter(q=>q.split==='test'&&devQ.has(q.question)).length,
    normalizedTemplateOverlap:data.questions.filter(q=>q.split==='test'&&devTemplates.has(templates(q))).length,
    duplicateQuestions:data.questions.length-new Set(data.questions.map(q=>q.question)).size,
    testWorlds:testWorlds.size,devWorlds:devWorlds.size,scenarioCounts:Object.fromEntries([...new Set(data.questions.map(q=>q.scene))].map(scene=>[scene,data.questions.filter(q=>q.split==='test'&&q.scene===scene).length]))});
  for(const r of rows.filter(r=>r.seed===seed && !r.questionExact)){
    const q=qs.get(r.id);if(errors.filter(x=>x.method===r.method).length>=5)continue;
    errors.push({method:r.method,id:r.id,scene:r.scene,question:q.question,asOf:q.asOf,lessonDate:q.lessonDate,gold:q.gold,oldIds:q.oldIds,evidence:r.evidence,selected:r.selected,previous:r.previous,error:r.error});
  }
  for(const [name,content] of [[`data/seed-${seed}.json.gz`,readFileSync(new URL(`data/seed-${seed}.json.gz`,root))],[`results/retrieval-${seed}.json.gz`,readFileSync(new URL(`results/retrieval-${seed}.json.gz`,root))]])
    sourceArtifacts.push({path:name,bytes:content.length,sha256:createHash('sha256').update(content).digest('hex')});
}
const methods=retrieval.summary.map(r=>r.method);
for(const method of methods){
  const gr=rows.filter(r=>r.method===method),rr=retrievalRows.filter(r=>r.method===method);
  const equivalent=gr.map(r=>cache[r.cacheKey]?.ms || 0),fresh=gr.filter(r=>!r.cached).map(r=>r.ms);
  latency.push({method,retrievalP50ms:quantile(rr.map(r=>r.ms),.5),retrievalP95ms:quantile(rr.map(r=>r.ms),.95),
    generationEquivalentP50ms:quantile(equivalent,.5),generationEquivalentP95ms:quantile(equivalent,.95),
    freshCalls:fresh.length,cacheHits:gr.filter(r=>r.cached).length,promptTokensMean:avg(gr.map(r=>r.usage?.prompt_tokens || 0)),
    completionTokensMean:avg(gr.map(r=>r.usage?.completion_tokens || 0)),maxPromptTokens:Math.max(...gr.map(r=>r.usage?.prompt_tokens || 0)),
    meanContextCharacters:avg(rr.map(r=>r.characters))});
  ci.push({method,fieldExact:clusterCI(gr,'fieldExact'),fieldF1:clusterCI(gr,'fieldF1'),evidenceRecall:clusterCI(rr,'evidenceRecall')});
}
const paired=[];
for(const baseline of ['Vector-filtered','BM25-filtered','Latest','no-history','no-graph']){
  const b=new Map(rows.filter(r=>r.method===baseline).map(r=>[r.id,r]));
  const diff=rows.filter(r=>r.method==='NowPast').map(r=>({...r,difference:r.fieldExact-b.get(r.id).fieldExact}));
  paired.push({baseline,meanDifference:avg(diff.map(r=>r.difference)),ci:clusterCI(diff,'difference')});
}
const winners=[];
for(const n of rows.filter(r=>r.method==='NowPast')){
  for(const method of ['Vector-filtered','BM25-filtered','Latest','no-history']){
    const b=rows.find(r=>r.id===n.id&&r.method===method);
    if(b && b.fieldExact>n.fieldExact && winners.length<10) winners.push({id:n.id,scene:n.scene,better:method,baseline:b.fieldExact,NowPast:n.fieldExact,baselineOutput:b.output,nowPastOutput:n.output});
  }
}
const uniqueKeys=[...new Set(rows.map(r=>r.cacheKey))],actualUsage={prompt_tokens:0,completion_tokens:0,total_tokens:0};
for(const key of uniqueKeys)for(const k of Object.keys(actualUsage)) actualUsage[k]+=cache[key]?.usage?.[k] || 0;
const lifetimeUsage={prompt_tokens:0,completion_tokens:0,total_tokens:0};
for(const run of Object.values(cache))for(const k of Object.keys(lifetimeUsage))lifetimeUsage[k]+=run.usage?.[k] || 0;
const conditionalLinks=methods.map(method=>{
  const a=rows.filter(r=>r.method===method&&sample.samples.some(s=>s.id===r.id));
  const queries=new Map();for(const seed of config.seeds) for(const q of unzip(`data/seed-${seed}.json.gz`).questions)queries.set(q.id,q);
  const nonempty=a.filter(r=>queries.get(r.id).oldIds.length);
  return {method,n:nonempty.length,oldLinkExact:avg(nonempty.map(r=>r.oldLinkExact))};
});
const report={sourceCommit:prediction.sourceCommit,generatedByCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  synthetic:true,latency,ci,paired,conditionalLinks,datasetAudit,uniqueModelInputs:uniqueKeys.length,totalMethodQueries:rows.length,
  actualUsage,lifetimeCacheEntries:Object.keys(cache).length,lifetimeUsage,currentPassCosts:gen.costs,sourceArtifacts,unfavorableExamples:winners,errors};
writeFileSync(new URL('results/analysis.json',root),JSON.stringify(report,null,2));
writeFileSync(new URL('results/errors.json',root),JSON.stringify(errors,null,2));
writeFileSync(new URL('results/latency.csv',root),Object.keys(latency[0]).join(',')+'\n'+latency.map(x=>Object.values(x).join(',')).join('\n')+'\n');
writeFileSync(new URL('results/generation-summary.csv',root),Object.keys(gen.summary[0]).join(',')+'\n'+gen.summary.map(x=>Object.values(x).join(',')).join('\n')+'\n');
const p=x=>(x*100).toFixed(1)+'%';
const lines=[`# 虚拟校务实验运行报告`,``,`受验生成代码：\`${prediction.sourceCommit}\`。五个种子：${config.seeds.join('、')}。所有成绩来自本地实际运行，不能代表真实学校效果。`,``,
`## 数据与协议`,``,...json('freeze.json').datasets.map(d=>`- seed ${d.seed}：${d.notices} 份通知，${d.questions} 问（测试 ${d.testQuestions}）。`),
``,`各方法 top-k=${config.topK}，证据最多 ${config.contextCharacters} 字符；同一本地模型上下文上限 8192 tokens、输出上限 256 tokens。共 ${sample.samples.length} 道固定分层模型题，每方法同题同提示。原文语法自动整理与人工图分列，非模板原文能力另看 intake-probe.json。`,
``,`## 检索结果`,``,`|方法|测试题数|当前证据召回|原上下文精确率|旧证据召回|平均上下文条数|`,`|---|---:|---:|---:|---:|---:|`,
...retrieval.summary.map(r=>`|${r.method}|${r.n}|${p(r.evidenceRecall)}|${p(r.contextPrecision)}|${p(r.oldLinkRecall)}|${r.contextCount.toFixed(2)}|`),
``,`空金标的召回记 1；旧证据为空的题旧召回也记 1，需结合分场景和非空旧链接表。历史证据会降低“上下文精确率”，这不等同引用错误。`,
``,`## 同生成器真实推理`,``,`|方法|题数|字段 exact|字段 F1|当前引用精确率|旧链接 exact|时间错误|跨范围错误|冲突保留|缺证弃答|`,
`|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|`,
...gen.summary.map(r=>`|${r.method}|${r.n}|${p(r.fieldExact)}|${p(r.fieldF1)}|${p(r.citationPrecision)}|${p(r.oldLinkExact)}|${p(r.temporalError)}|${p(r.rangeError)}|${p(r.conflictRetention)}|${p(r.missingAbstention)}|`),
``,`模型根据证据选择字段及旧通知 ID，再从相同来源逐字回填值；全部方法共用这一生成器。没有用 NowPast 规则答案冒充模型回答。模型输出错误不通过金标修正。调用失败保留日志，字段准确率记 0；原始时间/范围指标也按失败计错，不能把超时解释成已产生某种具体时间错误。`,
``,`## 成本、置信区间和错例`,``,
`实际不同模型输入 ${uniqueKeys.length} 个，共 ${rows.length} 个方法×题配对；同一输入的缓存复用 ${rows.length-uniqueKeys.length} 次。实际累计 prompt tokens=${actualUsage.prompt_tokens}、completion tokens=${actualUsage.completion_tokens}。逐方法 token 与 p50/p95 见 latency.csv；缓存题的等价推理耗时取生成该缓存的实际耗时，不把缓存读取当作零耗时模型。机器同时承担少量验证与索引任务，延迟只视为本次本机观测。`,
`缓存总计 ${Object.keys(cache).length} 次实际完成（含初版探索中未被最终题目使用的输入），共 prompt tokens=${lifetimeUsage.prompt_tokens}、completion tokens=${lifetimeUsage.completion_tokens}；最终运行新增调用 ${gen.costs.actualCalls} 次。按完全相同的模型输入复用早先实跑输出，未称为新推理。token 汇总只累加已返回的 usage；失败或超时未返回的用量未知，不能把缺失 usage 解释为消耗零 token。`,
``,`95% 区间按事件世界聚类重采样 1000 次，见 analysis.json；配对差异保留负值和跨零区间。分场景表在 retrieval-summary.json / generation-summary.json，规模曲线在 scale-workloads.json，完整逐题输出在 retrieval-*.json.gz / generation.json.gz。`,
``,`不利结果同样保留：`,...winners.slice(0,5).map(w=>`- ${w.id}（${w.scene}）：${w.better} 字段得分 ${p(w.baseline)}，NowPast ${p(w.NowPast)}。`),
``,`## 解释边界`,``,
`主数据由有限事件脚本生成，虽有独立世界、不同词组、班级与课程隔离，仍不是自由教师语言的分布外测试。重复问法在 datasetAudit 中统计，不当作独立语义覆盖；不按 50,000 问计算独立样本置信区间。`,
``,`自动条件只支持明确格式与明确旧编号引用的原文语法；unsupported 文体应待确认或进入模型。其与人工图同分不代表模型已经学会任意旧通知匹配。人工图的边由事件脚本给出，不存在实测人工标注工时；自动构图耗时单列，人工成本不能据此宣称为零。`,
``,`Vector/BM25 的 filtered 版本是看到首轮弱向量结果后追加的稳健性检查，非预登记主比较；它们按相同已知范围、课程、课次或作业和字段筛选。原始成绩未删。固定冻结集未用于调权或挑选最佳模型。`,
``,`引用逐字同源由受限输出结构保证，不能据此替代语义正确率；当前引用精确率是与独立正确证据比对的结果。检索上限高不保证弱模型生成同样正确，尤其历史材料可能干扰当前判断。组长仍需独立复核金标及非模板案例。`,``,`未使用 Qoder，本轮不登记其贡献。`];
writeFileSync(new URL('REPORT.md',root),lines.join('\n')+'\n');
console.log('report',new URL('REPORT.md',root).pathname,'model inputs',uniqueKeys.length);
