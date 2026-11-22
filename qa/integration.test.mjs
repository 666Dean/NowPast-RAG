import test from 'node:test';
import assert from 'node:assert/strict';
import {answer} from './answer.mjs';
import {campusSeed,campusConflictSeed} from '../knowledge/campus-data.mjs';
import {generate,closeModel} from '../generation/model.mjs';
import {noticeSeed} from '../knowledge/notices.mjs';
const options={domain:'campus',asOf:'2026-11-25',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'};

test('when and what time both request the timetable time field',()=>{
  for(const question of ['2班周五数据库课什么时候、在哪上？','2班周五数据库课几点、在哪上？']) {
    const r=answer(campusSeed,question,options);
    assert.deepEqual(r.fields.time?.values,['08:00–09:40']);
    assert.deepEqual(r.fields.room?.values,['B204']);
  }
});
test('school clock queries use the effective service source and never revive a withdrawn clock',()=>{
  const q={domain:'campus',asOf:'2026-11-21',lessonDate:'2026-11-22',classId:'数媒3班',course:'校务公告'};
  const r=answer(noticeSeed,'图书馆几点暂停开放？',q);
  assert.deepEqual(r.fields.time.values,['10:00–12:00']);
  assert.equal(r.fields.time.evidence[0].doc.id,'LIB-NEW');
  const base=noticeSeed.find(d=>d.id==='LIB-NEW'),pending={...base,id:'LIB-PENDING',published:'2026-11-22',effective:'2026-11-22',text:'图书馆二层暂停开放，具体时段待确认。',value:'暂停开放',excerpt:'图书馆二层暂停开放，具体时段待确认。',supersedes:[base.id]};
  assert.equal(answer([...noticeSeed,pending],'图书馆几点暂停开放？',{...q,asOf:'2026-11-22'}).fields.time.status,'unknown');
});
test('leader notices and campus API share lesson and assignment identities',()=>{
  const r=answer(noticeSeed,'什么时候、在哪上？',options);
  assert.deepEqual(r.fields.room?.values,['B204']);
  assert.deepEqual(r.fields.time?.values,['08:00–09:40']);
  const hw=answer(noticeSeed,'作业交什么、什么时候交、交到哪里？',{...options,activityId:'数据库-作业一',lessonDate:undefined,fields:['task','deadline','channel']});
  assert.deepEqual(hw.fields.deadline?.values,['11月27日18:00']);
  assert.deepEqual(hw.fields.task?.values,['完成ER图设计']);
  assert.deepEqual(hw.fields.channel?.values,['课程平台']);
  const other=answer(noticeSeed,'在哪上？',{...options,lessonDate:'2026-12-04'});
  assert.equal(other.status,'unknown');
});
test('a conflicting room cannot conceal an unsupported fee at the model boundary',async()=>{
  const r=answer(campusConflictSeed,'教室在哪，要交多少钱？',{...options,asOf:'2026-11-26'});
  assert.equal(r.fields.room.status,'conflict');
  assert.equal(r.fields.fee.status,'unknown');
  try {await assert.rejects(()=>generate(r,'教室在哪，要交多少钱？'),/证据不足/);}
  finally {closeModel();}
});
