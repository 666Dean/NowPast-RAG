import {validDay,campusFields} from '../knowledge/schema.mjs';
import {campusSnapshot} from '../temporal/campus.mjs';
const names={room:'上课教室',time:'上课时间',fee:'费用',contact:'联系人'};

function requestedFields(question) {
  const fields=[];
  if(/教室|在哪|哪里|地点|还在|去哪|[A-Z]\d{3}/i.test(question)) fields.push('room');
  if(/几点|时间|几时|何时|第几节/.test(question)) fields.push('time');
  if(/费用|多少钱|多少元|几元|报销|收费/.test(question)) fields.push('fee');
  if(/联系|找谁|负责人/.test(question)) fields.push('contact');
  return fields;
}

export function answerCampus(docs,question,options) {
  const asOf=options.asOf || options.date;
  const {lessonDate,classId,course}=options;
  const base={domain:'campus',asOf,date:asOf,lessonDate,classId,scope:classId,course,research:[],items:[],sections:[],fields:{}};
  if(!validDay(asOf) || !validDay(lessonDate) || !classId || !course) {
    return {...base,status:'unknown',label:'查询条件不足',summary:'请分别提供查询时点 asOf、课次日期 lessonDate、教学班 classId 和课程 course。'};
  }
  const fields=options.fields || requestedFields(question);
  if(!Array.isArray(fields) || !fields.length || fields.some(field=>!campusFields.includes(field))) {
    return {...base,status:'unknown',label:'查询字段不足',summary:'请指定要查证的教室、上课时间、费用或联系人。'};
  }
  const sections=[...new Set(fields)].map(field=>{
    const snapshot=campusSnapshot(docs,{asOf,lessonDate,classId,course},field);
    const values=[...new Set(snapshot.current.map(doc=>doc.value))];
    const status=values.length>1?'conflict':values.length?'ok':'unknown';
    const items=snapshot.current.map(doc=>({doc,role:status==='conflict'?'冲突依据':'当前依据'}));
    if(options.history!==false) items.push(...snapshot.past.map(doc=>({doc,role:'已被替代'})));
    items.push(...snapshot.uncertain.map(doc=>({doc,role:'时间待核'})));
    const summary=status==='unknown'?`${names[field]}缺少截至 ${asOf} 可核查的依据。`:
      status==='conflict'?`${names[field]}存在冲突：`+snapshot.current.map(doc=>`${doc.value} [${doc.id}] 原句：${doc.text}`).join('；'):
      `${names[field]}：${values[0]} `+snapshot.current.map(doc=>`[${doc.id}]`).join(' ');
    return {field,topic:names[field],scope:classId,status,label:{ok:'有据可查',conflict:'材料冲突',unknown:'证据不足'}[status],values,summary,items};
  });
  const status=['conflict','unknown','ok'].find(state=>sections.some(section=>section.status===state));
  const items=[...new Map(sections.flatMap(section=>section.items).map(item=>[item.doc.id,item])).values()];
  return {...base,status,label:{ok:'有据可查',conflict:'材料冲突',unknown:'证据不足'}[status],sections,items,
    fields:Object.fromEntries(sections.map(section=>[section.field,{status:section.status,values:section.values,evidence:section.items}])),
    summary:`截至 ${asOf}，${classId} ${lessonDate} ${course}：\n`+sections.map(section=>section.summary).join('\n')};
}
