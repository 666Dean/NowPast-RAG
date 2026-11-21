// Entirely fictional development fixtures. These are not real school notices.
function clause(id, classId, lessonDate, field, value, text, published, supersedes=[], sourceId='schedule') {
  return {kind:'campus',id,title:sourceId==='schedule'?'虚构原课表':'虚构调课通知',
    topic:{room:'上课教室',time:'上课时间',fee:'费用',contact:'联系人'}[field],value,text,
    scope:classId,published,effective:lessonDate,imported:published,supersedes,aliases:[],
    campus:{course:'数据库',classId,lessonDate,field},
    source:{type:'fictional',id:sourceId,locator:sourceId==='schedule'?`${classId} / ${lessonDate} 课表行`:'通知第1段'}};
}
export const campusSchedule = ['计科1班','计科2班'].flatMap((classId,index)=>['2026-11-27','2026-12-04'].flatMap(day=>{
  const prefix=`S${index+1}-${day}`;
  const text=`虚构课表：${classId}${day}数据库课，教室 A301，上课时间 08:00–09:40。`;
  return [clause(prefix+'-room',classId,day,'room','A301',text,'2026-11-01'),
    clause(prefix+'-time',classId,day,'time','08:00–09:40',text,'2026-11-01')];
}));
export const campusAdjustment = clause('N25-room','计科2班','2026-11-27','room','B204',
  '虚构通知：计科2班2026-11-27数据库课由 A301 调整到 B204，仅调整教室。',
  '2026-11-25',['S2-2026-11-27-room'],'adjustment');
export const campusConflict = clause('N26-room','计科2班','2026-11-27','room','C105',
  '虚构通知：计科2班2026-11-27数据库课教室为 C105。联系教务值班室。',
  '2026-11-26',['S2-2026-11-27-room'],'parallel-notice');
export const campusClarification = clause('N26-clear','计科2班','2026-11-27','room','B204',
  '虚构澄清：计科2班2026-11-27数据库课以 B204 为准，本通知明确取代两份调课通知。',
  '2026-11-26',['N25-room','N26-room'],'clarification');
export const campusContact = clause('N26-contact','计科2班','2026-11-27','contact','教务值班室',
  campusConflict.text,'2026-11-26',[],'parallel-notice');
export const campusSeed = [...campusSchedule,campusAdjustment];
export const campusConflictSeed = [...campusSeed,campusConflict,campusContact];
export const campusClarifiedSeed = [...campusConflictSeed,campusClarification];
