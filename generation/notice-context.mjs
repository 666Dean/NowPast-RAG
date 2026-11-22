import {parseDates} from '../temporal/graph.mjs';
import {validDay} from '../knowledge/schema.mjs';

// Normalization is used for identity, never to rewrite a quotation.
export function datesIn(text, published) {
  let month=Number(published.slice(5,7));
  const expanded=text.replace(/(?:(\d{1,2})月)?(\d{1,2})日/g,(all,m,d)=>{
    if(m) month=Number(m);
    return `${month}月${d}日`;
  });
  return parseDates(expanded,published).filter(validDay);
}
export function noticeContext(input,item,docs=[]) {
  const valueIndex=input.text.indexOf(item.value);
  const prefix=input.text.slice(0,valueIndex<0?input.text.length:valueIndex+item.value.length);
  const sentence=prefix.split(/[。！？\n]/).at(-1) || prefix;
  const localBracket=[...sentence.matchAll(/《([^》]{1,60})》/g)].at(-1)?.[1];
  const bracket=localBracket || [...prefix.matchAll(/《([^》]{1,60})》/g)].at(-1)?.[1];
  const known=[...new Set(docs.map(d=>d.course || d.campus?.course).filter(Boolean))]
    .filter(c=>sentence.includes(c) || input.title.includes(c));
  const course=bracket || input.course || (known.length===1?known[0]:'');
  const assignmentPattern=/作业[一二三四五六七八九十\d]+|第[一二三四五六七八九十\d]+次作业/g;
  const localAssignment=[...sentence.matchAll(assignmentPattern)].at(-1)?.[0];
  const lessonMention=/上课时间|上课地点|教室/.test(item.topic) || (/课教室|上课|课程/.test(sentence) && !/课程平台|作业/.test(sentence));
  const assignment=localAssignment || (!localBracket && !lessonMention?[...prefix.matchAll(assignmentPattern)].at(-1)?.[0]:undefined);
  const noticeType=assignment?'assignment':input.noticeType || (course?'course':'school');
  const local=sentence.split(/[，,；;]/).at(-1);
  const groundedField=/截止|顺延至|延期/.test(local) && datesIn(item.value,input.published).length?'deadline':
    /上课时间|课程时间/.test(local) && /\d[:：]\d/.test(item.value)?'time':
    /教室|地点/.test(local) && /[A-Z]\d{2,4}|楼|教室/.test(item.value)?'room':undefined;
  const field=groundedField || item.field || (/截止|延期/.test(item.topic)?'deadline':/提交平台|提交地点|渠道/.test(item.topic)?'channel':
    /地点|教室/.test(item.topic)?'room':/上课时间|课程时间/.test(item.topic)?'time':/费用|收费/.test(item.topic)?'fee':
    /联系人/.test(item.topic)?'contact':noticeType==='assignment'?'task':'service');
  // Lesson date is taken before the value: a new deadline must not become lesson identity.
  const effectivePattern=/(?:自|从)(?:\d{4}[-年/.])?(?:\d{1,2}[-月/.])?\d{1,2}[日号]?(?:起|生效)/g;
  const calendar=datesIn(prefix,input.published);
  for(const m of prefix.matchAll(effectivePattern)){
    const day=datesIn(prefix.slice(0,m.index+m[0].length),input.published).at(-1);
    const index=calendar.indexOf(day);if(index>=0)calendar.splice(index,1);
  }
  const localCount=datesIn(sentence,input.published).length-[...sentence.matchAll(effectivePattern)].length;
  const lessonDate=noticeType==='course' && localCount>0?calendar.slice(-localCount)[0]:undefined;
  const activity=assignment && course?`${course}-${assignment}`:lessonDate && course?`${course}-${lessonDate}`:undefined;
  return {course,noticeType,field,lessonDate,activity,assignment};
}
export function compatibleContext(doc,context) {
  const c=doc.campus || doc;
  if(context.course && (c.course || '')!==context.course) return false;
  if(context.noticeType && doc.noticeType && doc.noticeType!==context.noticeType) return false;
  if(context.field && (c.field || '')!==context.field) return false;
  if(context.lessonDate && c.lessonDate!==context.lessonDate) return false;
  if(context.assignment && !(doc.activity || c.activityId || '').endsWith('-'+context.assignment)) return false;
  // A course/assignment with no grounded identity remains unlinked.
  if(context.course && !context.lessonDate && !context.assignment && context.noticeType!=='school') return false;
  return true;
}
