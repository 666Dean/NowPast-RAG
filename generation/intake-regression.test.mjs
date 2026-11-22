import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeNotice,materializeNotice} from './notice.mjs';
import {noticeSeed} from '../knowledge/notices.mjs';
import {answer} from '../qa/answer.mjs';
import {campusSeed} from '../knowledge/campus-data.mjs';
import {noticeContext} from './notice-context.mjs';
const base={title:'新课程安排',published:'2026-11-25',scope:'数媒3班'};
test('a grounded deadline survives an incorrect model topic and uses mandatory single-clause shape',async()=>{
  const input={title:'数据库作业一延期',published:'2026-11-25',scope:'计科2班',text:'即日起，计科2班数据库作业一截止时间顺延至11月28日18:00。'};let n=0;
  const result=await analyzeNotice(noticeSeed,input,async request=>{
    if(++n===1){assert.equal(request.schema.properties.clauses.type,'object');return {model:'test',data:{clauses:{topic:'数据库·作业一提交地点',value:'11月28日18:00',quote:input.text,scope:input.scope,effective:input.published}}};}
    return {model:'test',data:{kind:'replace',relatedIds:['DB-DUE-NEW']}};
  });
  assert.equal(result.clauses[0].field,'deadline');assert.deepEqual(result.clauses[0].supersedes,['DB-DUE-NEW']);
});
test('unseen class and course, omitted month and separate lessons preserve source identities',()=>{
  const text='即日起，数媒3班《交互设计》11月27日教室为C302。数媒3班《交互设计》28日教室为D405。';
  const rows=[['C302',text.split('。')[0]+'。'],['D405',text.split('。')[1]+'。']].map(([value,quote])=>({topic:'交互设计·教室',value,quote,scope:base.scope,effective:'2026-11-25'}));
  const result=materializeNotice({...base,text},{clauses:rows},rows.map(()=>({kind:'new',relatedIds:[]})),'test',[]);
  assert.deepEqual(result.clauses.map(d=>d.lessonDate),['2026-11-27','2026-11-28']);
  const q={domain:'campus',asOf:base.published,classId:base.scope,course:'交互设计',lessonDate:'2026-11-28'};
  assert.deepEqual(answer(result.clauses,'在哪上',q).fields.room.values,['D405']);
});
test('a lesson cannot inherit the preceding homework deadline as its identity',()=>{
  const input={...base,course:'数据库',text:'数据库作业一于11月30日提交。数据库课教室改为D405。'};
  const c=noticeContext(input,{topic:'上课教室',value:'D405'},noticeSeed);
  assert.equal(c.noticeType,'course');assert.equal(c.lessonDate,undefined);assert.equal(c.assignment,undefined);
  const dated=noticeContext({...input,text:'自11月25日起，数据库11月27日教室改为D405。'},{topic:'上课教室',value:'D405'},noticeSeed);
  assert.equal(dated.lessonDate,'2026-11-27');
  for(const [text,day] of [['12月27日数据库课，自12月25日起教室改为D405。','2026-12-27'],['自12月25日起，数据库28日教室改为D405。','2026-12-28']]){
    assert.equal(noticeContext({...input,text},{topic:'上课教室',value:'D405'},noticeSeed).lessonDate,day);
  }
});
test('too many fallback requirements fail explicitly instead of silently returning six',async()=>{
  const text=Array.from({length:7},(_,i)=>`B组事项${i}改为材料${i}。`).join('');let called=false;
  await assert.rejects(()=>analyzeNotice([],{title:'虚构多事项',text,published:'2026-11-25',scope:'B组'},async()=>{called=true;}),/6 项要求/);
  assert.equal(called,false);
});
test('teacher intake can match an old campus record without changing its source ID',async()=>{
  const input={title:'数据库教室调整',course:'数据库',published:'2026-11-26',scope:'计科2班',text:'即日起，计科2班11月27日数据库课教室改为D405。'};
  let call=0;
  const result=await analyzeNotice(campusSeed,input,async req=>{
    if(++call===1) return {model:'test',data:{clauses:[{topic:'上课教室',value:'D405',quote:input.text,scope:input.scope,effective:input.published}]}};
    assert.deepEqual(req.input.previous.map(d=>d.id),['N25-room']);
    return {model:'test',data:{kind:'replace',relatedIds:['N25-room']}};
  });
  assert.deepEqual(result.clauses[0].supersedes,['N25-room']);
  const r=answer([...campusSeed,...result.clauses],'什么时候、在哪上',{domain:'campus',asOf:'2026-11-26',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'});
  assert.deepEqual(r.fields.room.values,['D405']);assert.deepEqual(r.fields.time.values,['08:00–09:40']);
});
test('same course does not license a cross-lesson or cross-assignment link',()=>{
  for(const [text,topic,value,id] of [
    ['即日起，计科2班数据库12月4日教室改为C302。','数据库·11月27日上课地点','C302','DB-ROOM-NEW'],
    ['即日起，计科2班数据库作业二截止改为11月28日18:00。','数据库·作业一截止时间','11月28日18:00','DB-DUE-NEW']]) {
    assert.throws(()=>materializeNotice({...base,scope:'计科2班',course:'数据库',text},{clauses:[{topic,value,quote:text,scope:'计科2班',effective:'2026-11-25'}]},[{kind:'replace',relatedIds:[id]}],'test',noticeSeed),/课次、作业/);
  }
});
test('unrelated is legal in comparison schema and does not retire a notice',async()=>{
  const text='即日起，计科2班数据库作业一截止时间是11月28日18:00。';
  let n=0;
  const r=await analyzeNotice(noticeSeed,{...base,scope:'计科2班',text},async req=>{
    n++;
    if(n===1) return {model:'test',data:{clauses:[{topic:'数据库·作业一截止时间',value:'11月28日18:00',quote:text,scope:'计科2班',effective:'2026-11-25'}]}};
    assert.equal(req.schema.properties.relatedIds.minItems,0);
    assert.ok(req.schema.properties.kind.enum.includes('new'));
    return {model:'test',data:{kind:'new',relatedIds:[]}};
  });
  assert.deepEqual(r.clauses[0].supersedes,[]);
});
test('a value copied from another source is rejected even if a plausible old notice exists',()=>{
  const text='计科2班数据库作业一截止时间暂未确定。';
  assert.throws(()=>materializeNotice({...base,scope:'计科2班',text},{clauses:[{topic:'截止',value:'11月28日18:00',quote:text,scope:'计科2班',effective:''}]},[{kind:'new',relatedIds:[]}],'test',noticeSeed),/原文核验/);
});
