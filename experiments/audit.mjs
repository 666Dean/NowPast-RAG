import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateDocument} from '../knowledge/schema.mjs';
const root=new URL(process.env.NOWPAST_EXPERIMENT_DIR || './full/',import.meta.url),config=JSON.parse(readFileSync(new URL('config.json',root))),freeze=JSON.parse(readFileSync(new URL('freeze.json',root)));
mkdirSync(new URL('results/',root),{recursive:true});const summaries=[];
for(const seed of config.seeds){
  const bytes=readFileSync(new URL(`data/seed-${seed}.json.gz`,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),freeze.datasets.find(d=>d.seed===seed).sha256);
  const data=JSON.parse(gunzipSync(bytes)),byId=new Map(data.docs.map(d=>[d.id,d])),valid=[];
  for(const d of data.docs){validateDocument(d,valid);valid.push(d);}
  const test=data.questions.filter(q=>q.split==='test');assert.ok(data.docs.length>=1000);assert.ok(new Set(test.map(q=>q.question)).size>=10000);
  const expanded=[];
  for(const q of data.questions){
    const gold=q.gold.map(g=>{const d=byId.get(g.id);assert.ok(d,`${q.id}: missing source`);assert.equal(d.value,g.value);assert.equal(d.campus.field,g.field);assert.ok(d.text.includes(g.value));return {...g,title:d.title,published:d.published,quote:d.excerpt || d.text,source:d.source};});
    for(const id of q.oldIds)assert.ok(byId.has(id));
    const fields=Object.fromEntries(q.fields.map(f=>{const values=[...new Set(q.gold.filter(g=>g.field===f).map(g=>g.value))];return [f,{values,status:values.length>1?'conflict':values.length?'ok':'unknown'}];}));
    expanded.push({...q,gold,fields});
  }
  writeFileSync(new URL(`results/gold-expanded-${seed}.json.gz`,root),gzipSync(JSON.stringify(expanded)));
  summaries.push({seed,notices:data.docs.length,questions:data.questions.length,uniqueQuestions:new Set(data.questions.map(q=>q.question)).size,testQuestions:test.length,
    testWorlds:new Set(test.map(q=>q.world)).size,testCheckpoints:new Set(test.map(q=>q.world+'|'+q.scene)).size,
    noticeTypes:Object.fromEntries([...new Set(data.docs.map(d=>d.campus.noticeType))].map(type=>[type,data.docs.filter(d=>d.campus.noticeType===type).length]))});
}
writeFileSync(new URL('results/data-audit.json',root),JSON.stringify({passed:true,independentGold:'registered event checkpoints; no answer/snapshot calls',summaries},null,2));console.log(summaries);
