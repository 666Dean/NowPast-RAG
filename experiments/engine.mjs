import {campusSnapshot} from '../temporal/campus.mjs';
import {canonicalNotices} from '../knowledge/notice-adapter.mjs';
import {parseGroundedNotice} from '../generation/source-records.mjs';
import {lexicalRank} from '../retrieval/rank.mjs';
export const methods=['Vector','BM25','Latest','NowPast','no-history','no-graph','NowPast-auto','Vector-filtered','BM25-filtered'];
export const match=(d,q)=>[q.classId,'全校','全班'].includes(d.scope) && d.campus.course===q.course &&
  (q.activityId?d.campus.activityId===q.activityId:d.campus.lessonDate===q.lessonDate) && q.fields.includes(d.campus.field);
export const visible=(d,q)=>d.published && d.published<=q.asOf && d.imported<=q.asOf;
export function automaticCorpus(docs){
  const parsed=[],failures=[],start=performance.now();
  for(const d of docs){
    try{
      const rows=parseGroundedNotice({title:d.title,text:d.text,published:d.published,imported:d.imported,scope:d.scope},parsed,d.id);
      if(!rows) {failures.push({id:d.id,error:'unsupported prose; pending confirmation'});continue;}
      parsed.push(...rows);
    } catch(error){failures.push({id:d.id,error:error.message});}
  }
  return {docs:canonicalNotices(parsed),failures,ms:performance.now()-start};
}
export function retrieve(method,docs,q,ranks,auto,config){
  const start=performance.now();let selected;
  if(['Vector','BM25','Vector-filtered','BM25-filtered'].includes(method)) selected=ranks[method].map(i=>docs[i]);
  else if(method==='Latest') selected=q.fields.flatMap(field=>docs.filter(d=>visible(d,q)&&match(d,q)&&d.campus.field===field&&d.effective<=(q.lessonDate||q.asOf))
    .sort((a,b)=>b.published.localeCompare(a.published)||b.id.localeCompare(a.id)).slice(0,1));
  else if(method==='no-graph') selected=lexicalRank(docs.filter(d=>visible(d,q)&&match(d,q)),q.question).map(x=>x.doc);
  else {
    const pool=method==='NowPast-auto'?auto:docs;
    const snaps=q.fields.map(field=>campusSnapshot(pool,q,field));
    const current=snaps.flatMap(s=>s.current),past=snaps.flatMap(s=>s.past);
    selected=[...lexicalRank(current,q.question).map(x=>x.doc),...(method==='no-history'?[]:lexicalRank(past,q.question).map(x=>x.doc))];
  }
  const result=[];let characters=0;
  for(const d of selected){
    if(result.length>=config.topK) break;
    if(result.some(x=>x.id===d.id)) continue;
    const cost=JSON.stringify(publicEvidence(d)).length;
    if(characters+cost>config.contextCharacters) break;
    characters+=cost;result.push(d);
  }
  return {docs:result,characters,ms:(ranks.ms?.[method] || 0)+performance.now()-start};
}
export function publicEvidence(d){
  return {id:d.id,title:d.title,text:d.text,value:d.value,published:d.published,effective:d.effective,imported:d.imported,
    classId:d.scope,...d.campus,supersedes:d.supersedes};
}
export function setMetrics(a,b){
  const aa=new Set(a),bb=new Set(b),hits=[...aa].filter(x=>bb.has(x)).length;
  return {exact:Number(aa.size===bb.size&&hits===bb.size),f1:aa.size+bb.size?2*hits/(aa.size+bb.size):1,
    precision:aa.size?hits/aa.size:bb.size?0:1,recall:bb.size?hits/bb.size:1};
}
export function retrievalMetrics(docs,q){
  const ids=docs.map(d=>d.id),gold=q.gold.map(g=>g.id),old=q.oldIds;
  return {evidenceRecall:setMetrics(ids,gold).recall,contextPrecision:setMetrics(ids,gold).precision,
    oldLinkRecall:setMetrics(ids,old).recall,contextCount:docs.length};
}
