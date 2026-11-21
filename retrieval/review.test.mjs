import test from 'node:test';
import assert from 'node:assert/strict';
import {answer} from '../qa/answer.mjs';
import {seed} from '../knowledge/data.mjs';
import {parseDates} from '../temporal/graph.mjs';
const query = text => answer(seed,text,{date:'2026-11-20',scope:'B组'});
const ids = (r,role) => [...new Set(r.sections.flatMap(s=>s.items).filter(i=>i.role===role).map(i=>i.doc.id))].sort();

test('slash interval preserves both dates and the conflict-to-clarification roles',()=>{
  const r=query('B组11/14-11/15的验收地点有变化吗？');
  assert.deepEqual(parseDates('11/14-11/15','2026-11-20'),['2026-11-14','2026-11-15']);
  assert.deepEqual(ids(r,'前一日期'),['R21','R22']);
  assert.deepEqual(ids(r,'后一日期'),['R30']);
});
test('same-month elided endpoint and A-group control',()=>{
  for(const range of ['11月8日至12日','11月8日到12号','2026-11-08至2026-11-12']) {
    const r=query(`B组${range}的融合方式有变化吗？`);
    assert.deepEqual(ids(r,'前一日期'),['F01']);
    assert.deepEqual(ids(r,'后一日期'),['B13']);
    const a=query(`A组${range}的融合方式有变化吗？`);
    assert.deepEqual(ids(a,'前一日期'),['F01']);
    assert.deepEqual(ids(a,'后一日期'),['F01']);
  }
});
test('parallel cost questions retain the known clause and a separate missing-cost section',()=>{
  for(const q of ['B组融合方式和设备费用各是什么？','B组融合方式及设备费用各是什么？','B组用什么融合方式，设备费用是多少？']) {
    const r=query(q);
    assert.ok(r.sections.some(s=>s.topic==='融合方式' && s.status==='ok' && s.items.some(i=>i.doc.id==='B13')));
    assert.ok(r.sections.some(s=>s.status==='unknown' && /费用/.test(s.summary)),q);
    assert.equal(r.status,'unknown');
  }
});
test('Hadamard element wording does not establish a monetary amount',()=>{
  for(const date of ['2026-11-08','2026-11-20']) {
    const r=answer(seed,'B组使用融合方式需要多少元？',{date,scope:'B组'});
    assert.equal(r.status,'unknown');
    assert.equal(r.items.length,0);
  }
});
test('explicit amount clause can answer a cost question',()=>{
  const cost={id:'COST',topic:'设备费用',value:'每组报销 20 元',title:'虚构费用通知',text:'设备费用每组报销 20 元。',
    published:'2026-11-01',effective:'2026-11-01',imported:'2026-11-01',scope:'全班',supersedes:[],aliases:['设备报销']};
  const r=answer([...seed,cost],'设备费用能报销多少元？',{date:'2026-11-20',scope:'B组'});
  assert.equal(r.status,'ok');
  assert.deepEqual(ids(r,'当前依据'),['COST']);
});
