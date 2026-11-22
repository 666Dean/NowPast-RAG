import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {campusSeed,campusConflictSeed} from '../knowledge/campus-data.mjs';
const child=spawn(process.execPath,['service/server.mjs'],{env:{...process.env,PORT:'4194'},stdio:['ignore','pipe','inherit']});
try {
  await once(child.stdout,'data');
  const base={domain:'campus',asOf:'2026-11-25',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库'};
  const cases=[
    ['/api/query',{...base,question:'2班周五数据库课什么时候、在哪上？',docs:campusSeed}],
    ['/api/generate',{...base,asOf:'2026-11-26',question:'教室在哪，要交多少钱？',docs:campusConflictSeed}],
    ['/api/generate',{...base,question:'教室在哪，要交多少钱？',docs:campusSeed}]
  ];
  const results=[];
  for(const [path,request] of cases) {
    const response=await fetch('http://127.0.0.1:4194'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
    const {docs,...query}=request;
    results.push({path,query,status:response.status,response:await response.json()});
  }
  await writeFile(process.argv[2],JSON.stringify(results,null,2)+'\n');
  console.log(results.map(row=>({path:row.path,status:row.status,fields:Object.keys(row.response.fields||{}),error:row.response.error})));
} finally {child.kill('SIGTERM');await once(child,'exit');}
