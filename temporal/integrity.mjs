// Validate graph structure independently of the model's proposed answer.
export function campusGraphErrors(docs,roots=docs) {
  const byId=new Map(docs.map(d=>[d.id,d])),errors=[],state=new Map();
  const identity=d=>d.campus || {classId:d.scope,course:d.course,lessonDate:d.lessonDate,activityId:d.activity,field:d.field};
  function visit(d){
    if(state.get(d.id)===1){errors.push({id:d.id,reason:'cycle'});return;}
    if(state.get(d.id)===2)return;state.set(d.id,1);
    for(const id of d.supersedes || []){
      const p=byId.get(id);if(!p){errors.push({id:d.id,parent:id,reason:'missing-parent'});continue;}
      const a=identity(d),b=identity(p);
      if(['course','field'].some(k=>a[k]!==b[k]) || (!['全校','全班'].includes(b.classId)&&a.classId!==b.classId) ||
        (a.lessonDate!==b.lessonDate) || (a.activityId&&b.activityId&&a.activityId!==b.activityId))errors.push({id:d.id,parent:id,reason:'cross-identity'});
      if(p.published&&d.published&&p.published>d.published)errors.push({id:d.id,parent:id,reason:'future-parent'});
      visit(p);
    }
    state.set(d.id,2);
  }
  roots.forEach(visit);return errors;
}
