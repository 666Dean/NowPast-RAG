import {references} from '../knowledge/data.mjs';
import {scopes, validDay,validScope} from '../knowledge/schema.mjs';
import {compact, matchedClue, routeQuestion} from '../retrieval/rank.mjs';
import {parseDates, snapshot} from '../temporal/graph.mjs';
import {answerCampus} from './campus.mjs';

const evidence = (docs,role) => docs.map(doc => ({doc,role}));
const values = docs => docs.map(d => d.value+' ['+d.id+']').join('；');
const labels = {ok:'有据可查',conflict:'材料冲突',unknown:'证据不足',compare:'版本对照'};
function summarize(s, topic, scope, date, compare, previous, firstDay, includeHistory, askWhy) {
  const {current,past,scheduled,uncertain} = s;
  const conflict = new Set(current.map(d => compact(d.value))).size > 1;
  let status = conflict ? 'conflict' : current.length ? 'ok' : 'unknown';
  let summary = conflict ? '仍有互不相容的有效记载：'+values(current)+'。现有材料无法裁定，请向课程组确认。' :
    current.length ? values(current)+'。' : '截至该日，缺少已公布且已生效的条款。';
  let items = evidence(current,conflict?'冲突依据':'当前依据');
  if (previous) {
    const old = previous.current;
    const before = values(old) || '当日无已知有效条款';
    const after = values(current) || '当日无已知有效条款';
    const stable = old.length && old.map(d=>d.id).sort().join('|') === current.map(d=>d.id).sort().join('|');
    summary = firstDay+'：'+before+'。'+date+'：'+after+'。'+(stable?'两日依据相同。':'')+(conflict?'后一日仍有冲突。':'');
    if (new Set(old.map(d=>compact(d.value))).size > 1) summary += '前一日的材料互相冲突。';
    items = [...evidence(old,'前一日期'),...evidence(current,'后一日期')];
    if (!conflict && current.length && old.length) status = 'compare';
  } else if (compare && includeHistory) {
    if (past.length) {
      summary += ' 沿明确替代关系回查，旧记录为：'+values(past)+'。';
      if (status === 'ok') status = 'compare';
    } else summary += ' 未找到该范围内明确的旧版本关系。';
  }
  if (includeHistory && !previous) items.push(...evidence(past,'已被替代'));
  if (askWhy) {
    const reasons = current.flatMap(d => (d.text.match(/[^。！？]*(?:源于|原因为|原因是|由于)[^。！？]*[。！？]?/g) || []).map(line=>line.trim()+' ['+d.id+']'));
    summary += reasons.length ? ' 原文说明：'+reasons.join(' ') : ' 当日有效材料尚未交代原因。';
  }
  for (const doc of scheduled) summary += ' 已公布待生效：'+doc.effective+' 起，'+values([doc])+'。';
  for (const doc of uncertain) summary += ' 《'+doc.title+'》缺少'+(!doc.published?'公布':'生效')+'日期，适用性待核 ['+doc.id+']。';
  items.push(...evidence(scheduled,'已公布待生效'),...evidence(uncertain,'时间待核'));
  return {scope,topic,status,label:labels[status],summary,items};
}
function unknown(message,date,scope) {
  return {status:'unknown',label:labels.unknown,summary:message,date,scope,items:[],sections:[]};
}
export function answer(docs, question, options = {}) {
  if(options.domain==='campus') return answerCampus(docs,String(question || '').trim(),options);
  docs=docs.filter(doc=>doc.kind!=='campus');
  const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const ref = options.date || today;
  const q = String(question || '').trim();
  const groupMatches = [...new Set([...q.matchAll(/([AB])\s*组/gi)].map(m => m[1].toUpperCase()+'组'))];
  const scope = groupMatches.length === 1 ? groupMatches[0] : groupMatches.length > 1 || q.includes('全班') ? '全班' : options.scope || '全班';
  const dates = parseDates(q,ref);
  if (!validDay(ref) || dates.some(d=>!validDay(d)) || dates.length > 2) return unknown('请输入一至两个有效的查询日期。',ref,scope);
  if (!validScope(scope) || !q) return unknown('请输入问题并选择有效组别。',ref,scope);
  const sorted = [...dates].sort();
  const date = sorted.at(-1) || ref;
  const firstDay = sorted.length === 2 ? sorted[0] : null;
  const compare = Boolean(firstDay) || options.mode === 'compare' || (options.mode !== 'current' && /变更|变化|对比|比较|改了|改动|旧版|为什么|为何|不同|冲突原因/.test(q));
  const includeHistory = options.history !== false;
  // Replay only sources visible in the requested scope and publication horizon.
  // Now retrieves active claims. Past can match an old location, clause ID or
  // wording, then reopen its subject in the current, scope-specific snapshot.
  const visible = docs.filter(d => (['全班','全校'].includes(scope) || ['全班','全校'].includes(d.scope) || d.scope === scope) &&
    (d.published ? d.published <= date : d.imported <= date));
  const groups = scope === '全班' ? ['A组','B组'] : scope==='全校'?['计科1班','计科2班']:[scope];
  const nowIds = new Set();
  const historicalIds = new Set();
  for (const topic of new Set(visible.map(d=>d.topic))) {
    for (const g of groups) {
      const view = snapshot(visible,date,g,topic);
      for (const doc of [...view.current,...view.scheduled,...view.uncertain]) nowIds.add(doc.id);
      for (const doc of view.past) historicalIds.add(doc.id);
    }
  }
  const nowCandidates = visible.filter(d=>nowIds.has(d.id));
  const historyCandidates = visible.filter(d=>historicalIds.has(d.id));
  const {topics,missing} = routeQuestion(nowCandidates,includeHistory ? historyCandidates : [],q);
  if (!topics.length) return unknown('未找到能回答此问题的依据。可在资料库核查已有条款，或补充原文。',date,scope);
  const requestedSources = {论文:/论文|文章/.test(q),源码:/源码|代码|仓库/.test(q)};
  const sourceQuestion = Object.values(requestedSources).some(Boolean) && !/本组|[AB]\s*组|全班|课程|作业|该按|该用|执行|截至|当时|生效/i.test(q) && !dates.length;
  const linked = new Set((sourceQuestion ? docs : visible).flatMap(d=>d.refs || []));
  const research = references.filter(r=>topics.includes(r.topic) && linked.has(r.id) && (!sourceQuestion || requestedSources[r.kind]));
  // Source comparisons have no course verdict. Research notes keep their own
  // provenance and link to the paper or a pinned source file.
  if (sourceQuestion) {
    const missingSource = topics.flatMap(t=>Object.keys(requestedSources).filter(kind=>requestedSources[kind] &&
      !research.some(r=>r.topic===t && r.kind===kind)).map(kind=>t+' · '+kind));
    const lines = research.map(r=>r.topic+' · '+r.kind+'：'+r.note);
    for (const s of [...missingSource,...missing]) lines.push(s+'：当前资料库缺少可核查的原始依据。');
    return {status:missingSource.length || missing.length ? 'unknown' : 'ok',label:'研究原始依据',researchOnly:true,research,date,scope,items:[],sections:[],
      summary:lines.join('\n')};
  }
  const sections = [];
  for (const topic of topics) {
    const perGroup = groups.map(g => {
      const s = snapshot(docs,date,g,topic);
      const result = summarize(s,topic,g,date,compare,firstDay ? snapshot(docs,firstDay,g,topic) : null,
        firstDay,includeHistory,/为什么|为何|原因/.test(q));
      const clues = includeHistory ? s.past.filter(d=>matchedClue(d,q)) : [];
      if (clues.length) {
        result.summary += ' 问题中的旧线索来自 '+clues.map(d=>'['+d.id+']').join('、')+'。';
        result.items.push(...evidence(clues.filter(d=>!result.items.some(i=>i.doc.id===d.id)),'命中旧线索'));
      }
      return result;
    });
    if (perGroup.length === 2 && perGroup[0].summary === perGroup[1].summary && JSON.stringify(perGroup[0].items) === JSON.stringify(perGroup[1].items)) {
      sections.push({...perGroup[0],scope:'全班'});
    } else sections.push(...perGroup);
  }
  for (const fragment of missing) sections.push({scope,topic:'待补证的问题',status:'unknown',label:labels.unknown,
    summary:'“'+fragment+'”缺少直接回答该事项的资料。',items:[]});
  const items = [...new Map(sections.flatMap(s=>s.items).map(i=>[i.doc.id,i])).values()];
  const status = ['conflict','unknown','compare','ok'].find(k=>sections.some(s=>s.status === k));
  return {status,label:labels[status],summary:sections.map(s=>s.scope+' · '+s.topic+'：'+s.summary).join('\n'),date,scope,items,sections,research};
}
