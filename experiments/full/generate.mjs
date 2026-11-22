import {readFileSync,writeFileSync,mkdirSync,existsSync,symlinkSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),base=new URL('../',root),school=new URL('../school/',root);
const json=(r,p)=>JSON.parse(readFileSync(new URL(p,r))),load=(r,p)=>JSON.parse(gunzipSync(readFileSync(new URL(p,r))));
const hash=b=>createHash('sha256').update(b).digest('hex');
const mainSamples=json(base,'generation-sample.json').samples,schoolSamples=json(school,'generation-sample.json').samples,samples=[...mainSamples,...schoolSamples];
const keep=new Set(samples.map(s=>s.id)),config={...json(base,'config.json'),version:'deduplicated-campus-school-v1',worlds:70,generationSamples:samples.length};
mkdirSync(new URL('data/',root),{recursive:true});mkdirSync(new URL('results/',root),{recursive:true});
if(!existsSync(new URL('cache',root))) symlinkSync('../cache',new URL('cache',root));
writeFileSync(new URL('config.json',root),JSON.stringify(config,null,2)+'\n');
const devPhrases=['请逐项核实依据','请查证适用要求','请提供正式安排','请查询公布版本','请说明相应字段','请复核这一事项','请检查日期范围','请确认班级安排','请核对原文记录','请列明有据要求','请回答资料结论','请据历史资料复核','请检查通知内容','请验证课程条件','请查找对应证据','请提供字段信息','请说明适用安排','请复核公布信息','请查明相应通知','请列出资料依据'];
const testPhrases=['我正准备出发','老师刚发过消息','旧消息还作数吗','这次到底听哪份','我怕走错了','帮我查清楚再说','不确定有没有改动','通知里写清楚了吗','我想按当天规定来','同桌说和之前不一样','我把时间记混了','能帮我看一下吗','这会儿应该怎么做','之前保存的截图还能用吗','我没赶上群里的通知','麻烦再给我确认一下','我看到过两个版本','这回按哪个安排走','明天还照旧吗','请按我这个班看看'];
const frozen=[];
for(const seed of config.seeds){
  const a=load(base,`data/seed-${seed}.json.gz`),b=load(school,`data/seed-${seed}.json.gz`);
  const original=[...a.questions,...b.questions.filter(q=>q.scene.startsWith('school-'))];
  const byWorld=new Map();for(const q of original){const list=byWorld.get(q.world)||[];list.push(q);byWorld.set(q.world,list);}
  const questions=[];
  for(const [world,list] of byWorld){
    const unique=new Map();
    for(const q of list){const old=unique.get(q.question);if(old&&keep.has(old.id)&&keep.has(q.id)&&q.id!==old.id) throw Error('Frozen model sample contains exact duplicates');if(!old||keep.has(q.id))unique.set(q.question,q);}
    const target=world.startsWith('school-')?100:200;
    const checkpoints=[...new Map(list.map(q=>[q.scene,q])).values()],phrases=list[0].split==='dev'?devPhrases:testPhrases;
    for(let i=0;unique.size<target;i++){
      const c=checkpoints[i%checkpoints.length],phrase=phrases[Math.floor(i/checkpoints.length)%phrases.length];
      const question=phrase+'，'+c.question.replace(/^[^：]*：/,''),id=world+'-extra'+i;
      if(!unique.has(question)) unique.set(question,{...c,id,question,checkpointSourceId:c.id});
      if(i>20000)throw Error('Insufficient unique paraphrases');
    }
    questions.push(...unique.values());
  }
  for(const s of samples.filter(s=>s.seed===seed))if(!questions.some(q=>q.id===s.id))throw Error('Lost original sample '+s.id);
  const docs=b.docs.map(d=>({...d,world:d.id.startsWith('school-')?d.id.replace(/-(?:old|new|pending)$/,''):d.id.replace(/-n\d+$/,'')}));
  const worlds=[...a.worlds,...[...byWorld.keys()].filter(w=>w.startsWith('school-')).map(id=>({id,split:'test',course:'校务公告'}))];
  const payload={version:config.version,seed,fictional:true,worlds,docs,questions};
  const bytes=gzipSync(JSON.stringify(payload),{mtime:0}),file=`seed-${seed}.json.gz`;writeFileSync(new URL('data/'+file,root),bytes);
  const test=questions.filter(q=>q.split==='test');
  if(new Set(test.map(q=>q.question)).size<10000)throw Error('Fewer than 10000 unique test questions');
  frozen.push({seed,file,sha256:hash(bytes),notices:docs.length,questions:questions.length,testQuestions:test.length,uniqueTestQuestions:new Set(test.map(q=>q.question)).size,independentTestCheckpoints:new Set(test.map(q=>q.world+'|'+q.scene)).size});
}
const manifest={configSha256:hash(readFileSync(new URL('config.json',root))),generatorSha256:hash(readFileSync(import.meta.filename)),originFreezeSha256:hash(readFileSync(new URL('freeze.json',base))),schoolFreezeSha256:hash(readFileSync(new URL('freeze.json',school))),datasets:frozen};
writeFileSync(new URL('freeze.json',root),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(new URL('generation-sample.json',root),JSON.stringify({freezeSha256:hash(readFileSync(new URL('freeze.json',root))),samples},null,2)+'\n');
console.log(frozen);
