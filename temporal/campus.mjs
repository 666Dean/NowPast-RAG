import {campusGraphErrors} from './integrity.mjs';
export function campusSnapshot(docs, {asOf,lessonDate,activityId,classId,course}, field) {
  const pool=docs.filter(doc=>doc.kind==='campus' && [classId,'全校','全班'].includes(doc.campus.classId) &&
    doc.campus.course===course && (activityId ? doc.campus.activityId===activityId : doc.campus.lessonDate===lessonDate) && doc.campus.field===field);
  const visible=pool.filter(doc=>doc.published && doc.published<=asOf && (!doc.imported || doc.imported<=asOf));
  const errors=campusGraphErrors(docs,visible);
  if(errors.length)return {current:[],past:[],uncertain:visible,errors};
  const applicable=visible.filter(doc=>doc.effective && doc.effective<=(lessonDate || asOf));
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
  const uncertain=pool.filter(doc=>(!doc.imported || doc.imported<=asOf) && (doc.published ? doc.published<=asOf : doc.imported<=asOf) && (!doc.published || !doc.effective));
  return {current:current.filter(d=>d.operation!=='cancel'),past:[...ancestors.values()],uncertain,withdrawn:current.filter(d=>d.operation==='cancel'),errors:[]};
}
