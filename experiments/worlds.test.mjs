import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {parseGroundedNotice} from '../generation/source-records.mjs';
import {answer} from '../qa/answer.mjs';
import {canonicalNotices} from '../knowledge/notice-adapter.mjs';
test('source grammar retains untouched time and refuses cross-lesson old references',()=>{
  const input={title:'虚构初始课表',scope:'星河3班',published:'2026-11-01',text:'星河3班《交互系统》2026-11-27课程，自2026-11-01起教室安排为A301。'};
  const room=parseGroundedNotice(input,[],'old');
  const time=parseGroundedNotice({...input,text:input.text.replace('教室安排为A301','上课时间安排为08:00–09:40')},room,'time');
  const text='星河3班《交互系统》2026-11-27课程，自2026-11-25起教室改至B204；替代旧安排【old】。';
  const changed=parseGroundedNotice({...input,published:'2026-11-25',text},[...room,...time],'new');
  const r=answer([...room,...time,...changed],'什么时候、在哪上',{domain:'campus',asOf:'2026-11-25',lessonDate:'2026-11-27',classId:input.scope,course:'交互系统'});
  assert.deepEqual(r.fields.room.values,['B204']);assert.deepEqual(r.fields.time.values,['08:00–09:40']);
  assert.throws(()=>parseGroundedNotice({...input,published:'2026-11-25',text:text.replace('2026-11-27','2026-12-04')},room,'bad'),/课次或作业/);
});
test('late import does not travel backwards into the known document set',()=>{
  const d={kind:'campus',id:'late',title:'虚构',text:'A301',value:'A301',scope:'数媒3班',published:'2026-11-01',effective:'2026-11-01',imported:'2026-11-25',supersedes:[],campus:{classId:'数媒3班',course:'交互',lessonDate:'2026-11-27',field:'room'}};
  const opts={domain:'campus',asOf:'2026-11-24',lessonDate:'2026-11-27',classId:d.scope,course:'交互'};
  assert.equal(answer([d],'在哪上',opts).status,'unknown');
  assert.equal(answer([d],'在哪上',{...opts,asOf:'2026-11-25'}).status,'ok');
});
test('gold generator has no dependency on the engine under test',()=>{
  const source=readFileSync(new URL('./generate.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from\s+['"][^'"]*(?:qa|retrieval|temporal)\//);
  assert.doesNotMatch(source,/\b(?:answer|snapshot)\s*\(/);
});
