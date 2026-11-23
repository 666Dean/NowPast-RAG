import {writeFileSync,mkdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {answer} from '../qa/answer.mjs';import {campusSeed,campusConflictSeed} from '../knowledge/campus-data.mjs';
import {noticeSeed} from '../knowledge/notices.mjs';import {generate,closeModel} from '../generation/model.mjs';
import {analyzeNotice} from '../generation/notice.mjs';import {modelIdentity} from '../generation/identity.mjs';
const out=new URL('./runs/offline/',import.meta.url);mkdirSync(out,{recursive:true});
const variant=process.env.NOWPAST_MODEL_VARIANT || 'base';const result={variant,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),identity:await modelIdentity(),cases:[]};
try{await fetch('https://example.com',{signal:AbortSignal.timeout(3000)});result.externalBlocked=false;}catch(e){result.externalBlocked=true;result.blockError=e.message;}
if(!result.externalBlocked)throw Error('Offline proof must run inside outbound-denied process boundary');
async function probe(name,fn){const t=performance.now();try{const response=await fn();result.cases.push({name,ok:true,ms:performance.now()-t,response});}catch(e){result.cases.push({name,ok:false,error:e.message,rawModel:e.rawModel || null,ms:performance.now()-t});}writeFileSync(new URL(variant+'.json',out),JSON.stringify(result,null,2));}
const opts={domain:'campus',asOf:'2026-11-26',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'};
try{
  await probe('field-query',()=>answer(campusSeed,'什么时候、在哪上？',opts));
  await probe('conflict-and-history',()=>answer(campusConflictSeed,'什么时候、在哪上？',opts));
  await probe('missing-evidence-guard',async()=>{const r=answer(campusConflictSeed,'教室在哪，要交多少钱？',opts);try{await generate(r,'教室在哪，要交多少钱？');throw Error('missing evidence incorrectly generated');}catch(e){if(!/证据不足/.test(e.message))throw e;return {blocked:true,message:e.message,fields:r.fields};}});
  await probe('real-model-quote',async()=>{const r=answer(campusSeed,'上课时间？',{...opts,fields:['time']});const g=await generate(r,'几点上课？');if(!g.citations.length||g.citations.some(c=>!campusSeed.find(d=>d.id===c.id)?.text.includes(c.quote)))throw Error('quote mismatch');return g;});
  await probe('real-raw-notice',()=>analyzeNotice(noticeSeed,{title:'数据库教室调整',scope:'计科2班',published:'2026-11-25',text:'即日起，计科2班11月27日数据库课教室调整为C205。'}));
}finally{closeModel();}
console.log({variant,externalBlocked:result.externalBlocked,cases:result.cases.map(r=>({name:r.name,ok:r.ok,error:r.error}))});
