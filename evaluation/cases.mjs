// Fixed manual labels derived from the fictitious source texts, before the first run.
// A document can be relevant and still be the wrong *current* evidence.
function item(id, question, day, scope, gold, topics, collection = 'course') {
  return {id,question,date:'2026-11-'+day,scope,gold,topics,collection};
}
export const currentCases = [
  item('C01','报告格式是什么？','06','B组',['M01'],['报告格式']),
  item('C02','离线组的报告交什么格式？','08','B组',['M01'],['报告格式']),
  item('C03','请告诉我实验报告的文件格式','10','B组',['B11'],['报告格式']),
  item('C04','要附什么复现材料？','17','A组',['M02'],['复现材料']),
  item('C05','要附哪些复现材料？','17','B组',['B12'],['复现材料']),
  item('C06','现在去哪验收？','10','B组',['M03'],['验收地点']),
  item('C07','设备搬走以后，去哪验收？','11','B组',['R21','R22'],['验收地点']),
  item('C08','验收地点还存在哪些说法？','14','B组',['R21','R22'],['验收地点']),
  item('C09','验收地点现在定在哪里？','15','B组',['R30'],['验收地点']),
  item('C10','为什么验收地点出现过两种说法？','18','B组',['R30'],['验收地点']),
  item('C11','全班分别去哪验收？','16','全班',['M03','R30'],['验收地点']),
  item('C12','同一天，A组和B组交什么格式？','16','全班',['M01','B11'],['报告格式']),
  item('C13','截止时间最晚到什么时候？','18','A组',['M05'],['截止时间']),
  item('C14','B组什么时候交？','19','B组',['T40'],['截止时间']),
  item('C15','负采样比例是多少？','20','B组',['M06'],['负采样比例']),
  item('C16','报告格式、复现材料和验收地点分别怎么安排？','12','B组',['B11','B12','R21','R22'],['报告格式','复现材料','验收地点']),
  item('C17','平台维护后交到哪里，几点截止？','20','A组',['M04','T40'],['提交渠道','截止时间']),
  item('C18','我抄的是工程楼 305，现在还去那里吗？','20','B组',['R30'],['验收地点']),
  item('C19','旧条款 M02 今天还适用吗？','20','B组',['B12'],['复现材料']),
  item('C20','从哪里上传，报告交什么格式？','20','B组',['M04','B11'],['提交渠道','报告格式']),
  item('C21','日期选择器先填今天。2026年11月6日的实验报告怎么交？','06','B组',['M01'],['报告格式']),
  item('C22','负采样比例及截止时间？','20','B组',['M06','T40'],['负采样比例','截止时间']),
  item('X01','数据移交名称是什么？','03','B组',['X01'],['移交代号'],'archive'),
  item('X02','我还在用北辰匣，现行叫法是什么？','20','B组',['X03'],['移交代号'],'archive'),
  item('X03','请根据旧条款 X02 帮我确定现行安排。','20','B组',['X03'],['移交代号'],'archive'),
  item('X04','A组也要更新移交代号吗？','20','A组',['X01'],['移交代号'],'archive'),
  item('X05','交接柜号和移交代号？','20','B组',['X03','X04','X05'],['交接柜号','移交代号'],'archive'),
  item('X06','小组交接时用的那个盒子，现在大家怎么称呼它？','20','B组',['X03'],['移交代号'],'archive'),
  item('X07','盘应该放在哪个格子？','20','B组',['X04','X05'],['交接柜号'],'archive'),
];

