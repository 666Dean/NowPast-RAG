import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {noticeSeed} from '../knowledge/notices.mjs';
import {campusSeed,campusConflictSeed,campusClarifiedSeed} from '../knowledge/campus-data.mjs';
const child=spawn(process.execPath,['service/server.mjs'],{env:{...process.env,PORT:'4195'},stdio:['ignore','pipe','inherit']});
const base={domain:'campus',asOf:'2026-11-25',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库',question:'什么时候、在哪上？',docs:noticeSeed};
const cases=[
  {name:'teacher-lesson-room-and-time',path:'/api/query',request:base},
  {name:'before-publication',path:'/api/query',request:{...base,asOf:'2026-11-24',docs:campusSeed}},
  {name:'after-publication',path:'/api/query',request:{...base,docs:campusSeed}},
  {name:'other-class',path:'/api/query',request:{...base,classId:'计科1班',docs:campusSeed}},
  {name:'next-lesson',path:'/api/query',request:{...base,lessonDate:'2026-12-04',docs:campusSeed}},
  {name:'conflict-and-missing-query',path:'/api/query',request:{...base,asOf:'2026-11-26',question:'教室在哪，要交多少钱？',docs:campusConflictSeed}},
  {name:'conflict-and-missing-generate',path:'/api/generate',request:{...base,asOf:'2026-11-26',question:'教室在哪，要交多少钱？',docs:campusConflictSeed}},
  {name:'clarification',path:'/api/query',request:{...base,asOf:'2026-11-26',docs:campusClarifiedSeed}},
  {name:'homework-keeps-task-and-channel',path:'/api/query',request:{...base,lessonDate:undefined,activityId:'数据库-作业一',fields:['task','channel','deadline'],question:'作业交什么、什么时候交、交到哪里？'}},
  {name:'school-wide',path:'/api/query',request:{...base,asOf:'2026-11-21',lessonDate:'2026-11-22',classId:'数媒3班',course:'校务公告',fields:['service'],question:'图书馆暂停开放时段？'}},
  {name:'new-class-complete-raw-notice',path:'/api/notices/analyze',request:{title:'虚构交互设计课程安排',published:'2026-11-25',scope:'数媒3班',text:'数媒3班《交互设计》2026-11-27课程，自2026-11-25起教室安排为C302。数媒3班《交互设计》2026-11-27课程，自2026-11-25起上课时间安排为10:00–11:40。',docs:noticeSeed}}
];
try{
  await once(child.stdout,'data');const results=[];
  for(const c of cases){
    const response=await fetch('http://127.0.0.1:4195'+c.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c.request)});
    results.push({...c,status:response.status,response:await response.json()});
  }
  const get=name=>results.find(r=>r.name===name);
  for(const row of results) assert.equal(row.status,row.name==='conflict-and-missing-generate'?422:200,row.name);
  for(const name of ['teacher-lesson-room-and-time','after-publication']) {
    assert.deepEqual(get(name).response.fields.room.values,['B204']);
    assert.deepEqual(get(name).response.fields.time.values,['08:00–09:40']);
  }
  for(const name of ['before-publication','other-class','next-lesson']) assert.deepEqual(get(name).response.fields.room.values,['A301']);
  assert.equal(get('conflict-and-missing-query').response.fields.room.status,'conflict');
  assert.equal(get('conflict-and-missing-query').response.fields.fee.status,'unknown');
  assert.deepEqual(get('homework-keeps-task-and-channel').response.fields.channel.values,['课程平台']);
  assert.deepEqual(get('new-class-complete-raw-notice').response.clauses.map(d=>d.field),['room','time']);
  writeFileSync('service/validation/local-integration-api.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fictional:true,cases:results},null,2));
  console.log(results.map(r=>({name:r.name,status:r.status,result:r.response.status,fields:r.response.fields || r.response.clauses?.map(c=>({field:c.field,value:c.value}))})));
}finally{child.kill();await once(child,'exit');}
