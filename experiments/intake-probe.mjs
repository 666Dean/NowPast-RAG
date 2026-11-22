import {writeFileSync} from 'node:fs';
import {analyzeNotice} from '../generation/notice.mjs';
import {structuredCompletion,closeModel} from '../generation/model.mjs';
import {noticeSeed} from '../knowledge/notices.mjs';
const cases=[
  {name:'unseen-multi-item',input:{title:'虚构交互设计调课',published:'2026-11-25',scope:'数媒3班',text:'即日起，数媒3班《交互设计》11月27日教室改为C302。数媒3班《交互设计》11月27日上课时间改为10:00–11:40。'}},
  {name:'ambiguous-no-authority',input:{title:'数据库作业一补充',published:'2026-11-25',scope:'计科2班',text:'即日起，计科2班数据库作业一截止时间是11月28日18:00。'}},
  {name:'controlled-truncation',truncate:true,input:{title:'虚构受控失败',published:'2026-11-25',scope:'数媒3班',text:'即日起，数媒3班《交互设计》11月27日教室改为C302。'}}
];
const rows=[];
try{
  for(const c of cases){
    const calls=[],start=performance.now();let result,error;
    try{result=await analyzeNotice(noticeSeed,c.input,async request=>{
      const t=performance.now();
      try{const r=await structuredCompletion({...request,...(c.truncate?{maxTokens:1}:{})});calls.push({request,response:r,ms:performance.now()-t});return r;}
      catch(e){calls.push({request,error:e.message,ms:performance.now()-t});throw e;}
    });}catch(e){error=e.message;}
    rows.push({name:c.name,input:c.input,result,error,calls,ms:performance.now()-start});
    writeFileSync(new URL('./results/intake-probe.json',import.meta.url),JSON.stringify(rows,null,2));
    console.log(c.name,error || result.clauses.map(d=>({field:d.field,value:d.value,course:d.course,lessonDate:d.lessonDate,supersedes:d.supersedes})));
  }
}finally{closeModel();}
