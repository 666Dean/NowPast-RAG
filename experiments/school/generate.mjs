import {readFileSync,writeFileSync,mkdirSync,symlinkSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),parent=new URL('../',root);
const base=JSON.parse(readFileSync(new URL('config.json',parent)));
const config={...base,version:'campus-school-supplement-v1',generationSamples:30,sampleScenePrefix:'school-',schoolWorlds:10,schoolQuestionsPerWorld:100};
mkdirSync(new URL('data/',root),{recursive:true});mkdirSync(new URL('results/',root),{recursive:true});
if(!existsSync(new URL('cache',root))) symlinkSync('../cache',new URL('cache',root));
writeFileSync(new URL('config.json',root),JSON.stringify(config,null,2)+'\n');
const sha=x=>createHash('sha256').update(x).digest('hex'),datasets=[];
const day=n=>new Date(Date.parse('2027-01-01T00:00:00Z')+n*86400000).toISOString().slice(0,10);
for(const seed of config.seeds){
  const baseBytes=readFileSync(new URL(`data/seed-${seed}.json.gz`,parent));
  const data=JSON.parse(gunzipSync(baseBytes));
  for(let w=0;w<config.schoolWorlds;w++){
    const world=`school-s${seed}-w${w}`,lessonDate=day(w),activityId='校务公告-'+lessonDate;
    function notice(suffix,value,published,old=[]){
      const id=world+'-'+suffix,changed=old.length>0,text=`全校《校务公告》${lessonDate}公告，自${published}起开放时段${changed?'改至':'安排为'}${value}${changed?'；替代旧安排【'+old[0].id+'】':''}。`;
      const d={kind:'campus',id,title:`虚构图书馆${w}开放公告-${suffix}`,scope:'全校',topic:`校务公告·${activityId}·service`,published,effective:published,imported:published,
        value,text,excerpt:text,aliases:[],supersedes:old.map(d=>d.id),campus:{course:'校务公告',classId:'全校',lessonDate,activityId,field:'service',noticeType:'school'},source:{type:'fictional',locator:id}};
      data.docs.push(d);return d;
    }
    const old=notice('old','09:00–12:00 暂停开放','2026-11-20'),current=notice('new','10:00–12:00 暂停开放','2026-11-25',[old]);
    const pending=notice('pending','暂停开放','2026-11-26',[current]);
    for(let i=0;i<config.schoolQuestionsPerWorld;i++){
      const type=i%5,before=type===0,missing=type===2,noTime=type===3,oldTitle=type===4,asOf=before?'2026-11-24':noTime?'2026-11-26':'2026-11-25',d=before?old:noTime?pending:current;
      data.questions.push({id:world+'-q'+i,world,split:'test',scene:before?'school-before':missing?'school-missing-fee':noTime?'school-missing-time':oldTitle?'school-old-title':'school-change',question:`${oldTitle?'我拿着《'+old.title+'》写的09:00–12:00安排，现在呢？':''}截至${asOf}，${lessonDate}图书馆公告如何安排${missing?'，需要多少钱':noTime?'，几点开始':''}？我在星河${seed}班。`,
        asOf,lessonDate,activityId,classId:`星河${seed}班`,course:'校务公告',fields:missing?['service','fee']:noTime?['service','time']:['service'],gold:[{id:d.id,field:'service',value:d.value}],oldIds:before?[]:noTime?[current.id,old.id]:[old.id]});
    }
  }
  const bytes=gzipSync(JSON.stringify(data),{mtime:0}),file=`seed-${seed}.json.gz`;writeFileSync(new URL('data/'+file,root),bytes);
  datasets.push({seed,file,sha256:sha(bytes),baseDatasetSha256:sha(baseBytes),notices:data.docs.length,questions:data.questions.length,testQuestions:data.questions.filter(q=>q.split==='test').length});
}
writeFileSync(new URL('freeze.json',root),JSON.stringify({configSha256:sha(readFileSync(new URL('config.json',root))),generatorSha256:sha(readFileSync(import.meta.filename)),datasets},null,2)+'\n');
console.log(datasets);
