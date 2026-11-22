import {setMetrics,match,visible} from './engine.mjs';
export function scoreGeneration(q,evidence,output,error){
  const chosen=q.fields.flatMap(field=>(output?.answers?.[field] || []).map(key=>({field,doc:evidence[Number(key.slice(1))-1]})));
  const current=chosen.filter(x=>x.doc),old=(output?.previous || []).map(key=>evidence[Number(key.slice(1))-1]).filter(Boolean);
  const fs=q.fields.map(field=>setMetrics(current.filter(x=>x.field===field).map(x=>x.doc.value),q.gold.filter(g=>g.field===field).map(g=>g.value)));
  const goldIds=q.gold.map(g=>g.field+'|'+g.id),ids=current.map(x=>x.field+'|'+x.doc.id);
  const missing=q.fields.filter(f=>!q.gold.some(g=>g.field===f));
  const conflicts=q.fields.filter(f=>q.gold.filter(g=>g.field===f).length>1);
  return {fieldExact:error?0:fs.reduce((a,x)=>a+x.exact,0)/fs.length,fieldF1:error?0:fs.reduce((a,x)=>a+x.f1,0)/fs.length,
    questionExact:Number(!error&&fs.every(x=>x.exact)),citationPrecision:error?0:setMetrics(ids,goldIds).precision,
    unsupportedStatementRate:current.length?current.filter(x=>!goldIds.includes(x.field+'|'+x.doc.id)).length/current.length:0,
    oldLinkExact:error?0:setMetrics(old.map(d=>d.id),q.oldIds).exact,
    temporalError:Number(!!error||current.some(x=>!visible(x.doc,q)||x.doc.effective>(q.lessonDate||q.asOf)||q.oldIds.includes(x.doc.id))),
    rangeError:Number(!!error||current.some(x=>!match(x.doc,q)||x.doc.campus.field!==x.field)),
    conflictRetention:conflicts.length?Number(!error&&conflicts.every(f=>setMetrics(current.filter(x=>x.field===f).map(x=>x.doc.id),q.gold.filter(g=>g.field===f).map(g=>g.id)).exact)):null,
    missingAbstention:missing.length?Number(!error&&missing.every(f=>!(output?.answers?.[f]||[]).length)):null,
    selected:current.map(x=>({field:x.field,id:x.doc.id,value:x.doc.value,quote:x.doc.excerpt || x.doc.text})),previous:old.map(d=>d.id)};
}
