export function parseDates(q, reference) {
  const hits = [...q.matchAll(/(?:(\d{4})\s*[-年/.]\s*)?(\d{1,2})\s*[-月/.]\s*(\d{1,2})(?:\s*[日号])?/g)];
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
