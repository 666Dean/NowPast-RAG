import {references} from './data.mjs';

export function validDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const stamp = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10) === s;
}
export const scopes = ['全班','A组','B组'];
export function validateDocument(doc, docs = []) {
  if (!doc || typeof doc !== 'object') throw Error('需要一条完整的资料。');
  for (const k of ['id','topic','value','title','text']) {
    if (typeof doc[k] !== 'string' || !doc[k].trim() || doc[k].length > (k === 'text' ? 12000 : 240)) throw Error('资料字段缺失或过长：' + k);
  }
  if (!/^[\w-]{1,80}$/.test(doc.id) || docs.some(d => d.id === doc.id)) throw Error('条款标识无效或重复。');
  if (!scopes.includes(doc.scope)) throw Error('请指定适用范围。');
  if (!doc.text.includes(doc.value)) throw Error('条款值须逐字出现在原文中，便于核查。');
  if (!validDay(doc.imported) || ![doc.effective,doc.published].every(d => d === '' || validDay(d))) throw Error('无效日期，请使用年-月-日。');
  if (!Array.isArray(doc.aliases) || doc.aliases.length > 40 || doc.aliases.some(s => typeof s !== 'string' || !s.trim() || s.length > 100)) throw Error('主题检索词格式无效。');
  if (doc.refs !== undefined && (!Array.isArray(doc.refs) || doc.refs.some(id=>!references.some(r=>r.id===id && r.topic===doc.topic)))) throw Error('研究依据编号或主题不符。');
  if (!Array.isArray(doc.supersedes) || new Set(doc.supersedes).size !== doc.supersedes.length) throw Error('替代关系格式无效。');
  for (const id of doc.supersedes) {
    const parent = docs.find(d => d.id === id);
    if (!parent || parent.topic !== doc.topic || (parent.scope !== '全班' && doc.scope !== '全班' && doc.scope !== parent.scope)) throw Error('替代对象必须是已存在的同主题、范围相交的条款。');
  }
}
