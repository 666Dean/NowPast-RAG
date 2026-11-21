const datePattern = /(?<![\w.-])(?:(\d{4})\s*[-年/.]\s*)?(\d{1,2})\s*[-月/.]\s*(\d{1,2})(?:\s*[日号])?(?![\d.])/g;
const rangePattern = /(?<![\w.-])(?:(\d{4})\s*[-年/.]\s*)?(\d{1,2})\s*[-月/.]\s*(\d{1,2})(?:\s*[日号])?\s*(?:至|到|[-–—~～])\s*(?:(\d{4})\s*[-年/.]\s*)?(?:(\d{1,2})\s*[-月/.]\s*)?(\d{1,2})(?:\s*[日号])?(?![\d.])/g;
const nonDateNumberPattern = /(?:§|第|章节|小节|版本|version|\bv)\s*\d+(?:\.\d+)+|\d+(?:\.\d+)+\s*(?:节|章|版)|(?:比例|比率|阈值|学习率|概率|dropout|温度)\s*(?:为|是|=|：|:)?\s*\d+\.\d+/gi;

function dateMentions(question) {
  const protectedNumbers = [...question.matchAll(nonDateNumberPattern)];
  const overlaps = (a,b) => a.index < b.index+b[0].length && b.index < a.index+a[0].length;
  const ranges = [...question.matchAll(rangePattern)].filter(match=>!protectedNumbers.some(number=>overlaps(match,number)));
  const singles = [...question.matchAll(datePattern)].filter(match=>
    ![...protectedNumbers,...ranges].some(other=>overlaps(match,other)));
  return [...ranges.map(match=>({index:match.index,length:match[0].length,
    dates:[[match[1],match[2],match[3]],[match[4]||match[1],match[5]||match[2],match[6]]]})),
    ...singles.map(match=>({index:match.index,length:match[0].length,dates:[[match[1],match[2],match[3]]]}))]
    .sort((a,b)=>a.index-b.index);
}

export function withoutDates(question) {
  let text=question;
  for(const mention of dateMentions(question).reverse()) {
    text=text.slice(0,mention.index)+' '+text.slice(mention.index+mention.length);
  }
  return text;
}

export function parseDates(question, reference) {
  return dateMentions(question).flatMap(mention=>mention.dates.map(([year,month,day])=>
    (year||reference.slice(0,4))+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0')));
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
