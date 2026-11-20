import test from 'node:test';
import assert from 'node:assert/strict';
import {answer} from '../qa/answer.mjs';
import {seed} from '../knowledge/data.mjs';
import {validateDocument} from '../knowledge/schema.mjs';
import {archive} from '../evaluation/cases.mjs';

const current = r => [...new Set(r.sections.flatMap(s=>s.items)
  .filter(i=>['当前依据','冲突依据','后一日期'].includes(i.role)).map(i=>i.doc.id))].sort();
function check(docs, question, gold, options = {}) {
  const r = answer(docs,question,{date:'2026-11-20',scope:'B组',...options});
  assert.deepEqual(current(r), [...gold].sort(),question);
  return r;
}

test('date spellings select snapshots without adding deadline evidence', () => {
  for (const date of ['11月6日与11月10日','2026年11月6号和2026年11月10号','2026-11-06、2026-11-10','11/6，11/10']) {
    const r = check(seed,date+'，A组的消息聚合与融合算子有什么变化？',['F01','G01']);
    assert.equal(r.date,'2026-11-10');
    assert.ok(r.items.every(i=>['F01','G01'].includes(i.doc.id)));
  }
  check(seed,'11月6日和11月10日，B组该如何融合、如何聚合？',['B13','B14']);
  check(seed,'11月6日和11月10日截止时间有变化吗？',['M05'],{scope:'A组'});
  assert.equal(check(seed,'11月6日和11月10日',[]).status,'unknown');
});

test('new colloquial naming and storage questions preserve competing sources', () => {
  for (const q of ['交接的盒子现在叫什么？','那个盒子后来叫啥了？','小组移交的匣子如今怎么称呼？']) check(archive,q,['X03']);
  for (const q of ['硬盘放哪个格子？','磁盘应该放在哪个柜子？','存储介质放在哪个格子？']) {
    assert.equal(check(archive,q,['X04','X05']).status,'conflict');
  }
});

test('same vocabulary applies to an independently constructed corpus', () => {
  const doc = (id,topic,value,text,supersedes=[]) => ({id,topic,value,text,supersedes,
    title:'器材保管规范',scope:'全班',published:'2026-11-01',effective:'2026-11-01',imported:'2026-11-01',aliases:[]});
  const docs = [doc('A','采样盒名称','晨星盒','采样介质盒原名晨星盒。'),
    doc('B','采样盒名称','远航盒','采样盒改名远航盒。',['A']),
    doc('C','保管柜号','丙柜 21','光盘交到丙柜 21。'),
    doc('D','保存期限','两个月','原始记录保留两个月。')];
  check(docs,'采样盒子现在叫啥？',['B']);
  check(docs,'磁盘应该放在哪个格子？',['C']);
  check(docs,'晨星盒还叫这个名字吗？',['B']);
});

test('expansion abstains on unsupported intent and unknown subjects', () => {
  for (const q of ['这个盒子能报销多少元？','硬盘费用多少钱？','这本书叫什么？','格子可容纳几人？','这台打印机多少分？']) {
    assert.equal(check(archive,q,[]).status,'unknown',q);
  }
  const r = check(archive,'硬盘放哪个格子，采购能报销多少元？',['X04','X05']);
  assert.ok(r.sections.some(s=>s.status==='unknown' && s.summary.includes('报销')));
});

test('publication, effect, import and scope boundaries remain separate', () => {
  const before=check(seed,'融合方式',['F01'],{date:'2026-11-08'});
  assert.ok(before.items.some(i=>i.doc.id==='B13' && i.role==='已公布待生效'));
  check(seed,'融合方式',['B13'],{date:'2026-11-12'});
  check(seed,'融合方式',['F01'],{date:'2026-11-12',scope:'A组'});
  assert.equal(check(seed,'验收地点',['R21','R22'],{date:'2026-11-14'}).status,'conflict');
  check(seed,'验收地点',['R30'],{date:'2026-11-15'});
  for (const date of ['2026-11-14','2026-11-15']) check(seed,'验收地点',['M03'],{date,scope:'A组'});
  const update = {id:'DEV-NOTICE',title:'补充通知',topic:'验收地点',value:'创新楼 902',
    text:'B组改到创新楼 902，取代两份排班。',scope:'B组',published:'2026-11-12',
    effective:'2026-11-13',imported:'2026-11-18',supersedes:['R21','R22'],aliases:[]};
  validateDocument(update,seed);
  check([...seed,update],'验收地点',['R21','R22'],{date:'2026-11-12'});
  check([...seed,update],'验收地点',['DEV-NOTICE'],{date:'2026-11-13'});
  check([...seed,update],'验收地点',['M03'],{date:'2026-11-13',scope:'A组'});
  check(seed,'海报尺寸',[],{date:'2026-11-12'});
  assert.equal(check(seed,'海报尺寸',[],{date:'2026-11-13'}).status,'unknown');
});

test('course requirements and missing equipment costs remain distinct in a mixed question', () => {
  const known = check(seed,'B组的融合方式是什么？',['B13']);
  assert.equal(known.status,'ok');
  assert.equal(check(seed,'设备费用可以报销多少元？',[]).status,'unknown');
  const mixed = check(seed,'B组的融合方式是什么，设备费用可以报销多少元？',['B13']);
  assert.equal(mixed.status,'unknown');
  assert.ok(mixed.sections.some(section=>section.topic==='融合方式' && section.status==='ok'));
  assert.ok(mixed.sections.some(section=>section.status==='unknown' && section.summary.includes('费用')));
  assert.ok(mixed.research.some(reference=>reference.id==='code-fusion'));
});
