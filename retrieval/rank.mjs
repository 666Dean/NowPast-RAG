import {withoutDates} from '../temporal/graph.mjs';

export const compact = s => s.replace(/\s+/g,'').toLowerCase();

// Small, explicit vocabulary expansion; it never supplies a topic or an answer.
// Both source and query are normalized, so new corpora need no clause-ID rules.
const synonyms = [
  [/怎么称呼|如何称呼|叫什么|叫啥|怎么叫|叫法|称呼|命名|代号|名称/g, ' 名称 '],
  [/盒子|盒|匣/g, ' 盒子 '],
  [/存储介质|硬盘|磁盘|光盘|[uU]盘|优盘|介质|盘/g, ' 存储介质 '],
  [/格子|柜号|柜子|柜/g, ' 柜位 ']
];
function expanded(text) {
  for (const [pattern, term] of synonyms) text = text.replace(pattern, term);
  return text;
}

function words(input) {
  return (input.toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9]+/gu) || []).flatMap(t =>
    /[a-z0-9]/.test(t) || t.length < 2 ? [t] : Array.from({length:t.length-1}, (_,i) => t.slice(i,i+2)));
}
function rank(docs, question, normalize = s => s) {
  const query = [...new Set(words(normalize(question)))];
  const bags = docs.map(d => words(normalize([d.title,d.topic,...d.aliases,d.text].join(' '))));
  const mean = bags.reduce((a,b) => a+b.length,0) / (bags.length || 1);
  const idfs = query.map(t => Math.log(1 + (docs.length - bags.filter(b => b.includes(t)).length + .5) / (bags.filter(b => b.includes(t)).length + .5)));
  return docs.map((doc,i) => {
    const bag = bags[i];
    const score = query.reduce((sum,t,j) => {
      const freq = bag.filter(s => s === t).length;
      return sum + idfs[j]*freq*2.2/(freq + 1.2*(.25 + .75*bag.length/(mean || 1)));
    },0);
    return {doc,score};
  }).sort((a,b) => b.score-a.score || a.doc.id.localeCompare(b.doc.id));
}
export function lexicalRank(docs, question) { return rank(docs, question); }
function topicMatches(docs, q, allowFuzzy = true) {
  const ranked = lexicalRank(docs,q);
  const normalize = s => s.replace(/\s+/g,'').toLowerCase();
  const terms = new Map();
  for (const {doc} of ranked) {
    if (!terms.has(doc.topic)) terms.set(doc.topic,new Set());
    for (const term of [doc.topic,...doc.aliases]) {
      terms.get(doc.topic).add(normalize(term));
      const stem = normalize(term).replace(/(?:方式|方法)$/u,'');
      if (stem.length >= 2) terms.get(doc.topic).add(stem);
    }
  }
  const text = normalize(q);
  const matches = [...terms].filter(([,v]) => [...v].some(s => text.includes(s))).map(([k]) => k);
  const anchors = ranked.filter(({doc}) => text.includes(normalize(doc.value)) || q.split(/[^\w-]+/).includes(doc.id));
  for (const {doc} of anchors) if (!matches.includes(doc.topic)) matches.push(doc.topic);
  if (matches.length || !allowFuzzy) return matches;
  // A pair of rare terms from the source can recover untitled/natural questions.
  // Abstain on a weak or ambiguous lexical match.
  const first = ranked[0];
  if (first?.score >= 5 && ranked.filter(r => r.doc.topic !== first.doc.topic).every(r => first.score > r.score * 1.8)) return [first.doc.topic];
  const semantic = rank(docs, q, expanded);
  const best = semantic[0];
  const contentWords = words(expanded(q)).filter(t => t !== '名称');
  const sourceWords = best ? words(expanded([best.doc.topic,...best.doc.aliases,best.doc.text].join(' '))) : [];
  if (expanded(q) !== q && contentWords.some(t=>sourceWords.includes(t)) && best?.score >= 1.5 &&
      semantic.filter(r => r.doc.topic !== best.doc.topic).every(r => best.score > r.score * 1.8)) return [best.doc.topic];
  return [];
}
export function matchedClue(doc,q) {
  return q.split(/[^\w-]+/).includes(doc.id) || compact(q).includes(compact(doc.value));
}
// A subject match alone cannot answer a request for a different measurement.
// Keep the requested dimension when checking the annotated topic and value.
const dimensions = [
  [/几分|多少分|得分|加分|扣分|评分|分值|成绩占比/, /分值|分数|得分|评分|成绩|加分|扣分|\d\s*分(?:$|[^钟])/],
  [/几元|多少钱|多少元|报销|预算|价格|费用/, /报销|预算|价格|费用|金额|人民币|(?:\d+(?:\.\d+)?|[一二三四五六七八九十百千万两]+)\s*元(?!素)/],
  [/几[页字]|多少[页字]|字数|页数/, /页数|字数|[\d百千万]+\s*[页字]/],
  [/几人|多少人|人数/, /人数|[\d一二两三四五六七八九十]+\s*人/]
];
export function routeQuestion(now, past, question) {
  const topics = new Set();
  const missing = [];
  const all = [...now,...past];
  // Dates select snapshots, not subject matter. A date-only fragment must not
  // retrieve a deadline merely because that source also contains a month/day.
  const parts = withoutDates(question).split(/[，,、；;。！？?!\n]+|(?:和|与|以及|及)(?=[^，,、；;。！？?!\n]*(?:费用|报销|预算|价格|多少钱|多少元))/u)
    .map(p=>p.trim()).filter(p=>p.replace(/和|与|及|至|到/g,'').trim());
  for (const part of parts) {
    const expected = dimensions.filter(([trigger])=>trigger.test(part)).map(([,unit])=>unit);
    let hits = [...new Set([...topicMatches(now,part,false),...topicMatches(past,part,false)])];
    if (!hits.length) {
      // Compare fuzzy confidence across both channels: a tiny history-only pool
      // otherwise looks unambiguous even when a current topic is a better match.
      hits = topicMatches(all,part);
      if (hits.length > 1) hits = [];
    }
    if (expected.length) hits = hits.filter(topic => expected.every(unit =>
      all.some(d=>d.topic===topic && unit.test([d.topic,d.value,...d.aliases].join(' ')))));
    for (const hit of hits) topics.add(hit);
    const separateAsk = /多少|几[分元人页字]|哪些|什么|如何|能否|能不能|哪里|在哪|哪种|哪位|谁|几时|是否/.test(part);
    const followup = /^(?:现在|目前)?(?:它|那[里个]|还去那里)|^(?:现在|目前)?(?:大家)?(?:怎么称呼|叫什么|叫啥).*它|^(?:为什么|为何)(?:变了|不同|会这样|改了|有变化)?$/.test(part);
    if (!hits.length && (expected.length || separateAsk) && !followup) missing.push(part);
  }
  return {topics:[...topics],missing};
}
