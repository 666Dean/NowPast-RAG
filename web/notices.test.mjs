import test from 'node:test';
import assert from 'node:assert/strict';
import {noticeSeed} from '../knowledge/notices.mjs';
import {executionFor,relationsFor} from './notice-relations.mjs';
import {validateDocument} from '../knowledge/schema.mjs';
import {analyzeNotice} from '../generation/notice.mjs';
const group=title=>noticeSeed.filter(doc=>doc.title===title);
const context={date:'2026-11-21',scope:'计科2班'};

test('school and teacher fixtures are valid and have no research notices',()=>{
  const all=[];for(const doc of noticeSeed){validateDocument(doc,all);all.push(doc);}
  assert.ok(all.every(doc=>['school','course','assignment'].includes(doc.noticeType)));
  assert.ok(all.every(doc=>!doc.title.includes('GNP')));
});
test('future lesson uses the known room adjustment while keeping the original lesson time',()=>{
  const records=group('数据库：11月27日上课安排');
  const before=executionFor(records,noticeSeed,{...context,date:'2026-11-20'});
  const after=executionFor(records,noticeSeed,context);
  assert.equal(before.where,'A301');assert.equal(after.where,'B204');
  assert.equal(after.date,'2026-11-27');assert.equal(after.time,'08:00–09:40');
  assert.equal(after.action,'上课');
});
test('a changed deadline is displayed with the supported submission action and place',()=>{
  const records=group('数据库：作业一截止时间调整');
  const current=executionFor(records,noticeSeed,context);
  assert.equal(current.when,'11月27日 18:00 前');
  assert.equal(current.where,'课程平台');assert.equal(current.action,'提交ER图设计作业');
  const prior=relationsFor(records,noticeSeed,context);
  assert.equal(prior[0].prior.title,'数据库：作业一提交要求');
  assert.equal(prior[0].prior.published,'2026-11-19');
});

test('only the replaced classroom appears beside the current arrangement',()=>{
  const current=executionFor(group('数据库：11月27日教室调整'),noticeSeed,context);
  assert.deepEqual(current.previous,{when:[],where:['A301'],action:[]});
  const before=executionFor(group('数据库：11月27日上课安排'),noticeSeed,{...context,date:'2026-11-20'});
  assert.deepEqual(before.previous,{when:[],where:[],action:[]});
});

test('old deadlines and service hours keep their date and action context',()=>{
  const assignment=executionFor(group('数据库：作业一截止时间调整'),noticeSeed,context);
  assert.deepEqual(assignment.previous,{when:['11月26日 18:00 前'],where:[],action:[]});
  const library=executionFor(group('图书馆：二层暂停开放时间调整'),noticeSeed,context);
  assert.equal(library.when,'11月22日 10:00–12:00');
  assert.deepEqual(library.previous,{when:['11月22日 09:00–12:00'],where:[],action:[]});
});

test('a later classroom change compares with its immediate predecessor',()=>{
  const predecessor=noticeSeed.find(doc=>doc.id==='DB-ROOM-NEW');
  const next={...predecessor,id:'DB-ROOM-LATEST',published:'2026-11-22',effective:'2026-11-22',value:'C305',supersedes:[predecessor.id]};
  const current=executionFor([next],[...noticeSeed,next],{...context,date:'2026-11-22'});
  assert.equal(current.where,'C305');
  assert.deepEqual(current.previous.where,['B204']);
});

test('parallel or unconfirmed requirements never mark a value as replaced',()=>{
  const original=noticeSeed.find(doc=>doc.id==='DB-ROOM');
  const parallel={...original,id:'DB-ROOM-PARALLEL',value:'C305',relations:[{id:original.id,kind:'parallel'}]};
  const current=executionFor([parallel],[original,parallel],context);
  assert.equal(current.where,'地点待确认');
  assert.deepEqual(current.previous.where,[]);
  const unchanged={...original,id:'DB-ROOM-SAME',supersedes:[original.id]};
  assert.deepEqual(executionFor([unchanged],[original,unchanged],context).previous.where,[]);
  const unknown={...unchanged,effective:'',analysis:{}};
  assert.equal(executionFor([unknown],[original,unknown],context).previous,undefined);
});
test('school-wide notices stay visible for another class without exposing class-specific links',()=>{
  const library=group('图书馆：二层暂停开放时间调整');
  const other={...context,scope:'计科1班'};
  assert.equal(executionFor(library,noticeSeed,other).where,'图书馆二层');
  assert.equal(relationsFor(library,noticeSeed,other)[0].prior.id,'LIB-OLD');
  assert.deepEqual(relationsFor(group('数据库：11月27日教室调整'),noticeSeed,other),[]);
});
test('a raw deadline notice needs no manually selected course, topic, value or predecessor',async()=>{
  const input={title:'数据库：作业一延期',published:'2026-11-21',scope:'计科2班',text:'即日起，计科2班数据库作业一截止时间由11月27日18:00顺延至11月28日18:00，替代此前的截止要求。仍在课程平台提交。'};
  const calls=[];
  const result=await analyzeNotice(noticeSeed,input,async request=>{
    calls.push(request);
    return {model:'transport-test',data:calls.length===1?{clauses:[{topic:'数据库·作业一截止时间',value:'11月28日18:00',quote:input.text,scope:'计科2班',effective:'2026-11-21'}]}:{kind:'replace',relatedIds:['DB-DUE-NEW']}};
  });
  assert.deepEqual(calls[0].input.valueCandidates,['11月28日18:00']);
  assert.deepEqual(calls[1].input.previous.map(doc=>doc.id),['DB-DUE-NEW']);
  const doc=result.clauses[0];assert.equal(doc.course,'数据库');assert.equal(doc.noticeType,'assignment');
  assert.equal(executionFor([doc],[...noticeSeed,doc],context).when,'11月28日 18:00 前');
});