// Manual GNP labels use course records for effective requirements and primary
// sources for research claims. Tuples fix section scope, evidence role and ID.
function gnp(id, question, day, scope, gold, topics, evidence) {
  return {...item(id,question,day,scope,gold,topics),suite:'gnp',queryDate:'2026-11-20',evidence};
}
export const gnpCases = [
  gnp('GNP01','11月6日全班用哪种融合算子？','06','全班',['F01'],['融合方式'],[
    ['全班','当前依据','F01']]),
  gnp('GNP02','11月6日全班怎么做消息聚合？','06','全班',['G01'],['聚合方式'],[
    ['全班','当前依据','G01']]),
  gnp('GNP03','B 组 11 月 7 日该用什么融合方式？','07','B组',['F01'],['融合方式'],[
    ['B组','当前依据','F01'],['B组','已公布待生效','B13']]),
  gnp('GNP04','B 组 11 月 7 日该用什么聚合器？','07','B组',['G01'],['聚合方式'],[
    ['B组','当前依据','G01'],['B组','已公布待生效','B14']]),
  gnp('GNP05','11月10日 A 组和 B 组怎么融合？','10','全班',['F01','B13'],['融合方式'],[
    ['A组','当前依据','F01'],['B组','当前依据','B13'],['B组','已被替代','F01']]),
  gnp('GNP06','11月10日全班的消息聚合要求分别是什么？','10','全班',['G01','B14'],['聚合方式'],[
    ['A组','当前依据','G01'],['B组','当前依据','B14'],['B组','已被替代','G01']]),
  gnp('GNP07','11月6日和11月10日，B组的融合方式和消息聚合有何变化？','10','B组',['B13','B14'],['融合方式','聚合方式'],[
    ['B组','前一日期','F01'],['B组','前一日期','G01'],['B组','后一日期','B13'],['B组','后一日期','B14']]),
  gnp('GNP08','11月6日和11月10日，A组的融合方式和消息聚合有何变化？','10','A组',['F01','G01'],['融合方式','聚合方式'],[
    ['A组','前一日期','F01'],['A组','前一日期','G01'],['A组','后一日期','F01'],['A组','后一日期','G01']]),
  gnp('GNP09','B组今天还按 F01 和 G01 复现吗？','20','B组',['B13','B14'],['融合方式','聚合方式'],[
    ['B组','当前依据','B13'],['B组','当前依据','B14'],['B组','已被替代','F01'],['B组','已被替代','G01']])
];

export const gnpClauseGold = {
  F01:{refs:['paper-fusion'],value:/Hadamard.*逐元素乘积/},
  G01:{refs:['paper-aggregate'],value:/平均消息.*更新记忆/},
  B13:{refs:['code-fusion'],value:/拼接.*Past.*Now.*线性投影/},
  B14:{refs:['code-aggregate'],value:/时间最近的消息.*更新记忆/}
};

export const researchCases = [
  {id:'GNPS01', question:'论文和源码的融合方式有什么差异？', gold:['paper-fusion','code-fusion']},
  {id:'GNPS02', question:'论文和源码的聚合方式有什么差异？', gold:['paper-aggregate','code-aggregate']},
  {id:'GNPS03', question:'Hadamard 融合方式在论文哪一节？', gold:['paper-fusion']},
  {id:'GNPS04', question:'源码中消息聚合的实现在哪里？', gold:['code-aggregate']}
];

// An independently authored holdout micro-corpus. X01 → X02 → X03 renames a
// handoff container twice, but the tracked subject ("移交代号") remains constant.
function file(id, title, topic, value, text, scope, day, supersedes = [], aliases = []) {
  const date = '2026-11-'+day;
  return {id,title,topic,value,text,scope,published:date,effective:date,imported:date,supersedes,aliases};
}
export const archive = [
  file('X01','田野录音归档规程','移交代号','北辰匣','保存访谈录音的介质盒在交接单登记为北辰匣。','全班','01',[],['数据移交名称']),
  file('X02','B 组交接单修订','移交代号','山雀盒','B 组改为登记山雀盒。其余队沿用原规程。','B组','06',['X01']),
  file('X03','清点组命名更新','移交代号','白鹭盒','B 组的新交接单统一填写白鹭盒，替换上次命名。','B组','12',['X02']),
  file('X04','楼层值班本','交接柜号','甲柜 17','将 B 组硬盘放入甲柜 17，由值班员签收。','B组','08'),
  file('X05','库房钥匙登记','交接柜号','乙柜 03','B 组把封存介质投放到乙柜 03。未注明替换关系。','B组','09'),
  file('X06','保管期限说明','保存周期','三个学期','所有原始音轨至少留存三个学期。','全班','02')
];
