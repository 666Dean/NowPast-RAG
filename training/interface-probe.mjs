import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';import {spawn,execFileSync} from 'node:child_process';import {once} from 'node:events';import {createHash} from 'node:crypto';
import {noticeSeed} from '../knowledge/notices.mjs';import {campusSeed,campusConflictSeed} from '../knowledge/campus-data.mjs';
const child=spawn(process.execPath,['service/server.mjs'],{env:{...process.env,PORT:'4199'},stdio:['ignore','pipe','inherit']});
const roots=['knowledge','temporal','retrieval','qa','generation','service','training'];
const files=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','-z','--',...roots],{encoding:'utf8'}).split('\0').filter(p=>/\.(?:mjs|py)$|(?:requirements\.txt|v2-runtime\.json)$/.test(p)))].sort();
const sourceFiles=Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const tag=process.env.NOWPAST_PROBE_TAG || '';if(tag&&!/^[\w-]+$/.test(tag))throw Error('Invalid probe tag');
const result={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),sourceFiles,sourceDigest:createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex'),startedAt:new Date().toISOString(),decoding:process.env.NOWPAST_MLX_DECODING || 'outlines-json-schema',variant:process.env.NOWPAST_MODEL_VARIANT,repetitionPenalty:Number(process.env.NOWPAST_MLX_REPETITION_PENALTY || 1),repetitionContext:Number(process.env.NOWPAST_MLX_REPETITION_CONTEXT || 256),cases:[]};
const directory=new URL('./runs/interface-fix/',import.meta.url);mkdirSync(directory,{recursive:true});
try{
 await once(child.stdout,'data');
 const opts={domain:'campus',asOf:'2026-11-26',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'};
 const cases=[
  ['quotes','/api/generate',{...opts,question:'什么时候、在哪上？',docs:campusSeed}],
  ['conflict-fee','/api/generate',{...opts,question:'教室在哪，要交多少钱？',docs:campusConflictSeed}],
  ['room-intake','/api/notices/analyze',{title:'数据库教室调整',scope:'计科2班',published:'2026-11-25',text:'即日起，计科2班11月27日数据库课教室调整为C205。',docs:noticeSeed}],
  ['new-course-two-fields','/api/notices/analyze',{title:'交互设计安排',scope:'数媒3班',published:'2026-11-25',text:'即日起，数媒3班《交互设计》11月27日教室改为C302。数媒3班《交互设计》11月27日上课时间改为10:00–11:40。',docs:noticeSeed}],
  ['homework-extension','/api/notices/analyze',{title:'数据库作业一延期',scope:'计科2班',published:'2026-11-25',text:'即日起，计科2班数据库作业一截止时间由11月27日18:00顺延至11月28日18:00，替代此前的截止要求。仍在课程平台提交。',docs:noticeSeed}],
  ['seven-lessons','/api/notices/analyze',{title:'交互设计七课次调整',scope:'数媒3班',published:'2026-11-19',text:'即日起，'+Array.from({length:7},(_,i)=>`数媒3班《交互设计》11月${i+20}日教室改为C${i+101}。`).join(''),docs:[]}]
 ];
 for(const [name,path,request] of cases.filter(c=>process.argv.length===2?c[0]!=='seven-lessons':process.argv.slice(2).includes(c[0]))){const t=performance.now();const response=await fetch('http://127.0.0.1:4199'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(125000)});const data=await response.json();
  const expected=name==='conflict-fee'?422:200;
  const grounded=data.citations?.every(c=>request.docs.find(d=>d.id===c.id)?.text.includes(c.quote)) ?? data.clauses?.every(c=>request.text.includes(c.excerpt)&&c.excerpt.includes(c.value)) ?? response.status===422;
  const complete=name==='new-course-two-fields'?data.clauses?.some(c=>c.field==='room'&&c.value==='C302')&&data.clauses?.some(c=>c.field==='time'&&c.value==='10:00–11:40'):name==='homework-extension'?data.clauses?.some(c=>c.field==='deadline'&&c.value==='11月28日18:00'):name==='room-intake'?data.clauses?.some(c=>c.field==='room'&&c.value==='C205'):name==='seven-lessons'?data.clauses?.length===7&&Array.from({length:7},(_,i)=>data.clauses.some(c=>c.value==='C'+(i+101)&&c.lessonDate==='2026-11-'+(i+20))).every(Boolean):true;
  const identityAndDates=path==='/api/notices/analyze'?!!data.clauses?.length&&data.clauses.every(c=>c.scope===request.scope&&c.course===(name==='new-course-two-fields'||name==='seven-lessons'?'交互设计':'数据库')&&c.published===request.published&&c.effective===request.published&&(name==='homework-extension'||name==='seven-lessons'||c.lessonDate==='2026-11-27')):true;
  result.cases.push({name,path,request,status:response.status,expected,checks:{grounded,complete:!!complete,identityAndDates},ok:response.status===expected&&grounded&&!!complete&&identityAndDates,ms:performance.now()-t,response:data});
  writeFileSync(new URL('http-'+(process.env.NOWPAST_INTAKE_V2==='1'?'v2':'legacy')+(tag?'-'+tag:'')+(process.argv.length>2?'-'+process.argv.slice(2).join('_'):'')+'.json',directory),JSON.stringify(result,null,2));
  console.log(name,response.status,'ok',result.cases.at(-1).ok,data.error || data.clauses?.map(c=>({field:c.field,value:c.value})));
 }
}finally{child.kill();await once(child,'exit');}
