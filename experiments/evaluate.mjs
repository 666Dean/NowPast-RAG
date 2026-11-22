import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {methods,retrieve,automaticCorpus,retrievalMetrics,setMetrics} from './engine.mjs';
const root=new URL(process.env.NOWPAST_EXPERIMENT_DIR || './',import.meta.url),config=JSON.parse(readFileSync(new URL('config.json',root)));
const freeze=JSON.parse(readFileSync(new URL('freeze.json',root)));
const sha=x=>createHash('sha256').update(x).digest('hex');
mkdirSync(new URL('results/',root),{recursive:true});
const all=[],costs=[],failures=[];
for(const seed of config.seeds){
  const bytes=readFileSync(new URL(`data/seed-${seed}.json.gz`,root));
  if(sha(bytes)!==freeze.datasets.find(x=>x.seed===seed).sha256) throw Error('Frozen data changed');
  const data=JSON.parse(gunzipSync(bytes)),ranks=JSON.parse(gunzipSync(readFileSync(new URL(`results/ranks-${seed}.json.gz`,root))));
  if(ranks.datasetSha256!==sha(bytes)) throw Error('Retrieval source mismatch');
  const auto=automaticCorpus(data.docs),rows=[];
  for(let i=0;i<data.questions.length;i++){
    const q=data.questions[i];
    for(const method of methods){
      const r=retrieve(method,data.docs,q,ranks.rows[i],auto.docs,config);
      const row={id:q.id,seed,world:q.world,scene:q.scene,split:q.split,method,ids:r.docs.map(d=>d.id),ms:r.ms,characters:r.characters,...retrievalMetrics(r.docs,q)};
      rows.push(row);if(q.split==='test') all.push(row);
    }
  }
  writeFileSync(new URL(`results/retrieval-${seed}.json.gz`,root),gzipSync(JSON.stringify(rows)));
  costs.push({seed,notices:data.docs.length,testQuestions:data.questions.filter(q=>q.split==='test').length,
    embedding:ranks.embedding,bm25IndexSeconds:ranks.bm25IndexSeconds,indexBytes:ranks.indexBytes,autoParseMs:auto.ms,autoParsed:auto.docs.length,autoFailed:auto.failures.length});
  failures.push(...auto.failures.map(f=>({seed,...f})));
  console.log('evaluated',seed,rows.length,'auto failures',auto.failures.length);
}
function summarize(rows){return Object.fromEntries(['evidenceRecall','contextPrecision','oldLinkRecall','contextCount','ms','characters'].map(k=>[k,rows.reduce((s,r)=>s+r[k],0)/rows.length]));}
const summary=methods.map(method=>({method,n:all.filter(x=>x.method===method).length,...summarize(all.filter(x=>x.method===method))}));
const scenes=[...new Set(all.map(x=>x.scene))];
const byScene=scenes.flatMap(scene=>methods.map(method=>({scene,method,...summarize(all.filter(x=>x.scene===scene&&x.method===method))})));
// Scale curves keep exactly the same 200 questions from each seed: query worlds
// are always retained, and additional whole worlds provide the distractor scale.
const scaling=[];
for(const seed of config.seeds){
  const data=JSON.parse(gunzipSync(readFileSync(new URL(`data/seed-${seed}.json.gz`,root))));
  const scaleRanks=JSON.parse(gunzipSync(readFileSync(new URL(`results/scale-ranks-${seed}.json.gz`,root))));
  const auto=automaticCorpus(data.docs);
  const selected=data.questions.filter(q=>q.split==='test'&&q.world===`s${seed}-w10`);
  const order=[`s${seed}-w10`,...data.worlds.map(w=>w.id).filter(w=>w!==`s${seed}-w10`)];
  for(const worldCount of [...new Set([Math.min(12,order.length),Math.min(30,order.length),order.length])]){
    const worlds=new Set(order.slice(0,worldCount));
    const pool=new Set(data.docs.filter(d=>worlds.has(d.world || d.id.replace(/-n\d+$/,''))).map(d=>d.id));
    for(const method of methods){
      const scored=selected.map(q=>{
        const rank=scaleRanks.find(r=>r.worldCount===worldCount&&r.id===q.id);
        const r=retrieve(method,data.docs,q,rank,auto.docs,config);
        return {...retrievalMetrics(r.docs,q),ms:r.ms,characters:r.characters};
      });
      scaling.push({seed,worldCount,notices:pool.size,method,questions:selected.length,...summarize(scored)});
    }
  }
}
writeFileSync(new URL('results/scale-workloads.json',root),JSON.stringify(scaling));
const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),freezeSha256:sha(readFileSync(new URL('freeze.json',root))),summary,byScene,costs,autoFailures:failures};
writeFileSync(new URL('results/retrieval-summary.json',root),JSON.stringify(report,null,2));
writeFileSync(new URL('results/retrieval-summary.csv',root),'method,n,evidenceRecall,contextPrecision,oldLinkRecall,contextCount,ms,characters\n'+summary.map(x=>Object.values(x).join(',')).join('\n')+'\n');
console.log(summary);
