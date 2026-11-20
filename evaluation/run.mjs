import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {seed} from '../knowledge/data.mjs';
import {answer} from '../qa/answer.mjs';
import {lexicalRank} from '../retrieval/rank.mjs';
import {validateDocument} from '../knowledge/schema.mjs';
import {archive, currentCases, gnpCases, gnpClauseGold, researchCases} from './cases.mjs';

const collections = {course:seed,archive};
const unique = xs => [...new Set(xs)];
const currentRoles = ['当前依据','冲突依据','后一日期'];
const select = (response, roles) => unique(response.sections.flatMap(s => s.items).filter(e => roles.includes(e.role)).map(e => e.doc.id));
function equal(a,b) {
  return a.length === b.length && a.every(x => b.includes(x));
}
function setScore(actual, gold) {
  const hits = actual.filter(id=>gold.includes(id)).length;
  return {exact:Number(equal(actual,gold)),f1:2*hits/(actual.length+gold.length)};
}
function eligible(d, t, group) {
  return d.published && d.effective && d.published <= t.date && d.effective <= t.date &&
    (group === '全班' || d.scope === '全班' || d.scope === group);
}
// The latest-only comparator receives the correct semantic topics and same query time/scope.
// It picks one announced+effective clause per topic per actual group; competing
// evidence cannot be detected just from an ordering by release time.
function latest(docs,t) {
  const groups = t.scope === '全班' ? ['A组','B组'] : [t.scope];
  return unique(t.topics.flatMap(topic => groups.flatMap(g => {
    const options = docs.filter(d => eligible(d,t,g) && d.topic === topic);
    options.sort((a,b) => b.published.localeCompare(a.published) || b.effective.localeCompare(a.effective) || a.id.localeCompare(b.id));
    return options.length ? [options[0].id] : [];
  })));
}
function evaluate(t) {
  const docs = collections[t.collection];
  const opts = {date:t.queryDate || t.date,scope:t.scope};
  const result = answer(docs,t.question,opts);
  const without = answer(docs,t.question,{...opts,history:false});
  const ranked = lexicalRank(docs.filter(d=>eligible(d,t,t.scope)),t.question);
  const outputs = {
    BM25:ranked.filter(r=>r.score>0).map(r=>r.doc.id),
    Latest:latest(docs,t),
    Now:select(without,currentRoles),
    NowPast:select(result,currentRoles)
  };
  const evidence = result.sections.flatMap(s=>s.items.map(e=>({scope:s.scope,role:e.role,id:e.doc.id,value:e.doc.value,refs:e.doc.refs || []})));
  const references = result.research || [];
  const gnp = t.evidence && {
    actual:evidence,
    references:references.map(r=>r.id),
    exact:result.date===t.date && result.scope===t.scope && result.sections.every(s=>s.status!=='unknown') &&
      !result.researchOnly && equal(references.map(r=>r.id),unique(evidence.flatMap(e=>e.refs))) && references.every(matchesReference) &&
      equal(evidence.map(e=>[e.scope,e.role,e.id].join('|')),t.evidence.map(e=>e.join('|'))) && evidence.every(e=>{
        const clause = gnpClauseGold[e.id];
        return clause && equal(e.refs,clause.refs) && clause.value.test(e.value);
      })
  };
  return {...t, scores:Object.fromEntries(Object.entries(outputs).map(([method,all]) => {
    const predicted = all.slice(0,t.gold.length);
    return [method,{predicted,...setScore(predicted,t.gold)}];
  })), unbounded:outputs.NowPast, unboundedExact:equal(outputs.NowPast,t.gold),gnp};
}

