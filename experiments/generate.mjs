import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('./',import.meta.url);
const config=JSON.parse(readFileSync(new URL('config.json',root)));
const sha=x=>createHash('sha256').update(x).digest('hex');
const dir=new URL('data/',root);mkdirSync(dir,{recursive:true});
const plus=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const frozen=[];
for(const seed of config.seeds){
  const random=rng(seed),docs=[],questions=[],worlds=[];
  for(let w=0;w<config.worlds;w++){
    const split=w<config.developmentWorlds?'dev':'test',world=`s${seed}-w${w}`;
    const course=(split==='dev'?'基础原理':'交互系统')+`研习${seed}号${w}`;
    const classId=(split==='dev'?'先行':'星河')+`${seed*100+w}班`;
    const checks=[];let serial=0;
    const room=()=>String.fromCharCode(65+Math.floor(random()*8))+(100+Math.floor(random()*800));
    const scope2=classId.replace('班','1班');
    function add(scene,field,value,{old=[],lessonDate='2026-12-10',activity,scope=classId,published='2026-11-01',effective='2026-11-01',imported=published,kind='original'}={}){
      const id=world+'-n'+(++serial),assignment=activity?.startsWith('作业'),activityId=assignment?course+'-'+activity:course+'-'+lessonDate;
      const context=`${scope}《${course}》${assignment?activity:lessonDate+'课程'}`;
      const fieldName={room:'教室',time:'上课时间',deadline:'截止时间',task:'提交内容',channel:'提交平台',fee:'费用'}[field];
      const wording=split==='dev'?{original:'为',replace:'调整为',parallel:'另外通知为',clarify:'现澄清统一为'}:{original:'安排为',replace:'改至',parallel:'独立安排为',clarify:'两份安排澄清为'};
      const references=old.length?`；${kind==='clarify'?'同时取代两份通知':kind==='parallel'?'本安排取代原安排':'替代旧安排'}${old.map(x=>`【${x.id}】`).join('、')}`:'';
      const text=`${context}，自${effective}起${fieldName}${wording[kind]}${value}${references}。`;
      const d={kind:'campus',id,title:`虚构${world}${scene}通知${serial}`,topic:course+'·'+activityId+'·'+field,scope,published,effective,imported,value,text,aliases:[],supersedes:old.map(x=>x.id),
        campus:{course,classId:scope,lessonDate:assignment?undefined:lessonDate,activityId,field,noticeType:assignment?'assignment':'course'},source:{type:'fictional',locator:`虚构星河学院/${id}`},excerpt:text};
      docs.push(d);return d;
    }
    function check(scene,rows,{asOf='2026-11-25',lessonDate=rows[0]?.campus.lessonDate || '2026-12-10',activityId=rows[0]?.campus.activityId,fields=rows.map(x=>x.campus.field),scope=classId,expected=rows,history=[]}={}){
      checks.push({scene,asOf,lessonDate,activityId,classId:scope,course,fields:[...new Set(fields)],gold:expected.map(x=>({id:x.id,field:x.campus.field,value:x.value})),oldIds:history.map(x=>x.id)});
    }
    let original=add('普通','room',room());const time=add('普通','time','08:00–09:40');
    check('normal',[original,time],{asOf:'2026-11-20'});
    const moved=add('调教室','room',room(),{old:[original],published:'2026-11-25',kind:'replace'});
    check('room-before',[original,time],{asOf:'2026-11-24'});
    check('room-change',[moved,time],{history:[original]});
    const timed=add('调时间','time','10:00–11:40',{old:[time],published:'2026-11-26',kind:'replace'});
    check('time-change',[moved,timed],{asOf:'2026-11-26',history:[original,time]});
    const chain=add('再次换室','room',room(),{old:[moved],published:'2026-11-27',kind:'replace'});
    check('replacement-chain',[chain,timed],{asOf:'2026-11-27',history:[moved,original,time]});
    const alt=add('并行','room',room(),{old:[moved],published:'2026-11-28',kind:'parallel'});
    check('conflict',[chain,alt],{asOf:'2026-11-28',history:[moved,original]});
    check('conflict-missing-fee',[chain,alt],{asOf:'2026-11-28',fields:['room','fee'],history:[moved,original]});
    const clear=add('澄清','room',room(),{old:[chain,alt],published:'2026-11-29',kind:'clarify'});
    check('clarification',[clear],{asOf:'2026-11-29',history:[chain,alt,moved,original]});
    const assignment='作业一',task=add('作业','task','完成设计报告',{activity:assignment}),channel=add('作业','channel','云课堂平台',{activity:assignment}),due=add('作业','deadline','2026-12-01 18:00',{activity:assignment});
    const extended=add('延期','deadline','2026-12-03 20:00',{activity:assignment,old:[due],published:'2026-11-25',kind:'replace'});
    check('homework-extension',[task,channel,extended],{lessonDate:undefined,history:[due]});
    check('missing-fee',[original],{asOf:'2026-11-24',fields:['fee'],expected:[]});
    // Independent checkpoints below explicitly register the expected state; no engine imports.
    const retro0=add('追溯','room',room(),{lessonDate:'2026-11-27'});
    const retro=add('追溯','room',room(),{lessonDate:'2026-11-27',old:[retro0],published:'2026-11-28',effective:'2026-11-26',kind:'replace'});
    check('retroactive-before',[retro0],{asOf:'2026-11-27'});check('retroactive-after',[retro],{asOf:'2026-11-28',history:[retro0]});
    const late0=add('晚公布','time','14:00–15:40',{lessonDate:'2026-11-29'});
    const late=add('晚公布','time','16:00–17:40',{lessonDate:'2026-11-29',old:[late0],published:'2026-11-30',effective:'2026-11-29',kind:'replace'});
    check('late-publication',[late0],{asOf:'2026-11-29'});check('late-publication-after',[late],{asOf:'2026-11-30',history:[late0]});
    const import0=add('晚导入','room',room(),{lessonDate:'2026-12-02'});
    const imported=add('晚导入','room',room(),{lessonDate:'2026-12-02',old:[import0],published:'2026-11-26',effective:'2026-11-26',imported:'2026-11-29',kind:'replace'});
    check('late-import-before',[import0],{asOf:'2026-11-28'});check('late-import-after',[imported],{asOf:'2026-11-29',history:[import0]});
    const other=add('跨班','room',room(),{scope:scope2});
    add('跨班','room',room(),{scope:scope2,old:[other],published:'2026-11-25',kind:'replace'});
    check('cross-class',[original],{asOf:'2026-11-24'});
    const next=add('隔周','room',room(),{lessonDate:'2026-12-17'});
    check('different-lesson',[next]);
    const two=add('不同作业','deadline','2026-12-06 20:00',{activity:'作业二'});
    check('different-assignment',[two]);
    const future=add('未来生效','time','13:00–14:40',{lessonDate:'2026-12-04',published:'2026-11-25',effective:'2026-12-05'});
    check('not-effective',[future],{fields:['time'],expected:[]});
    const planned0=add('已公布未来课','room',room(),{lessonDate:'2026-12-06'});
    const planned=add('已公布未来课','room',room(),{lessonDate:'2026-12-06',old:[planned0],published:'2026-11-25',effective:'2026-12-05',kind:'replace'});
    check('announced-future-lesson',[planned],{history:[planned0]});
    for(let i=0;i<config.questionsPerWorld;i++){
      const c=checks[i%checks.length];
      const words=split==='dev'?['请核实','请查证','告诉我安排','查询依据']:['我记不清了','这回怎么安排呀','同学说改过了','我拿着旧截图'];
      const names={room:'在哪上',time:'什么时候上',deadline:'几号几点交',task:'交些什么',channel:'往哪交',fee:'要交多少钱'};
      const question=`${words[Math.floor(i/checks.length)%words.length]}：截至${c.asOf}，${classId}《${course}》${c.activityId?.endsWith('作业一')?'作业一':c.activityId?.endsWith('作业二')?'作业二':c.lessonDate+'的课'}，${c.fields.map(f=>names[f]).join('、')}？`;
      questions.push({id:world+'-q'+i,world,split,question,...c});
    }
    worlds.push({id:world,split,course,classId,registeredCheckpoints:checks.length});
  }
  const payload=JSON.stringify({version:config.version,seed,fictional:true,worlds,docs,questions});
  const bytes=gzipSync(payload,{mtime:0});const name=`seed-${seed}.json.gz`;writeFileSync(new URL(name,dir),bytes);
  frozen.push({seed,file:name,sha256:sha(bytes),notices:docs.length,questions:questions.length,testQuestions:questions.filter(x=>x.split==='test').length});
}
const manifest={configSha256:sha(readFileSync(new URL('config.json',root))),generatorSha256:sha(readFileSync(new URL('generate.mjs',root))),createdAt:new Date().toISOString(),generatorCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),datasets:frozen};
writeFileSync(new URL('freeze.json',root),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
