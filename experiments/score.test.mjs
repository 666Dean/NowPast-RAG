import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreGeneration} from './score.mjs';
const q={asOf:'2026-11-25',lessonDate:'2026-11-27',classId:'数媒3班',course:'交互',activityId:'交互-11月27日',fields:['room','time'],gold:[{id:'room',field:'room',value:'C302'},{id:'time',field:'time',value:'08:00–09:40'}],oldIds:[]};
const docs=q.gold.map(g=>({id:g.id,value:g.value,text:g.value,scope:q.classId,published:'2026-11-01',effective:'2026-11-01',imported:'2026-11-01',campus:{classId:q.classId,course:q.course,lessonDate:q.lessonDate,activityId:q.activityId,field:g.field}}));
test('a real room citation does not support a time claim',()=>{
  const s=scoreGeneration(q,docs,{answers:{room:['E1'],time:['E1']},previous:[]});
  assert.equal(s.fieldExact,.5);assert.equal(s.citationPrecision,.5);assert.equal(s.unsupportedStatementRate,.5);assert.equal(s.rangeError,1);
});
test('conflict preservation and missing evidence are scored independently',()=>{
  const other={...docs[0],id:'parallel',value:'D405',text:'D405'},question={...q,fields:['room','fee'],gold:[q.gold[0],{id:other.id,field:'room',value:other.value}]};
  const all=[docs[0],other];
  const correct=scoreGeneration(question,all,{answers:{room:['E1','E2'],fee:[]},previous:[]});
  assert.equal(correct.conflictRetention,1);assert.equal(correct.missingAbstention,1);
  const bad=scoreGeneration(question,all,{answers:{room:['E1'],fee:['E2']},previous:[]});
  assert.equal(bad.conflictRetention,0);assert.equal(bad.missingAbstention,0);
});
