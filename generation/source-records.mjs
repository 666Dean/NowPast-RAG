import {randomUUID} from 'node:crypto';
import {validateDocument} from '../knowledge/schema.mjs';

// Conservative grammar path. Unsupported prose returns null for model analysis;
// it never turns incomplete pattern matches into a partial published notice.
export function parseGroundedNotice(input,docs=[],id='notice-'+randomUUID()) {
  const sentences=input.text.match(/[^。！？\n]+[。！？]?/gu) || [];
  const parsed=[];
  const fields={教室:'room',上课时间:'time',截止时间:'deadline',提交内容:'task',提交平台:'channel',费用:'fee',开放时段:'service'};
  for(const quote of sentences){
    const m=quote.match(/^(.{1,100}?)《([^》]+)》(作业[一二三四五六七八九十\d]+|\d{4}-\d{2}-\d{2}(?:课程|公告))，自(\d{4}-\d{2}-\d{2})起(教室|上课时间|截止时间|提交内容|提交平台|费用|开放时段)(?:安排为|为|调整为|改至|另外通知为|独立安排为|现澄清统一为|两份安排澄清为)([^；。]+)(?:；(.+?))?[。！？]?$/u);
    if(!m) return null;
    const [,scope,course,activityText,effective,name,value,tail='']=m;
    if(scope!==input.scope && !['全校','全班'].includes(input.scope)) throw Error('原文班级与接收范围不一致，尚未发布。');
    const field=fields[name],assignment=activityText.startsWith('作业'),lessonDate=assignment?undefined:activityText.slice(0,10);
    const activity=course+'-'+(assignment?activityText:lessonDate);
    const references=[...tail.matchAll(/【([\w-]+)】/g)].map(x=>x[1]);
    const parents=references.map(key=>docs.find(d=>d.id===key));
    if(parents.some(p=>!p || (p.campus?.course || p.course)!==course || p.scope!==scope ||
      (p.campus?.field || p.field)!==field || (p.campus?.activityId || p.activity)!==activity || !p.published || p.published>input.published)) throw Error('原文关联越过课程、班级、课次或作业；尚未发布。');
    const authority=/替代|取代/.test(tail),kind=/澄清/.test(quote)?'clarify':authority?'replace':'parallel';
    const record={id:sentences.length===1?id:`${id}-${parsed.length+1}`,noticeId:id,title:input.title,text:input.text,scope,course,noticeType:assignment?'assignment':activityText.endsWith('公告')?'school':'course',activity,lessonDate,field,
      published:input.published,effective,imported:input.imported || input.published,
      topic:parents[0]?.topic || course+'·'+activity+'·'+field,value:value.trim(),excerpt:quote,aliases:[],
      supersedes:authority?references:[],relations:references.map(id=>({id,kind})),source:{type:'fictional',locator:id},
      event:{date:lessonDate,time:field==='time'?value:undefined,place:field==='room'||field==='channel'?value:undefined,action:field==='task'?value:undefined},
      analysis:{method:'source-grounded-grammar-v1',model:null}};
    if(field==='deadline') {record.event.date=value.match(/\d{4}-\d{2}-\d{2}/)?.[0];record.event.time=value.match(/\d{2}:\d{2}/)?.[0];}
    if(field==='service') {
      record.event.time=value.match(/\d{1,2}[:：]\d{2}(?:\s*[–—-]\s*\d{1,2}[:：]\d{2})?/)?.[0];
      record.event.action=value.match(/暂停开放|开放|闭馆/)?.[0];
    }
    validateDocument(record,[...docs,...parsed]);parsed.push(record);
  }
  return parsed.length?parsed:null;
}
