export const compact = s => s.replace(/\s+/g,'').toLowerCase();

function words(input) {
  return (input.toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9]+/gu) || []).flatMap(t =>
    /[a-z0-9]/.test(t) || t.length < 2 ? [t] : Array.from({length:t.length-1}, (_,i) => t.slice(i,i+2)));
}
export function lexicalRank(docs, question) {
  const query = [...new Set(words(question))];
  const bags = docs.map(d => words([d.title,d.topic,...d.aliases,d.text].join(' ')));
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
function topicMatches(docs, q, allowFuzzy = true) {
  const ranked = lexicalRank(docs,q);
  const normalize = s => s.replace(/\s+/g,'').toLowerCase();
  const terms = new Map();
  for (const {doc} of ranked) {
    if (!terms.has(doc.topic)) terms.set(doc.topic,new Set());
    for (const term of [doc.topic,...doc.aliases]) terms.get(doc.topic).add(normalize(term));
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
  return [];
}
export function matchedClue(doc,q) {
  return q.split(/[^\w-]+/).includes(doc.id) || compact(q).includes(compact(doc.value));
}
// A subject match alone cannot answer a request for a different measurement.
// Keep the requested dimension when checking the annotated topic and value.
const dimensions = [
  [/几分|多少分|得分|加分|扣分|评分|分值|成绩占比/, /分值|分数|得分|评分|成绩|加分|扣分|\d\s*分(?:$|[^钟])/],
  [/几元|多少钱|多少元|报销|预算|价格|费用/, /报销|预算|价格|费用|金额|元|人民币/],
  [/几[页字]|多少[页字]|字数|页数/, /页数|字数|[\d百千万]+\s*[页字]/],
  [/几人|多少人|人数/, /人数|[\d一二两三四五六七八九十]+\s*人/]
];
export function routeQuestion(now, past, question) {
  const topics = new Set();
  const missing = [];
  const all = [...now,...past];
  const parts = question.split(/[，,、；;。！？?!\n]+/u).map(p=>p.trim()).filter(Boolean);
  for (const part of parts) {
    const expected = dimensions.filter(([trigger])=>trigger.test(part)).map(([,unit])=>unit);
    let hits = [...new Set([...topicMatches(now,part,false),...topicMatches(past,part,false)])];
    if (!hits.length) {
      hits = [...new Set([...topicMatches(now,part),...topicMatches(past,part)])];
      if (hits.length > 1) hits = [];
    }
    if (expected.length) hits = hits.filter(topic => expected.every(unit =>
      all.some(d=>d.topic===topic && unit.test([d.topic,d.value,...d.aliases].join(' ')))));
    for (const hit of hits) topics.add(hit);
    const separateAsk = /多少|几[分元人页字]|哪些|什么|如何|能否|能不能|哪里|在哪|哪种|哪位|谁|几时|是否/.test(part);
    const followup = /^(?:现在|目前)?(?:它|那[里个]|还去那里)|^(?:为什么|为何)(?:变了|不同|会这样|改了|有变化)?$/.test(part);
    if (!hits.length && (expected.length || separateAsk) && !followup) missing.push(part);
  }
  return {topics:[...topics],missing};
}