const paperDoi = 'https://doi.org/10.1007/978-981-95-7075-1_50';
const implementation = 'https://github.com/for4ever44/GNP/blob/4bc08b4e818f3b70220f7f0234765b32b7fc403d/gnp.v1.0.py';
const referenceGold = {
  'paper-fusion': {kind:'论文',topic:'融合方式',page:729,note:/Hadamard.*结合.*过去与当前/},
  'paper-aggregate': {kind:'论文',topic:'聚合方式',page:728,note:/平均消息.*GRU.*更新/},
  'code-fusion': {kind:'源码',topic:'融合方式',lines:[258,260],note:/归一化.*拼接.*线性/},
  'code-aggregate': {kind:'源码',topic:'聚合方式',lines:[119,121],note:/每个索引.*最近一条消息/}
};
function matchesReference(result) {
  const gold = referenceGold[result.id];
  if (!gold || result.kind!==gold.kind || result.topic!==gold.topic || !gold.note.test(result.note)) return false;
  if (gold.page) return result.url===paperDoi && result.title.includes('3.2') && result.title.includes(String(gold.page));
  if (!result.url.startsWith(implementation+'#')) return false;
  const range = result.url.slice(implementation.length).match(/^#L(\d+)-L(\d+)$/);
  return Boolean(range && Number(range[1])<=gold.lines[0] && Number(range[2])>=gold.lines[1]);
}
function evaluateResearch(test) {
  const result = answer(seed,test.question,{date:'2026-11-20',scope:'全班'});
  const actual = result.research || [];
  const ids = actual.map(r=>r.id);
  return {...test,actual,score:setScore(ids,test.gold),pass:result.status==='ok' && result.researchOnly===true && !result.items.length && !result.sections.length &&
    equal(ids,test.gold) && actual.every(matchesReference)};
}

const more = {id:'LOCAL1',title:'临时晚间复核单',topic:'验收地点',value:'创新楼 701',text:'晚间调整：B 组改到创新楼 701，覆盖前两份场地通知。',scope:'B组',published:'2026-11-13',effective:'2026-11-13',imported:'2026-11-14',supersedes:['R21','R22'],aliases:[]};
const q = (text,date='2026-11-20',scope='B组',docs=seed,extra={}) => answer(docs,text,{date,scope,...extra});
function behavior(name, test) {
  try { return {name,pass:Boolean(test())}; }
  catch (error) { return {name,pass:false,error:error.message}; }
}
const behaviorTests = [
  behavior('通知公布前不可引用 B11',()=>!q('报告格式','2026-11-06').items.some(i=>i.doc.id==='B11')),
  behavior('11/07 已公布但待生效，B11 导入时间是 11/08',()=>equal(select(q('报告格式','2026-11-07'),['已公布待生效']),['B11'])),
  behavior('11/14 不得用尚未公布的追溯澄清',()=>q('验收地点','2026-11-14').status==='conflict' && !q('验收地点','2026-11-14').items.some(i=>i.doc.id==='R30')),
  behavior('11/15 恢复当时已公布的 R30，即使系统 11/17 才导入',()=>equal(select(q('验收地点','2026-11-15'),currentRoles),['R30'])),
  behavior('当日未署日期草案尚未导入，不能回填',()=>q('海报尺寸','2026-11-12').items.length===0),
  behavior('未署日期草案展示为待核并拒绝裁定',()=>q('海报尺寸','2026-11-13').status==='unknown' && equal(select(q('海报尺寸','2026-11-13'),['时间待核']),['U50'])),
  behavior('没有依据的费用问题应当拒答',()=>q('电池采购能报销多少元？').status==='unknown'),
  behavior('提及已知报告但实际问评分，应拒绝给出格式作为答案',()=>q('实验报告能加几分？').status==='unknown'),
  behavior('混合已知主题和缺失主题，逐项提示缺少报销依据',()=>{ const a=q('报告格式是什么，电池能报销多少？'); return a.summary.includes('报销') && /不足|缺|未知|无法/.test(a.summary) && select(a,currentRoles).includes('B11'); }),
  behavior('并行冲突时没有原文说明则拒绝推断原因',()=>q('验收地点为何不同？','2026-11-12').summary.includes('尚未交代原因')),
  behavior('澄清签发后能提取明确原因和引用',()=>q('验收地点为何不同？').summary.includes('复现工作站迁移后排班未同步') && q('验收地点为何不同？').summary.includes('[R30]')),
  behavior('两时点分别保留当时的冲突与后来的裁定',()=>{const a=q('11月12日与11月18日验收地点有什么变化？');return equal(select(a,['前一日期']),['R21','R22']) && equal(select(a,['后一日期']),['R30']);}),
  behavior('历史链包含两条并行替代与更早手册',()=>equal(select(q('验收地点变化？'),['已被替代']),['M03','R21','R22'])),
  behavior('关闭历史检索时不展示替代链',()=>!select(q('验收地点变化？',undefined,'B组',seed,{history:false}),['已被替代']).length),
  behavior('人工新增澄清后当前回答改变，A 组隔离',()=>{validateDocument(more,seed); const corpus=[...seed,more]; return equal(select(q('验收地点','2026-11-13','B组',corpus),currentRoles),['LOCAL1']) && equal(select(q('验收地点','2026-11-13','A组',corpus),currentRoles),['M03']);}),
  behavior('相同材料移除明确替代边后必须保留冲突',()=>{const corpus=[...seed,{...more,supersedes:[]}]; return q('验收地点','2026-11-13','B组',corpus).status==='conflict' && equal(select(q('验收地点','2026-11-13','B组',corpus),currentRoles),['R21','R22','LOCAL1']);}),
  behavior('已导入新通知与随后签发的原有澄清未指明互相替换，须保留新冲突',()=>equal(select(q('验收地点','2026-11-20','B组',[...seed,more]),currentRoles),['LOCAL1','R30'])),
  behavior('跨主题替代关系被拒绝',()=>{try {validateDocument({...more,supersedes:['M06']},seed);}catch{return true;}return false;}),
  behavior('独立归档库按两跳前身还原命名更迭',()=>equal(select(q('移交代号改了什么？',undefined,'B组',archive),['已被替代']),['X01','X02'])),
  behavior('无效日历日期返回不确定',()=>q('2026年11月31日去哪验收？').status==='unknown'),
  behavior('新导入的 B 组融合修订单只更新已经生效的 B 组要求',()=>{
    const update = {id:'LOCAL2',title:'B 组融合复核单',topic:'融合方式',value:'恢复 Hadamard 逐元素乘积',
      text:'B 组恢复 Hadamard 逐元素乘积，替代 B13。',scope:'B组',published:'2026-11-17',
      effective:'2026-11-19',imported:'2026-11-18',supersedes:['B13'],aliases:[],refs:['paper-fusion']};
    validateDocument(update,seed);
    const corpus = [...seed,update];
    const before = q('融合方式','2026-11-18','B组',corpus);
    const after = q('融合方式','2026-11-19','B组',corpus);
    return equal(select(before,currentRoles),['B13']) && equal(select(before,['已公布待生效']),['LOCAL2']) &&
      equal(select(after,currentRoles),['LOCAL2']) && equal(select(after,['已被替代']),['B13','F01']) &&
      equal(select(q('融合方式','2026-11-19','A组',corpus),currentRoles),['F01']);
  }),
  behavior('导入融合条款时拒绝跨主题挂接聚合依据',()=>{
    try {validateDocument({...seed.find(d=>d.id==='B13'),id:'LOCAL3',refs:['code-aggregate']},seed);}
    catch {return true;}
    return false;
  })
];
const rows = [...currentCases,...gnpCases].map(evaluate);
const researchRows = researchCases.map(evaluateResearch);
const methods = ['BM25','Latest','Now','NowPast'];
const avg = (xs) => (100*xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(1)+'%';
function metricLine(key,group) {
  const part = rows.filter(group);
  return methods.map(m=>`| ${key} | ${m} | ${part.length} | ${part.reduce((a,r)=>a+r.scores[m].exact,0)}/${part.length} | ${avg(part.map(r=>r.scores[m].f1))} |`).join('\n');
}
const digest = file => createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex').slice(0,16);
const results = {
  inputs:Object.fromEntries(['../knowledge/data.mjs','../knowledge/schema.mjs','../temporal/graph.mjs','../retrieval/rank.mjs','../qa/answer.mjs','./cases.mjs','./run.mjs'].map(f=>[f,digest(f)])),
  rows,researchRows,behaviorTests
};
const failureRows = rows.filter(r=>!r.scores.NowPast.exact || !r.unboundedExact);
const behaviorFailures = behaviorTests.filter(r=>!r.pass);
const gnpRows = rows.filter(r=>r.gnp);
const gnpFailures = gnpRows.filter(r=>!r.gnp.exact);
const showIds = ids => ids.join('、') || '空';
const report = [
  '# 时知 · GNP 复现实验资料的检索与版本判断评测',
  '## 方法',
  '在仓库根目录执行 `node evaluation/run.mjs`，更新同目录的 `REPORT.md` 和 `results.json`。运行使用固定日期和本地资料。题目、手写金标和独立归档资料在 [cases.mjs](cases.mjs)，逐题预测及输入文件散列在 [results.json](results.json)。',
  '当前依据的对照表覆盖 22 道课程通用题、9 道 GNP 课程条款题和 7 道独立归档题。另有 4 道论文与源码定位题，以及 22 项边界和更新验收。GNP 新题由验收智能体根据已定的案例日期和原始资料，在运行前手写金标。标注者可查看引擎，属于非盲评测，尚未取得任课教师或学生的独立标注。课程通知和归档材料为虚构资料。归档资料是另写的微型语料，包含两次更名和并行冲突。课程条款经过人工拆分，明确的替代边由资料维护者录入。',
  '各方法最多返回 k 条当前证据，k 取该题金标数量，因此各方法都预先知道答案条数上限。完全匹配要求预测 ID 集合与金标一致。每题集合 F1 等于交集大小的两倍除以两个集合大小之和，表中取逐题平均。日期待核、已被替代和待生效条款由后续角色验收检查。双日期题在对照表中按后一日期的当前依据计分，前一日期由 GNP 证据角色验收检查。',
  'BM25 在日期和组别符合要求的已公布、已生效候选中，用中文二元字串和英文词对标题、主题、别名及原文排序。Latest 预先得到金标主题，为每个主题和适用组取公布时间最近的条款，同日按生效日和 ID 排序。两种对照只使用查询日和组别元数据。Now 关闭历史词条召回和历史引用，仍按生效日期、组别及替代关系计算当前条款。NowPast 使用完整引擎。Now 和 NowPast 都从问题识别主题。全班题对 A、B 两组的当前证据取并集。',
  '## 当前依据集合',
  '| 资料集 | 方法 | 题数 | 完全匹配 | 平均集合 F1 |\n|---|---|---:|---:|---:|\n'+[
    metricLine('课程通用',r=>r.collection==='course' && !r.gnp),metricLine('GNP 课程条款',r=>r.gnp),
    metricLine('独立归档',r=>r.collection==='archive'),metricLine('合计',()=>true)].join('\n'),
  '完整引擎不限返回预算时，当前依据集合完全匹配 '+rows.filter(r=>r.unboundedExact).length+'/'+rows.length+'。'+(failureRows.length?'集合错误如下。\n\n'+failureRows.map(r=>'- '+r.id+'「'+r.question+'」期望 '+showIds(r.gold)+'。预算内实际为 '+showIds(r.scores.NowPast.predicted)+'，完整返回为 '+showIds(r.unbounded)+'。').join('\n'):'全部一致。'),
  '## GNP 条款角色与原始依据',
  'GNP 课程条款题逐题检查组别、日期、证据角色、条款值关键词、关联引用 ID 与定位字段。整题通过 '+(gnpRows.length-gnpFailures.length)+'/'+gnpRows.length+'。'+
    (gnpFailures.length?'失败题号为 '+showIds(gnpFailures.map(r=>r.id))+'，实际证据见 `results.json`。':''),
  '原始依据题的引用集合完全匹配 '+researchRows.filter(r=>r.score.exact).length+'/'+researchRows.length+'，平均集合 F1 为 '+avg(researchRows.map(r=>r.score.f1))+'。同时核对来源类型、主题、论文节号与发表页、固定提交与行号、技术描述关键词，以及纯研究问题的证据区是否仅呈现研究资料。整题通过 '+researchRows.filter(r=>r.pass).length+'/'+researchRows.length+'。',
  researchRows.map(r=>'- '+(r.pass?'通过':'未通过')+' · '+r.id+'「'+r.question+'」期望 '+showIds(r.gold)+'，实际为 '+showIds(r.actual.map(ref=>ref.id))+'。').join('\n'),
  '融合依据来自论文 §3.2 发表页 729，以及公开脚本联合分支的拼接和线性输出层。聚合依据来自论文 §3.2 发表页 728，以及公开脚本的 `Aggregator`。该聚合器按索引选择最大时间戳对应的消息。评测执行使用这些已核对的定位。 [论文出版页](https://link.springer.com/chapter/10.1007/978-981-95-7075-1_50)、[固定提交的融合实现]('+implementation+'#L249-L260)、[固定提交的聚合实现]('+implementation+'#L117-L129)',
  '## 历史通道增减与局限',
  '开启历史后完全匹配从失败变成功的题号为 '+(rows.filter(r=>r.scores.NowPast.exact&&!r.scores.Now.exact).map(r=>r.id).join('、')||'无')+'；从成功变失败的题号为 '+(rows.filter(r=>!r.scores.NowPast.exact&&r.scores.Now.exact).map(r=>r.id).join('、')||'无')+'。只有测试中以退役线索提问的部分直接测到历史内容检索的价值，当前事实检索的大量共同正确项不能归因于它。',
  'C08 中 B 组有两条互相冲突的场地通知，且新澄清尚未公布。只选最近一次公示会得到其中一条。C18 则从退役地点“工程楼 305”发问，需要定位历史事件并沿同主题的替代图恢复当前澄清。独立资料 X06、X07 使用口语改写；获得正确主题的 Latest 即使只覆盖了冲突中的一个柜号仍可获得部分 F1，而词面方法可能完全漏召回。这解释了完全匹配数与平均 F1 排序可以不同。',
  '## 边界与更新验收',
  '原评测首轮引擎 SHA-256 前 16 位为 `056872fb3215a0a7`，通过 18/20 项。两项失败为“实验报告能加几分”被误答为格式要求，以及“报告格式＋电池报销”漏掉未知子问题。GNP 新题首轮引擎 SHA-256 前 16 位为 `101fccc727d18b05`，通过 8/9 道课程条款题。GNP08 把单独的日期片段关联到截止时间 M05，返回了多余证据。上述问题已反馈给开发者，复跑结果用于验证回归。',
  '通过 '+(behaviorTests.length-behaviorFailures.length)+'/'+behaviorTests.length+' 项。\n\n'+behaviorTests.map(r=>'- '+(r.pass?'通过':'未通过')+' · '+r.name).join('\n'),
  '## 解释范围',
  '题目规模较小，样本特意覆盖变更、生效边界、并行冲突、组别差异和旧线索，结果反映这些构造场景的检索和归属判断。已知主题的 Latest 在单一、顺序修订的条款上表现良好。词面检索依赖别名和用词，语义等价的改写可能漏答，多条等价的文字表述需要人工归一条款值。此次评测范围为问答证据选择、引用定位和版本规则。真实课程部署、盲测用户体验、泛化统计显著性，以及 GNP 的训练、模型指标复现与数据集表现均待另行实证。'
].join('\n\n')+'\n';
writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
writeFileSync(new URL('./REPORT.md',import.meta.url),report);
console.log(metricLine('总体',()=>true));
console.log('GNP 证据角色通过',gnpRows.length-gnpFailures.length,'/',gnpRows.length);
console.log('研究依据通过',researchRows.filter(r=>r.pass).length,'/',researchRows.length);
console.log('行为通过',behaviorTests.length-behaviorFailures.length,'/',behaviorTests.length);
for (const r of behaviorFailures) console.log('未通过',r.name);
