import {validDay,campusFields} from '../knowledge/schema.mjs';
import {campusSnapshot} from '../temporal/campus.mjs';
import {canonicalNotices} from '../knowledge/notice-adapter.mjs';
const names={room:'上课教室',time:'上课时间',fee:'费用',contact:'联系人',task:'提交内容',deadline:'作业截止',channel:'提交平台',service:'公告事项'};

function requestedFields(question,assignment=false) {
  const fields=[];
  if(/教室|在哪|哪里|地点|还在|去哪|[A-Z]\d{3}/i.test(question)) fields.push(assignment?'channel':'room');
  if(/几点|时间|几时|何时|什么时候|第几节|几号|截止/.test(question)) fields.push(assignment?'deadline':'time');
  if(assignment && /交什么|交些什么|内容|要求|做什么/.test(question)) fields.push('task');
  if(assignment && /平台|往哪交/.test(question)) fields.push('channel');
  if(/费用|多少钱|多少元|几元|报销|收费/.test(question)) fields.push('fee');
  if(/联系|找谁|负责人/.test(question)) fields.push('contact');
  return fields;
}

export function answerCampus(docs,question,options) {
  if(options.compareAsOf){
    const dates=[options.asOf || options.date,options.compareAsOf];
    const snapshots=dates.map(asOf=>answerCampus(docs,question,{...options,asOf,compareAsOf:undefined}));
    return {...snapshots[1],comparison:{dates,snapshots},summary:snapshots.map(s=>s.summary).join('\n\n')};
  }
  const asOf=options.asOf || options.date;
  const {lessonDate,classId,course}=options;
  const activityId=options.activityId || options.activity;
  docs=canonicalNotices(docs);
  const base={domain:'campus',asOf,date:asOf,lessonDate,activityId,classId,scope:classId,course,research:[],items:[],sections:[],fields:{}};
  if(!validDay(asOf) || !(validDay(lessonDate) || activityId) || !classId || !course) {
    return {...base,status:'unknown',label:'查询条件不足',summary:'请分别提供查询时点 asOf、课次日期 lessonDate、教学班 classId 和课程 course。'};
  }
  const assignment=!!activityId && docs.some(d=>d.campus.activityId===activityId && d.campus.noticeType==='assignment');
  const fields=options.fields || requestedFields(question,assignment);
  if(!Array.isArray(fields) || !fields.length || fields.some(field=>!campusFields.includes(field))) {
    return {...base,status:'unknown',label:'查询字段不足',summary:'请指定要查证的教室、上课时间、费用或联系人。'};
  }
  const sections=[...new Set(fields)].map(field=>{
    let snapshot=campusSnapshot(docs,{asOf,lessonDate,activityId,classId,course},field);
    if(field==='time' && course==='校务公告' && !snapshot.current.length){
      // Resolve the service graph first: a withdrawn service time must not revive
      // an old clock merely because the new announcement omits a clock value.
      const service=campusSnapshot(docs,{asOf,lessonDate,activityId,classId,course},'service');
      const project=rows=>rows.flatMap(doc=>{
        const value=doc.value.match(/\d{1,2}[:：]\d{2}(?:\s*[–—-]\s*\d{1,2}[:：]\d{2})?/)?.[0];
        return value && doc.text.includes(value)?[{...doc,value,excerpt:doc.text,campus:{...doc.campus,field:'time'},derivedFrom:'service'}]:[];
      });
      snapshot={current:project(service.current),past:project(service.past),uncertain:project(service.uncertain),errors:service.errors || []};
    }
    const values=[...new Set(snapshot.current.map(doc=>doc.value))];
    const status=values.length>1?'conflict':values.length?'ok':'unknown';
    const items=snapshot.current.map(doc=>({doc,role:status==='conflict'?'冲突依据':'当前依据'}));
    if(options.history!==false) items.push(...snapshot.past.map(doc=>({doc,role:'已被替代'})));
    items.push(...snapshot.uncertain.map(doc=>({doc,role:'时间待核'})));
    items.push(...(snapshot.withdrawn || []).map(doc=>({doc,role:'撤销依据'})));
    const summary=status==='unknown'?`${names[field]}缺少截至 ${asOf} 可核查的依据。`:
      status==='conflict'?`${names[field]}存在冲突：`+snapshot.current.map(doc=>`${doc.value} [${doc.id}] 原句：${doc.text}`).join('；'):
      `${names[field]}：${values[0]} `+snapshot.current.map(doc=>`[${doc.id}]`).join(' ');
    return {field,topic:names[field],scope:classId,status,label:{ok:'有据可查',conflict:'材料冲突',unknown:'证据不足'}[status],values,
      summary:snapshot.errors?.length?'关系数据未通过核验，请确认原通知。':summary,items,validationErrors:snapshot.errors || []};
  });
  const status=['conflict','unknown','ok'].find(state=>sections.some(section=>section.status===state));
  const items=[...new Map(sections.flatMap(section=>section.items).map(item=>[item.doc.id,item])).values()];
  return {...base,status,label:{ok:'有据可查',conflict:'材料冲突',unknown:'证据不足'}[status],sections,items,
    fields:Object.fromEntries(sections.map(section=>[section.field,{status:section.status,values:section.values,evidence:section.items}])),
    summary:`截至 ${asOf}，${classId} ${lessonDate || activityId} ${course}：\n`+sections.map(section=>section.summary).join('\n')};
}
