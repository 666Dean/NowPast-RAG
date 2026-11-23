// Independent event declarations produce the expected records. No tested engine imports.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const rows=[];
for(const seed of config.seeds){
 let state=seed>>>0;const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
 const classId=`软工${next()%7+3}班`,course=`软件工程${next()%9+1}`,other=`信息安全${next()%9+1}`,room='D'+(next()%500+100),room2='E'+(next()%500+100),published=config.published;
 const expected=(c,day,field,value,assignment)=>({course:c,classId,lessonDate:day || null,assignment:assignment || null,field,value,published,effective:published});
 const add=(scenario,text,clauses)=>rows.push({id:`s${seed}-${scenario}`,synthetic:true,scenario,input:{title:'虚构课程安排',scope:classId,published,text},expected:{pending:false,clauses}});
 add('same-room-different-lessons',`即日起，${classId}《${course}》11月23日教室改为${room}。${classId}《${course}》11月24日教室改为${room}。`,[expected(course,'2026-11-23','room',room),expected(course,'2026-11-24','room',room)]);
 add('same-room-different-courses',`即日起，${classId}《${course}》11月23日教室改为${room}。${classId}《${other}》11月24日教室改为${room}。`,[expected(course,'2026-11-23','room',room),expected(other,'2026-11-24','room',room)]);
 add('same-deadline-different-assignments',`即日起，${classId}《${course}》作业一截止时间顺延至11月28日18:00。${classId}《${course}》作业二截止时间顺延至11月28日18:00。`,[expected(course,null,'deadline','11月28日18:00','作业一'),expected(course,null,'deadline','11月28日18:00','作业二')]);
 add('seven-lessons','即日起，'+Array.from({length:7},(_,i)=>`${classId}《${course}》11月${i+20}日教室改为F${i+401}。`).join(''),Array.from({length:7},(_,i)=>expected(course,`2026-11-${i+20}`,'room',`F${i+401}`)));
 add('omitted-month',`即日起，${classId}《${course}》11月23日教室改为${room}。${classId}《${course}》24日教室改为${room2}。`,[expected(course,'2026-11-23','room',room),expected(course,'2026-11-24','room',room2)]);
 add('change-with-unchanged-time',`即日起，${classId}《${course}》11月23日教室改为${room}，时间仍是08:00—09:40，其余安排不变。`,[expected(course,'2026-11-23','room',room)]);
}
for(const [scenario,text] of [['missing-course-and-date','27日改B204。'],['rumor','同学说计科2班《数据库》11月27日教室改为B204，是否属实待确认。'],['unresolved-place','计科2班《数据库》11月27日照常，地点另行通知。']])rows.push({id:scenario,synthetic:true,scenario,input:{title:'虚构待核信息',scope:'计科2班',published:config.published,text},expected:{pending:true,clauses:[]}});
const bytes=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
writeFileSync(new URL('./fixtures.jsonl',import.meta.url),bytes);
writeFileSync(new URL('./manifest.json',import.meta.url),JSON.stringify({purpose:config.purpose,synthetic:true,seeds:config.seeds,n:rows.length,sha256:createHash('sha256').update(bytes).digest('hex'),gold:'independent explicitly declared events, no answer/snapshot/parser imports',generatorSha256:createHash('sha256').update(readFileSync(new URL('./fixtures.mjs',import.meta.url))).digest('hex'),configurationSha256:createHash('sha256').update(readFileSync(new URL('./config.json',import.meta.url))).digest('hex')},null,2)+'\n');
console.log('Wrote',rows.length,'development cases');
