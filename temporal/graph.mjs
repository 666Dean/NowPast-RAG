const datePattern = /(?<![\w.-])(?:(\d{4})\s*[-年/.]\s*)?(\d{1,2})\s*[-月/.]\s*(\d{1,2})(?:\s*[日号])?(?![\d.])/g;
const nonDateNumberPattern = /(?:§|第|章节|小节|版本|version|\bv)\s*\d+(?:\.\d+)+|\d+(?:\.\d+)+\s*(?:节|章|版)|(?:比例|比率|阈值|学习率|概率|dropout|温度)\s*(?:为|是|=|：|:)?\s*\d+\.\d+/gi;

function dateMatches(q) {
  const protectedNumbers = [...q.matchAll(nonDateNumberPattern)];
  return [...q.matchAll(datePattern)].filter(match => !protectedNumbers.some(number =>
    match.index < number.index + number[0].length && number.index < match.index + match[0].length));
}

export function withoutDates(q) {
  let text = q;
  for (const match of dateMatches(q).reverse()) {
    text = text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length);
  }
  return text;
}

export function parseDates(q, reference) {
  const hits = dateMatches(q);
  return hits.map(m => (m[1] || reference.slice(0,4))+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'));
}

export function snapshot(docs, date, scope, topic) {
  const pool = docs.filter(d => d.topic === topic && (d.scope === '全班' || d.scope === scope));
  const published = pool.filter(d => d.published && d.published <= date);
  const live = published.filter(d => d.effective && d.effective <= date);
  const byId = new Map(live.map(d => [d.id,d]));
  const replaced = new Set(live.flatMap(d => d.supersedes));
  const current = live.filter(d => !replaced.has(d.id)).sort((a,b) => b.effective.localeCompare(a.effective) || a.id.localeCompare(b.id));
  const history = new Map();
  function visit(node,depth) {
    for (const key of node.supersedes) {
      const ancestor = byId.get(key);
      if (!ancestor || (history.get(key)?.depth ?? Infinity) <= depth) continue;
      history.set(key,{doc:ancestor,depth});
      visit(ancestor,depth+1);
    }
  }
  for (const node of current) visit(node,1);
  const past = [...history.values()].sort((a,b) => a.depth-b.depth || b.doc.effective.localeCompare(a.doc.effective)).map(r => r.doc);
  const scheduled = published.filter(d => d.effective && d.effective > date);
  // For undated publication never project a document back to before it was seen locally.
  const uncertain = pool.filter(d => (!d.published ? d.imported <= date : d.published <= date && !d.effective));
  return {current,past,scheduled,uncertain};
}
