export function campusSnapshot(docs, {asOf,lessonDate,classId,course}, field) {
  const pool=docs.filter(doc=>doc.kind==='campus' && doc.campus.classId===classId &&
    doc.campus.course===course && doc.campus.lessonDate===lessonDate && doc.campus.field===field);
  const visible=pool.filter(doc=>doc.published && doc.published<=asOf);
  const applicable=visible.filter(doc=>doc.effective && doc.effective<=lessonDate);
  const replaced=new Set(applicable.flatMap(doc=>doc.supersedes));
  const current=applicable.filter(doc=>!replaced.has(doc.id));
  const ancestors=new Map();
  const byId=new Map(applicable.map(doc=>[doc.id,doc]));
  function visit(doc) {
    for(const id of doc.supersedes) {
      if(ancestors.has(id) || !byId.has(id)) continue;
      const parent=byId.get(id);
      ancestors.set(id,parent);
      visit(parent);
    }
  }
  current.forEach(visit);
  const uncertain=pool.filter(doc=>(doc.published ? doc.published<=asOf : doc.imported<=asOf) && (!doc.published || !doc.effective));
  return {current,past:[...ancestors.values()],uncertain};
}
