import {references} from './data.mjs';

export function validDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const stamp = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10) === s;
}
export const scopes = ['全班','A组','B组','全校','计科1班','计科2班'];
export const campusFields = ['room','time','fee','contact','task','deadline','channel','service'];
export const validScope = s => typeof s==='string' && !!s.trim() && s.length<=100;
export function validateDocument(doc, docs = []) {
  if (!doc || typeof doc !== 'object') throw Error('需要一条完整的资料。');
  for (const k of ['id','topic','value','title','text']) {
    if (typeof doc[k] !== 'string' || !doc[k].trim() || doc[k].length > (k === 'text' ? 12000 : 240)) throw Error('资料字段缺失或过长：' + k);
  }
  if (!/^[\w-]{1,80}$/.test(doc.id) || docs.some(d => d.id === doc.id)) throw Error('条款标识无效或重复。');
  const campus = doc.kind === 'campus';
  if (doc.kind !== undefined && !campus) throw Error('未知资料类型。');
  if (campus) {
    const item=doc.campus;
    if (!item || !['course','classId'].every(key=>typeof item[key]==='string' && item[key].trim() && item[key].length<=100) ||
        !(validDay(item.lessonDate) || (typeof item.activityId==='string' && item.activityId.trim())) || !campusFields.includes(item.field) || doc.scope!==item.classId) throw Error('教学班、课程、课次日期或字段无效。');
    if (!doc.source || !['fictional','public'].includes(doc.source.type) || typeof doc.source.locator!=='string' || !doc.source.locator.trim()) throw Error('请标明虚构或公开来源及原文定位。');
    if (doc.source.type==='public' && (typeof doc.source.url!=='string' || !/^https?:\/\//.test(doc.source.url))) throw Error('公开通知需要来源链接。');
  } else if (!validScope(doc.scope)) throw Error('请指定适用范围。');
  if (!doc.text.includes(doc.value)) throw Error('条款值须逐字出现在原文中，便于核查。');
  if (!validDay(doc.imported) || ![doc.effective,doc.published].every(d => d === '' || validDay(d))) throw Error('无效日期，请使用年-月-日。');
  if (!Array.isArray(doc.aliases) || doc.aliases.length > 40 || doc.aliases.some(s => typeof s !== 'string' || !s.trim() || s.length > 100)) throw Error('主题检索词格式无效。');
  if (doc.refs !== undefined && (!Array.isArray(doc.refs) || doc.refs.some(id=>!references.some(r=>r.id===id && r.topic===doc.topic)))) throw Error('研究依据编号或主题不符。');
  if (!Array.isArray(doc.supersedes) || new Set(doc.supersedes).size !== doc.supersedes.length) throw Error('替代关系格式无效。');
  for (const id of doc.supersedes) {
    const parent = docs.find(d => d.id === id);
    if (campus && (!parent || parent.kind!=='campus' || ['classId','course','lessonDate','field'].some(key=>parent.campus[key]!==doc.campus[key]))) throw Error('替代关系必须属于同一教学班、课程、课次和字段。');
    if (!parent || parent.topic !== doc.topic || (!['全班','全校'].includes(parent.scope) && !['全班','全校'].includes(doc.scope) && doc.scope !== parent.scope)) throw Error('替代对象必须是已存在的同主题、范围相交的条款。');
    if(doc.field && parent.field && (doc.field!==parent.field || doc.course!==parent.course ||
      (doc.lessonDate && doc.lessonDate!==parent.lessonDate) || (doc.noticeType==='assignment' && doc.activity!==parent.activity))) throw Error('替代对象必须属于同一课程、课次或作业及字段。');
  }
  if (doc.relations !== undefined) {
    if (!Array.isArray(doc.relations) || doc.relations.length>24) throw Error('通知关联格式无效。');
    for (const relation of doc.relations) {
      const parent=docs.find(d=>d.id===relation?.id);
      if (!parent || parent.topic!==doc.topic || !['replace','clarify','parallel','same'].includes(relation.kind) ||
          (!['全班','全校'].includes(parent.scope) && !['全班','全校'].includes(doc.scope) && parent.scope!==doc.scope) || !parent.published || !doc.published || parent.published>doc.published) throw Error('通知关联的主题、范围或公布时间无效。');
      if(doc.field && parent.field && (doc.field!==parent.field || doc.course!==parent.course ||
        (doc.lessonDate && doc.lessonDate!==parent.lessonDate) || (doc.noticeType==='assignment' && doc.activity!==parent.activity))) throw Error('通知关联不能越过课程、课次或作业及字段。');
    }
  }
  if (doc.excerpt !== undefined && (typeof doc.excerpt!=='string' || !doc.text.includes(doc.excerpt) || !doc.excerpt.includes(doc.value))) throw Error('整理片段须包含同一原文中的条款值。');
}
