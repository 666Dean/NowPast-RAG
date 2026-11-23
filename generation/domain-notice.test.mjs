import test from 'node:test';import assert from 'node:assert/strict';import {analyzeDomainNotice} from './domain-notice.mjs';
import {analyzeNotice} from './notice.mjs';
const text=Array.from({length:7},(_,i)=>`数媒3班《交互设计》11月${i+20}日教室改为C${i+101}。`).join('');
const input={title:'虚构多课次通知',text,published:'2026-11-19',scope:'数媒3班'};
const clauses=Array.from({length:7},(_,i)=>({identity:{course:'交互设计',classId:'数媒3班',lessonDate:`2026-11-${i+20}`,activityId:''},field:'room',value:`C${i+101}`,quote:text.split('。')[i]+'。',effective:`2026-11-${i+20}`,published:input.published,imported:input.published,operation:''}));
test('v2 complete notice is atomic across seven unseen lessons',async()=>{
  const r=await analyzeDomainNotice([],input,async()=>({model:'test',data:{clauses,pending:false}}));assert.equal(r.clauses.length,7);assert.equal(new Set(r.clauses.map(d=>d.activity)).size,7);
});
test('the public intake entry dispatches v2 before legacy extraction and materialization',async()=>{
  const old=process.env.NOWPAST_INTAKE_V2;process.env.NOWPAST_INTAKE_V2='1';let calls=0;
  try{const r=await analyzeNotice([],input,async request=>{calls++;assert.equal(request.input.task,'extract');return {model:'test',data:{clauses,pending:false}};});assert.equal(r.clauses.length,7);assert.equal(calls,1);}
  finally{if(old===undefined)delete process.env.NOWPAST_INTAKE_V2;else process.env.NOWPAST_INTAKE_V2=old;}
});
test('six of seven is rejected, and copied values or invented identities never publish',async()=>{
  for(const cs of [clauses.slice(0,6),[{...clauses[0],value:'X999'}], [{...clauses[0],identity:{...clauses[0].identity,course:'未提供课程'}}]]){
    await assert.rejects(()=>analyzeDomainNotice([],input,async()=>({model:'test',data:{clauses:cs,pending:false}})));
  }
});
test('domain hints do not turn an effective date into an unstated lesson date',async()=>{
 let inspected=false;
 await assert.rejects(()=>analyzeDomainNotice([],{title:'虚构调整',scope:'数媒3班',published:'2026-11-19',text:'自11月26日起，数媒3班《交互设计》课教室调整为C302。'},async request=>{
  inspected=true;assert.equal(request.input.defaultIdentity.lessonDate,undefined);assert.equal(request.input.defaultIdentity.course,'交互设计');assert.equal(request.schema.oneOf[0].properties.clauses.maxItems,80);assert.equal(request.schema.type,undefined);
  return {model:'test',data:{pending:true,clauses:[]}};
 }),/尚未完整理解/);assert.ok(inspected);
});
test('duplicating one changed value cannot satisfy two different explicit changes',async()=>{
 const text='即日起，数媒3班《交互设计》11月27日教室改为C302。数媒3班《交互设计》11月27日上课时间改为10:00–11:40。';
 const c={...clauses[0],value:'C302',quote:text,identity:{...clauses[0].identity,lessonDate:'2026-11-27'},effective:'2026-11-25'};
 await assert.rejects(()=>analyzeDomainNotice([],{...input,published:'2026-11-25',text},async request=>{
  assert.equal(request.schema.oneOf[0].properties.clauses.minItems,2);
  assert.ok(!request.schema.oneOf[0].properties.clauses.items.properties.operation.enum.includes('cancel'));
  return {model:'test',data:{clauses:[c,c],pending:false}};
 }),/未处理完整/);
});
test('a real room quotation cannot be published as a fee',async()=>{
 const text='即日起，数媒3班《交互设计》11月27日教室改为C302。';
 await assert.rejects(()=>analyzeDomainNotice([],{...input,text,published:'2026-11-25'},async()=>({model:'test',data:{pending:false,clauses:[{...clauses[0],field:'fee',value:'C302',quote:text,identity:{...clauses[0].identity,lessonDate:'2026-11-27'},effective:'2026-11-25'}]}})),/字段归属/);
});
test('dates present elsewhere in a notice do not authorize swapping lesson identities',async()=>{
 const bad=clauses.map((c,i)=>({...c,identity:{...c.identity,lessonDate:clauses[(i+1)%clauses.length].identity.lessonDate}}));
 await assert.rejects(()=>analyzeDomainNotice([],input,async()=>({model:'test',data:{pending:false,clauses:bad}})),/引用.*课次|课次.*引用/);
});
test('a course and class elsewhere in the same source cannot authorize another quotation',async()=>{
 const text='数媒3班《交互设计》11月27日教室改为C302。计科2班《数据库》11月28日教室改为D405。';
 const cs=[
  {...clauses[0],quote:text.split('。')[0]+'。',value:'C302',effective:'2026-11-27',identity:{course:'数据库',classId:'计科2班',lessonDate:'2026-11-27',activityId:'2026-11-27'}},
  {...clauses[1],quote:text.split('。')[1]+'。',value:'D405',effective:'2026-11-28',identity:{course:'交互设计',classId:'数媒3班',lessonDate:'2026-11-28',activityId:'2026-11-28'}}
 ];
 await assert.rejects(()=>analyzeDomainNotice([],{...input,text},async()=>({model:'test',data:{pending:false,clauses:cs}})),/引用.*课程|课程.*引用|引用.*班级/);
});
test('different activity strings cannot disguise duplicates of one actual lesson',async()=>{
 const text='数媒3班《交互设计》11月27日教室改为C302。';
 const c={...clauses[0],quote:text,value:'C302',effective:'',identity:{course:'交互设计',classId:'数媒3班',lessonDate:'2026-11-27',activityId:'2026-11-27'}};
 const copy={...c,identity:{...c.identity,activityId:'伪装的不同课次'}};
 await assert.rejects(()=>analyzeDomainNotice([],{...input,text},async()=>({model:'test',data:{pending:false,clauses:[c,copy]}})),/重复条款/);
});
test('a confident model cannot publish an explicitly unconfirmed rumor',async()=>{
 const text='同学说数媒3班《交互设计》11月27日教室改为C302，是否属实待确认。';
 const c={...clauses[0],quote:text,value:'C302',effective:'',identity:{course:'交互设计',classId:'数媒3班',lessonDate:'2026-11-27',activityId:'2026-11-27'}};
 await assert.rejects(()=>analyzeDomainNotice([],{...input,text},async()=>({model:'test',data:{pending:false,clauses:[c]}})),/传闻|待确认/);
});
