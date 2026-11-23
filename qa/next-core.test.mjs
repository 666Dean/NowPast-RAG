import test from 'node:test';import assert from 'node:assert/strict';
import {answer} from './answer.mjs';
const query={domain:'campus',course:'数据库',classId:'计科2班',lessonDate:'2026-11-27',asOf:'2026-11-25',fields:['room','time']};
function doc(id,field,value,extra={}){return {kind:'campus',id,topic:'数据库-'+field,title:'虚构课程通知',text:`计科2班11月27日数据库课${value}`,value,scope:'计科2班',published:'2026-11-01',effective:'2026-11-01',imported:'2026-11-01',supersedes:[],aliases:[],source:{type:'fictional',locator:id},campus:{course:'数据库',classId:'计科2班',lessonDate:'2026-11-27',field},...extra};}
const a=doc('a','room','A101'),t=doc('t','time','08:00—09:40'),b=doc('b','room','B204',{published:'2026-11-25',effective:'2026-11-26',imported:'2026-11-25',supersedes:['a']});
test('independent publication/effect/lesson/import clocks and two-time reconstruction',()=>{
  const r=answer([a,t,b],'24日和25日分别怎么安排？',{...query,asOf:'2026-11-24',compareAsOf:'2026-11-25'});
  assert.deepEqual(r.comparison.snapshots.map(s=>s.fields.room.values),[['A101'],['B204']]);
  assert.deepEqual(r.fields.time.values,['08:00—09:40']);
  assert.deepEqual(answer([a,t,{...b,imported:'2026-11-26'}],'在哪上',query).fields.room.values,['A101']);
  assert.ok(!answer([a,t,{...b,effective:'',imported:'2026-11-26'}],'在哪上',query).items.some(i=>i.doc.id==='b'));
  assert.equal(answer([a,t,b],'在哪里',{...query,lessonDate:'2026-12-04'}).status,'unknown');
});
test('same value sources are not a conflict; separate fee remains missing',()=>{
  const r=answer([a,t,b,{...b,id:'c'}],'教室在哪，要交多少钱？',{...query,fields:['room','fee']});
  assert.equal(r.fields.room.status,'ok');assert.equal(r.fields.room.evidence.filter(x=>x.role==='当前依据').length,2);assert.equal(r.fields.fee.status,'unknown');
  const conflict=answer([a,t,b,{...b,id:'d',value:'C301',text:'计科2班11月27日数据库课C301'}],'教室费用', {...query,fields:['room','fee']});
  assert.equal(conflict.fields.room.status,'conflict');assert.equal(conflict.fields.fee.status,'unknown');
  const clear={...b,id:'clear',published:'2026-11-26',imported:'2026-11-26',supersedes:['b','d']};
  assert.deepEqual(answer([a,t,b,{...b,id:'d',value:'C301',text:'C301'},clear],'教室',{...query,asOf:'2026-11-26'}).fields.room.values,['B204']);
});
test('missing parents, cycles, and cross-identity edges produce explicit pending errors',()=>{
  for(const docs of [[{...b,supersedes:['missing']}],[{...a,supersedes:['b']},b],[{...a,campus:{...a.campus,classId:'计科1班'}},b]]){
    const r=answer(docs,'教室',query);assert.equal(r.fields.room.status,'unknown');assert.ok(r.sections[0].validationErrors.length);
  }
});
test('explicit cancellation withdraws the current value without discarding history',()=>{
  const cancel=doc('cancel','room','取消',{operation:'cancel',published:'2026-11-25',imported:'2026-11-25',supersedes:['a']});
  const r=answer([a,t,cancel],'教室',query);assert.equal(r.fields.room.status,'unknown');assert.ok(r.items.some(i=>i.doc.id==='a'&&i.role==='已被替代'));assert.ok(r.items.some(i=>i.role==='撤销依据'));
});
