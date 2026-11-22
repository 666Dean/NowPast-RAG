// Read adapter: preserve teacher documents, IDs and verbatim sources for the UI.
export function canonicalNotices(docs) {
  return docs.flatMap(doc=>{
    if(doc.kind==='campus') return [doc];
    if(!doc.field || !doc.noticeType) return [];
    return [{...doc,kind:'campus',source:doc.source || {type:'fictional',locator:doc.noticeId || doc.id},
      campus:{classId:doc.scope,course:doc.course || '校务公告',lessonDate:doc.lessonDate ||
        (doc.noticeType==='school'?doc.event?.date:undefined),activityId:doc.activity,
        field:doc.field,noticeType:doc.noticeType}}];
  });
}

export function teacherNotices(docs) {
  return docs.map(doc=>{
    if(doc.kind!=='campus') return doc;
    const {kind,campus,...source}=doc;
    return {...source,course:campus.course,field:campus.field,lessonDate:campus.lessonDate,
      noticeType:campus.noticeType || (campus.lessonDate?'course':'assignment'),
      activity:campus.activityId || `${campus.course}-${campus.lessonDate}`,
      event:{date:campus.lessonDate,time:campus.field==='time'?doc.value:undefined,
        place:campus.field==='room'||campus.field==='channel'?doc.value:undefined,
        action:campus.field==='task'?doc.value:undefined}};
  });
}
