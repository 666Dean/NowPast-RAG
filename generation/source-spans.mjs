// A notice-wide immediate date is usable only without a competing explicit or
// relative effective period. Otherwise keep the model date unforced/verified.
export function immediateEffectiveDay(text,published){
  return /即日|公布之日|发布之日|今天起/.test(text)&&!/(?:自|从)[^，。；]{0,20}(?:起|生效)|\d[日号]?\s*起|\d[日号]?[^，。；]{0,8}生效|明(?:日|天)|后天|下(?:周|星期|月)/.test(text)?published:undefined;
}
export function assertConfirmedSource(quote,value){
  const claims=quote.split(/[。！？\n]/u).filter(s=>s.includes(value));
  if(claims.some(s=>/据说|听说|同学说|传闻|是否属实|待确认|尚未确定|暂未确定|另行通知|待定/.test(s)))throw Error('原文仍是传闻或待确认事项，不能作为确定安排发布。');
}
export function assertChangedSource(quote,value){
  const parts=quote.split(/[，,；;。！？\n]/u).filter(s=>s.includes(value));
  if(parts.some(s=>/不变|保持原|沿用|继续按原|仍为|仍是|仍按|仍在|照常/.test(s)&&!/改为|改至|调整|顺延|推迟|提前|变更/.test(s)))throw Error('原文说明该要求沿用或不变，不能新增变更条款。');
}
export function assertTeachingIdentity(context,item){
  const teaching=/课程|教室|上课|作业|截止/.test(item.quote) || (/\d{1,2}日/.test(item.quote)&&/[A-Za-z]\d{2,4}/.test(item.value)&&context.classId!=='全校');
  if(teaching&&(!context.course||!(context.lessonDate||context.assignment)))throw Error('课程、课次或作业身份仍待确认，不能发布确定安排。');
}
export function assertRequirementCoverage(input,clauses,docs=[]){
  const actual=clauses.map(c=>({value:c.value,context:noticeContext(input,{...c,topic:c.topic || c.field || '',quote:c.quote || c.excerpt},docs)}));
  for(const mention of sourceSpans(input.text).requiredMentions){
    const target=noticeContext(input,{topic:'',value:mention.value,quote:mention.quote},docs);
    if(!actual.some(c=>c.value===mention.value&&['course','classId','lessonDate','assignment'].every(k=>!target[k]||c.context[k]===target[k])))throw Error('原文仍有未覆盖的课程、课次或作业要求，尚未发布任何条款。');
  }
}
export function sourceSpans(text) {
  const quotes=text.match(/[^。！？\n]+[。！？]?/gu)?.map(line=>line.trim()).filter(Boolean) || [];
  const values=new Set();
  const requiredValues=new Set();
  const requiredMentions=[];
  for (const segment of text.matchAll(/[^，,；;。！？\n]+/gu)) {
    const part=segment[0].trim();if(!part)continue;
    if (/不变|保持原|沿用|继续按原|仍为|仍是|仍按|仍在|照常|替代此前|取代此前|^即日起$|^自.{0,30}日起$/.test(part)) continue;
    let matches=[...part.matchAll(/(?:改为|改至|改到|改在|改附|调整(?:为|到|至)|顺延至|推迟至|提前至|变更为|统一(?:为|到)|改按)\s*(.+)/gu)];
    const explicitChange=matches.length>0;
    if (!matches.length) matches=[...part.matchAll(/(?:需提交|须提交|提交|附上|采用|为|是|：|(?<!\d):)\s*(.+)/gu)];
    const value=(matches.at(-1)?.[1] || part).trim();
    if (value && value.length<=240){values.add(value);if(explicitChange){requiredValues.add(value);requiredMentions.push({value,quote:part,start:segment.index+segment[0].indexOf(part),end:segment.index+segment[0].indexOf(part)+part.length});}}
  }
  if(Math.max(values.size,requiredMentions.length)>80) throw Error('本通知超过 80 个候选事项，请分段整理；尚未写入任何条款。');
  return {quotes:[...new Set([...quotes,text])],values:[...values],requiredValues:[...requiredValues],requiredMentions};
}
export function supportsSourceField(field,value,quote){
  const patterns={room:[/教室|地点|上课|会议室|实验室|教学楼/,/[A-Za-z]\d{2,4}|楼|教室|会议室|实验室|线上|腾讯会议/],
    time:[/上课时间|课程时间|课时|几点|时段|第.{1,4}节/,/\d{1,2}[:：]\d{2}|第.{1,4}节/],
    deadline:[/截止|延期|顺延|提交.*前/,/\d{1,2}(?:月|[-/])\d{1,2}|\d{1,2}[:：]\d{2}/],
    fee:[/费用|收费|学费|报名费|报销|缴费|多少钱/,/\d+(?:\.\d+)?\s*元(?!素)|[￥¥]\s*\d|免费|免收/],
    contact:[/联系|负责人|值班|咨询|电话/,/\S/],channel:[/平台|提交|邮箱|邮件|交到/,/平台|系统|邮箱|邮件|办公室|教室|https?:/],
    task:[/作业|提交|完成|报告|练习|实验|任务/,/\S/],service:[/公告|图书馆|开放|关闭|办事|校车|活动|服务/,/\S/]};
  if(value==='取消')return /取消|撤销|作废/.test(quote)&&!/不取消|未取消|无须取消|不要取消|取消无效/.test(quote);
  const p=patterns[field];return !!p&&p[0].test(quote)&&p[1].test(value);
}
import {noticeContext} from './notice-context.mjs';
