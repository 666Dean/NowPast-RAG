import test from 'node:test';
import assert from 'node:assert/strict';
import {answer} from './answer.mjs';
import {seed} from '../knowledge/data.mjs';
import {campusSeed,campusConflictSeed,campusClarifiedSeed,campusAdjustment} from '../knowledge/campus-data.mjs';
import {validateDocument} from '../knowledge/schema.mjs';

const options={domain:'campus',asOf:'2026-11-25',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'};
const query=(docs=campusSeed,extra={},question='2班周五数据库课几点、在哪上？')=>answer(docs,question,{...options,...extra});
const field=(result,name,ids,values,status='ok')=>{
  assert.equal(result.fields[name].status,status);
  assert.deepEqual(result.fields[name].values,values);
  assert.deepEqual(result.fields[name].evidence.filter(i=>['当前依据','冲突依据'].includes(i.role)).map(i=>i.doc.id).sort(),ids.sort());
};

test('before publication both requested fields cite the original timetable',()=>{
  const r=query(campusSeed,{asOf:'2026-11-24'});
  field(r,'room',['S2-2026-11-27-room'],['A301']);
  field(r,'time',['S2-2026-11-27-time'],['08:00–09:40']);
  assert.ok(!r.items.some(item=>item.doc.id==='N25-room'));
});
test('published adjustment applies to the future lesson and only overrides the room',()=>{
  const r=query();
  assert.equal(r.asOf,'2026-11-25');
  assert.equal(r.lessonDate,'2026-11-27');
  field(r,'room',['N25-room'],['B204']);
  field(r,'time',['S2-2026-11-27-time'],['08:00–09:40']);
  assert.ok(r.fields.room.evidence.some(item=>item.doc.id==='S2-2026-11-27-room' && item.role==='已被替代'));
});
test('another class is isolated',()=>{
  const r=query(campusSeed,{classId:'计科1班'});
  field(r,'room',['S1-2026-11-27-room'],['A301']);
  field(r,'time',['S1-2026-11-27-time'],['08:00–09:40']);
});
test('one-off adjustment does not affect next week',()=>{
  const r=query(campusSeed,{lessonDate:'2026-12-04'});
  field(r,'room',['S2-2026-12-04-room'],['A301']);
  field(r,'time',['S2-2026-12-04-time'],['08:00–09:40']);
});
test('both current notices remain visible until explicit clarification',()=>{
  const r=query(campusConflictSeed,{asOf:'2026-11-26'});
  assert.equal(r.status,'conflict');
  field(r,'room',['N25-room','N26-room'],['B204','C105'],'conflict');
  for(const id of ['N25-room','N26-room']) assert.ok(r.summary.includes(campusConflictSeed.find(doc=>doc.id===id).text));
  field(r,'time',['S2-2026-11-27-time'],['08:00–09:40']);
  const clarified=query(campusClarifiedSeed,{asOf:'2026-11-26'});
  field(clarified,'room',['N26-clear'],['B204']);
  field(clarified,'time',['S2-2026-11-27-time'],['08:00–09:40']);
});
test('fees are marked missing alongside known fields and on their own',()=>{
  const r=query(campusSeed,{},'数据库课几点、在哪上，要交多少钱？');
  assert.equal(r.status,'unknown');
  field(r,'room',['N25-room'],['B204']);
  field(r,'fee',[],[],'unknown');
  assert.ok(r.summary.includes('费用缺少'));
  const only=query(campusSeed,{},'要交多少钱？');
  assert.equal(only.status,'unknown');
  assert.equal(only.items.length,0);
});
test('contact is returned only when independently supported by a source clause',()=>{
  field(query(campusSeed,{},'联系谁？'),'contact',[],[],'unknown');
  field(query(campusConflictSeed,{asOf:'2026-11-26'},'联系谁？'),'contact',['N26-contact'],['教务值班室']);
});
test('date metadata is required, calendar validity is checked, and missing publication cannot decide',()=>{
  assert.equal(query(campusSeed,{lessonDate:undefined}).status,'unknown');
  assert.equal(query(campusSeed,{asOf:'2026-11-31'}).status,'unknown');
  const draft={...campusAdjustment,id:'DRAFT',published:'',imported:'2026-11-25'};
  const r=query([draft],{fields:['room']});
  field(r,'room',[],[],'unknown');
  assert.equal(r.items[0].role,'时间待核');
});
test('campus schema requires origin and rejects cross-field or cross-class replacement',()=>{
  const validated=[];
  for(const doc of campusClarifiedSeed) {validateDocument(doc,validated);validated.push(doc);}
  for(const supersedes of [['S2-2026-11-27-time'],['S1-2026-11-27-room'],['S2-2026-12-04-room']]) {
    assert.throws(()=>validateDocument({...campusAdjustment,id:'BAD',supersedes},validated));
  }
  assert.throws(()=>validateDocument({...campusAdjustment,id:'BAD',source:undefined},validated));
  assert.throws(()=>validateDocument({...campusAdjustment,id:'BAD',source:{type:'public',locator:'第1段'}},validated));
});
test('legacy GNP calls and fixtures remain valid alongside campus data',()=>{
  const baseline=answer(seed,'融合方式',{date:'2026-11-20',scope:'B组'});
  assert.deepEqual(answer([...seed,...campusSeed],'融合方式',{date:'2026-11-20',scope:'B组'}),baseline);
  const validated=[];
  for(const doc of seed) {validateDocument(doc,validated);validated.push(doc);}
});
