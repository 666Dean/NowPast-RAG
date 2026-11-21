import {parseDates,snapshot} from '../temporal/graph.mjs';
import {validDay} from '../knowledge/schema.mjs';
const labels={replace:'更新自',clarify:'澄清了',parallel:'并行关联',same:'沿用自'};
export function executionFor(records,all,{date,scope}) {
  const sample=records.find(doc=>doc.field==='deadline') || records[0];
  if (!sample) return {when:'时间待确认',where:'地点待确认',action:'事项待确认'};
  const visible=all.filter(doc=>doc.published && doc.published<=date);
  const horizon=sample.lessonDate && sample.lessonDate>date?sample.lessonDate:date;
  const same=visible.filter(doc=>sample.activity?doc.activity===sample.activity:records.some(record=>record.id===doc.id));
  const field=name=>{
    const topics=[...new Set(same.filter(doc=>doc.field===name).map(doc=>doc.topic))];
    const current=[...new Map(topics.flatMap(topic=>snapshot(visible,horizon,scope==='全校'?sample.scope:scope,topic).current).map(doc=>[doc.id,doc])).values()];
    return {doc:current[0],conflict:new Set(current.map(doc=>doc.value)).size>1};
  };
  const deadline=field('deadline'),room=field('room'),time=field('time'),channel=field('channel'),task=field('task');
  const event=sample.event || {};
  let day=sample.lessonDate || event.date;
  let hour=time.conflict?'':time.doc?.value || event.time;
  if (deadline.doc) {
    day=deadline.conflict?null:parseDates(deadline.doc.value,date).find(validDay);
    hour=deadline.conflict?'':deadline.doc.value.match(/\d{1,2}[:：]\d{2}/)?.[0];
  }
  const where=room.conflict?'地点待确认':room.doc?.value || channel.doc?.value || event.place || '地点待确认';
  const when=day && hour?`${day.slice(5).replace('-','月')}日 ${hour}${sample.noticeType==='assignment'?' 前':''}`:'时间待确认';
  const action=task.conflict?'作业要求待确认':task.doc?.event?.action || task.doc?.value || event.action || (sample.noticeType==='course'?'上课':sample.noticeType==='assignment'?'提交作业':sample.value);
  if (sample.analysis && !sample.effective) return {when:'时间待确认',where:sample.field==='room'?sample.value:where,action,
    course:sample.course || '',type:sample.noticeType,activity:sample.activity || sample.id,conflict:true};
  return {date:day,time:hour,when,where,action,conflict:deadline.conflict||room.conflict||time.conflict||task.conflict,
    course:sample.course || '',type:sample.noticeType,activity:sample.activity || sample.id};
}
export function relationsFor(records,all,{date,scope}) {
  const allowed=doc=>(doc.published ? doc.published<=date : doc.imported<=date) &&
    (['全班','全校'].includes(scope) || ['全班','全校'].includes(doc.scope) || doc.scope===scope);
  const byId=new Map(all.filter(allowed).map(doc=>[doc.id,doc]));
  const result=[];
  const seen=new Set();
  for (const doc of records.filter(allowed)) {
    const edges=new Map((doc.relations || []).map(relation=>[relation.id,relation.kind]));
    for (const id of doc.supersedes) if (!edges.has(id)) edges.set(id,doc.supersedes.length>1?'clarify':'replace');
    for (const [id,kind] of edges) {
      const prior=byId.get(id);
      const key=doc.id+'|'+id;
      if (!prior || seen.has(key)) continue;
      seen.add(key);
      result.push({doc,prior,kind,label:labels[kind] || '关联自',direction:'previous'});
    }
  }
  if (!result.length) {
    const ids=new Set(records.map(doc=>doc.id));
    for (const next of byId.values()) {
      for (const id of next.supersedes) if (ids.has(id)) result.push({doc:next,prior:byId.get(id),kind:'replace',label:'后续更新',direction:'next'});
    }
  }
  return result;
}
