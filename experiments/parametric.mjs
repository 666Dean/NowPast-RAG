// Independent configurable event generator for small debugging / stress variants.
// The frozen main experiment deliberately keeps its original registered scenarios.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),cfg=JSON.parse(readFileSync(process.argv[2] || new URL('debug-config.json',root)));
for(const key of ['worlds','coursesPerWorld','classesPerWorld','lessonsPerCourse','assignmentsPerCourse','versions','questionsPerWorld']) if(!Number.isInteger(cfg[key])||cfg[key]<1||cfg[key]>10000) throw Error('Invalid '+key);
if(!(cfg.distractorRatio>=0 && cfg.distractorRatio<=10)) throw Error('Invalid distractorRatio');
if(cfg.versions>60) throw Error('Debug variants support at most 60 versions before the registered 2027 lessons.');
const out=new URL(process.argv[3] || './data/debug/',root);mkdirSync(out,{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex'),manifest=[];
for(const seed of cfg.seeds){
  let state=seed>>>0;const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
  const docs=[],questions=[],worlds=[];
  for(let w=0;w<cfg.worlds;w++){
    const world=`p${seed}-w${w}`,checkpoints=[];let count=0;
    for(let c=0;c<cfg.coursesPerWorld;c++) for(let cl=0;cl<cfg.classesPerWorld;cl++){
      const course=`虚构课程${seed}-${w}-${c}`,classId=`虚构${seed*10000+w*100+cl}班`;
      function add(activity,field,value,day,version,previous){
        const id=world+'-n'+(++count),lessonDate=activity.startsWith('作业')?undefined:day,activityId=course+'-'+activity;
        const published=new Date(Date.UTC(2026,10,1+version)).toISOString().slice(0,10);
        const names={room:'教室',time:'上课时间',task:'提交内容',channel:'提交平台',deadline:'截止时间'};
        const text=`${classId}《${course}》${lessonDate?lessonDate+'课程':activity}，自${published}起${names[field]}${previous?'改至':'安排为'}${value}${previous?'；替代旧安排【'+previous.id+'】':''}。`;
        const d={kind:'campus',id,title:'虚构参数通知'+id,text,value,published,effective:published,imported:published,scope:classId,topic:course+'·'+activityId+'·'+field,
          supersedes:previous?[previous.id]:[],aliases:[],campus:{course,classId,lessonDate,activityId,field,noticeType:lessonDate?'course':'assignment'},source:{type:'fictional',locator:id}};
        docs.push(d);return d;
      }
      for(let l=0;l<cfg.lessonsPerCourse;l++){
        const day=new Date(Date.UTC(2027,0,1+l*7)).toISOString().slice(0,10),time=add(day,'time','08:00–09:40',day,0);
        let previous;const history=[];
        for(let v=0;v<cfg.versions;v++){
          const room=add(day,'room',String.fromCharCode(65+Math.floor(random()*8))+(100+Math.floor(random()*899)),day,v,previous);
          if(previous) history.unshift(previous.id);
          checkpoints.push({asOf:room.published,lessonDate:day,activityId:course+'-'+day,classId,course,fields:['room','time'],gold:[room,time].map(d=>({id:d.id,field:d.campus.field,value:d.value})),oldIds:[...history]});
          previous=room;
        }
      }
      for(let a=0;a<cfg.assignmentsPerCourse;a++){
        const activity='作业'+(a+1),task=add(activity,'task','提交设计报告',null,0),channel=add(activity,'channel','云课堂平台',null,0);let previous;
        const history=[];
        for(let v=0;v<cfg.versions;v++){
          const due=add(activity,'deadline',new Date(Date.UTC(2027,1,1+v)).toISOString().slice(0,10)+' 18:00',null,v,previous);
          if(previous) history.unshift(previous.id);
          checkpoints.push({asOf:due.published,activityId:course+'-'+activity,classId,course,fields:['task','channel','deadline'],gold:[task,channel,due].map(d=>({id:d.id,field:d.campus.field,value:d.value})),oldIds:[...history]});previous=due;
        }
      }
    }
    const n=Math.floor(count*cfg.distractorRatio);
    for(let j=0;j<n;j++){
      const template=docs.find(d=>d.id.startsWith(world+'-'));
      const id=world+'-d'+j,scope=`干扰${seed*1000+j}班`;
      docs.push({...template,id,title:'虚构干扰'+id,scope,supersedes:[],text:template.text.replace(template.scope,scope),campus:{...template.campus,classId:scope},source:{type:'fictional',locator:id}});
    }
    for(let i=0;i<cfg.questionsPerWorld;i++){
      const c=checkpoints[i%checkpoints.length];questions.push({id:world+'-q'+i,world,split:w%5===0?'dev':'test',scene:c.fields.includes('deadline')?'parametric-assignment':'parametric-lesson',
        question:`截至${c.asOf}，${c.classId}《${c.course}》${c.lessonDate || c.activityId}的${c.fields.join('、')}是什么？`,...c});
    }
    worlds.push({id:world,checkpoints:checkpoints.length});
  }
  const bytes=gzipSync(JSON.stringify({seed,fictional:true,config:cfg,worlds,docs,questions}),{mtime:0}),file=`seed-${seed}.json.gz`;writeFileSync(new URL(file,out),bytes);
  manifest.push({seed,file,sha256:digest(bytes),notices:docs.length,questions:questions.length});
}
writeFileSync(new URL('manifest.json',out),JSON.stringify({config:cfg,datasets:manifest},null,2));console.log(manifest);
