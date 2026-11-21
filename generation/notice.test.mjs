import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../knowledge/data.mjs';
import {snapshot} from '../temporal/graph.mjs';
import {analyzeNotice,materializeNotice} from './notice.mjs';
import {relationsFor} from '../web/notice-relations.mjs';

const input={title:'验收地点调整',published:'2026-11-21',scope:'B组',text:'自2026年11月24日起，B组验收地点改为信息楼402。'};
const requirement={topic:'验收地点',value:'信息楼402',quote:input.text,scope:'B组',effective:'2026-11-24'};
const proposal={kind:'replace',relatedIds:['R30']};
const build=(item=requirement,links=proposal,body=input)=>materializeNotice(body,{clauses:[item]},[links],'test-model',seed).clauses[0];

test('AI intake updates only the supported group after its effective date and keeps concrete old evidence',()=>{
  const doc=build();const all=[...seed,doc];
  assert.deepEqual(doc.supersedes,['R30']);
  assert.deepEqual(snapshot(all,'2026-11-23','B组','验收地点').current.map(doc=>doc.id),['R30']);
  assert.ok(snapshot(all,'2026-11-23','B组','验收地点').scheduled.some(item=>item.id===doc.id));
  assert.deepEqual(snapshot(all,'2026-11-24','B组','验收地点').current.map(doc=>doc.id),[doc.id]);
  assert.deepEqual(snapshot(all,'2026-11-24','A组','验收地点').current.map(doc=>doc.id),['M03']);
  const edges=relationsFor([doc],all,{date:'2026-11-21',scope:'B组'});
  assert.equal(edges[0].prior.title,'课程组与实验中心联合澄清');
  assert.equal(edges[0].prior.published,'2026-11-15');
});
test('invented quotations and values are rejected before any graph update',()=>{
  assert.throws(()=>build({...requirement,quote:'未经原文提供的新地点。'}),/原文核验/);
  assert.throws(()=>build({...requirement,value:'虚构地点999'}),/原文核验/);
});
test('an inferred date must occur in the source; missing dates remain uncertain',()=>{
  assert.throws(()=>build({...requirement,effective:'2026-11-25'}),/原文核验/);
  const body={...input,text:'B组验收地点改为信息楼402。'};
  const doc=build({...requirement,quote:body.text,effective:''},proposal,body);
  const view=snapshot([...seed,doc],'2026-11-25','B组','验收地点');
  assert.deepEqual(view.current.map(doc=>doc.id),['R30']);assert.ok(view.uncertain.some(item=>item.id===doc.id));
});
test('unpublished or unrelated evidence cannot be retired by a model proposal',()=>{
  assert.throws(()=>build(requirement,{...proposal,relatedIds:['M01']}),/越过/);
  const body={...input,published:'2026-11-14'};
  assert.throws(()=>build(requirement,proposal,body),/越过/);
  assert.throws(()=>build({...requirement,scope:'A组'}),/原文核验/);
});
test('same-topic references without an explicit change stay parallel rather than silently overriding',()=>{
  const body={...input,text:'自2026年11月24日起，B组验收地点是信息楼402。'};
  const doc=build({...requirement,quote:body.text},proposal,body);
  assert.deepEqual(doc.supersedes,[]);assert.equal(doc.relations[0].kind,'parallel');
  assert.equal(snapshot([...seed,doc],'2026-11-24','B组','验收地点').current.length,2);
});
test('RAG comparison retrieves the current notice and retains the model identity',async()=>{
  const calls=[];
  const complete=async request=>{calls.push(request);return {model:'actual-adapter',data:calls.length===1?{clauses:[requirement]}:proposal};};
  const result=await analyzeNotice(seed,input,complete);
  assert.equal(result.model,'actual-adapter');
  assert.deepEqual(calls[1].input.previous.map(doc=>doc.id),['R30']);
  assert.equal(result.clauses[0].analysis.model,'actual-adapter');
});
test('one raw notice produces independently linked atomic fields',()=>{
  const text='自2026年11月24日起，B组验收地点改为信息楼402。B组报告格式改为一份PDF报告。';
  const result=materializeNotice({...input,text},{clauses:[requirement,{topic:'报告格式',value:'一份PDF报告',quote:'B组报告格式改为一份PDF报告。',scope:'B组',effective:'2026-11-24'}]},[proposal,{kind:'replace',relatedIds:['B11']}],'test-model',seed);
  assert.equal(result.clauses.length,2);assert.equal(result.clauses[0].noticeId,result.clauses[1].noticeId);
  assert.deepEqual(result.clauses.map(doc=>doc.supersedes),[['R30'],['B11']]);
});
test('visible links cannot disclose a later clarification or another group',()=>{
  const manual=seed.find(doc=>doc.id==='M03');
  const before=relationsFor([manual],seed,{date:'2026-11-14',scope:'B组'});
  assert.ok(!before.some(edge=>edge.doc.id==='R30'));
  assert.deepEqual(relationsFor([manual],seed,{date:'2026-11-21',scope:'A组'}),[]);
  const clarification=seed.find(doc=>doc.id==='R30');
  assert.deepEqual(relationsFor([clarification],seed,{date:'2026-11-15',scope:'B组'}).map(edge=>edge.prior.id).sort(),['R21','R22']);
});
