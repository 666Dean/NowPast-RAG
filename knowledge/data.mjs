// Original, fictional teaching records. Each item is one independently replaceable clause.
const topics = {
  format: ['报告格式', '报告交什么格式', '实验报告', '文件格式', '导出格式', '交什么格式', '交 PDF', '交什么文件'],
  materials: ['复现材料', '复现实验', '复现包', '附哪些', '附件', '原始数据', '交哪些材料', '原始记录', '附什么'],
  room: ['验收地点', '去哪验收', '哪里验收', '哪个教室', '机房', '教室', '在哪验收', '答辩地点'],
  channel: ['提交渠道', '在哪提交', '交到哪里', '哪里上传', '提交平台', '往哪交'],
  time: ['截止时间', '几点截止', '最晚', '何时截止', '什么时候交', '哪天交'],
  sample: ['负采样比例', '负采样比', '负样本数', '正负样本比例'],
  fusion: ['融合方式','融合算子','融合口径','怎么融合','如何融合','Hadamard','线性投影','逐元素乘积','拼接'],
  aggregate: ['聚合方式','消息聚合','聚合器','平均消息','取最近消息','mean message'],
  poster: ['海报尺寸', '海报大小', '海报多大']
};
function clause(id, title, published, effective, imported, scope, key, value, text, supersedes = []) {
  const [topic, ...aliases] = topics[key];
  return {id,title,published,effective,imported,scope,topic,value,text,supersedes,aliases};
}
const manual = 'GNP 链路预测复现实验手册 v1.0';
const patch = 'B 组源码复现任务补丁 v1.1';
// Independently written reading notes. URLs are fixed primary-source locators.
// These records are separate from the fictional course event dates below.
const paperUrl = 'https://doi.org/10.1007/978-981-95-7075-1_50';
const implementation = 'https://github.com/for4ever44/GNP/blob/4bc08b4e818f3b70220f7f0234765b32b7fc403d/gnp.v1.0.py';
export const references = [
  {id:'paper-fusion',topic:'融合方式',kind:'论文',title:'GNP §3.2 · 发表页 729',url:paperUrl,
    note:'作者在 Now Module 一节末尾写到，以 Hadamard 乘积结合过去与当前的嵌入。这里指两路表示的融合。'},
  {id:'code-fusion',topic:'融合方式',kind:'源码',title:'GNP.forward · 第 254–260 行',url:implementation+'#L254-L260',
    note:'固定提交的联合分支将归一化的 Past 表示和 Now 输出沿最后一维拼接，然后送入线性输出层。'},
  {id:'paper-aggregate',topic:'聚合方式',kind:'论文',title:'GNP §3.2 · 发表页 728',url:paperUrl,
    note:'论文描述最近批次的节点特征时提到先聚合平均消息，再由 GRU 更新节点记忆。'},
  {id:'code-aggregate',topic:'聚合方式',kind:'源码',title:'Aggregator.forward · 第 117–121 行',url:implementation+'#L117-L121',
    note:'聚合器针对每个索引用时间参数选出最近一条消息，将对应向量写入聚合结果。'},
  {id:'code-sampling',topic:'负采样比例',kind:'源码',title:'数据加载器 · 第 329 行',url:implementation+'#L329',
    note:'创建训练、验证和测试加载器时，负采样比例设置为 1.0，每批采样负例数与正例数对应。'}
];
export const seed = [
  clause('M01',manual,'2026-11-01','2026-11-02','2026-11-02','全班','format','一份 PDF 报告',
    '§2.1 报告格式。每组导出一份 PDF 报告，正文画出 Past、Now 与边预测解码器，注明使用的融合和消息聚合口径。'),
  clause('M02',manual,'2026-11-01','2026-11-02','2026-11-02','全班','materials','实验配置和分支消融记录',
    '§2.2 复现材料。随报告附上实验配置和分支消融记录，在同一数据切分下列出 both、now、past 三种模式。'),
  clause('M03',manual,'2026-11-01','2026-11-02','2026-11-02','全班','room','理工楼 204',
    '§3.1 验收安排。现场验收在理工楼 204，携带运行日志和可供检查的实验环境。'),
  clause('M04',manual,'2026-11-01','2026-11-02','2026-11-02','全班','channel','课程平台「实验三」',
    '§2.3 上传。每组由记录员统一提交到课程平台「实验三」，上传完成后保存回执。'),
  clause('M05',manual,'2026-11-01','2026-11-02','2026-11-02','全班','time','11 月 22 日 17:00',
    '§2.4 截止时间。所有组须在 11 月 22 日 17:00 前完成提交，以平台回执为准。'),
  {...clause('M06',manual,'2026-11-01','2026-11-02','2026-11-02','全班','sample','每个正例配一个负例',
    '§1.3 负采样比例。每个正例配一个负例，与公开脚本的数据加载设置一致。'),refs:['code-sampling']},
  {...clause('F01',manual,'2026-11-01','2026-11-02','2026-11-02','全班','fusion','使用 Hadamard 逐元素乘积',
    '§1.1 融合方式。论文文字复现采用第 3.2 节的口径：使用 Hadamard 逐元素乘积融合 Past 与 Now 表示。请在报告中注明这是本课程选定的实现。'),refs:['paper-fusion']},
  {...clause('G01',manual,'2026-11-01','2026-11-02','2026-11-02','全班','aggregate','先聚合平均消息再更新记忆',
    '§1.2 消息聚合。论文文字复现按第 3.2 节处理最近批次：先聚合平均消息再更新记忆，并记录 GRU 输入。'),refs:['paper-aggregate']},
  clause('B11',patch,'2026-11-07','2026-11-10','2026-11-08','B组','format','PDF 报告和可执行 Notebook',
    '§1 源码组报告。自 11 月 10 日起，B 组提交 PDF 报告和可执行 Notebook，取代手册 §2.1 的单文件要求。',['M01']),
  clause('B12',patch,'2026-11-07','2026-11-10','2026-11-08','B组','materials','提交号、环境锁定文件和逐次运行日志',
    '§2 复现包。B 组改附提交号、环境锁定文件和逐次运行日志，日志分别记录验证 AP 和 ROC AUC。此条替代手册 §2.2。',['M02']),
  {...clause('B13',patch,'2026-11-07','2026-11-10','2026-11-08','B组','fusion','拼接 Past 与 Now 后做线性投影',
    '§3 源码组融合方式。B 组改按固定提交的联合分支复现：将 Past 表示归一化，拼接 Past 与 Now 后做线性投影。此条替代手册 §1.1；A 组继续采用论文文字口径。',['F01']),refs:['code-fusion']},
  {...clause('B14',patch,'2026-11-07','2026-11-10','2026-11-08','B组','aggregate','选择时间最近的消息再更新记忆',
    '§4 源码组消息聚合。对同一节点，选择时间最近的消息再更新记忆，以固定提交的 Aggregator 为准。此条替代手册 §1.2。',['G01']),refs:['code-aggregate']},
  clause('R21','课程组 · 现场验收排班','2026-11-10','2026-11-11','2026-11-10','B组','room','工程楼 305',
    '§4 调整。B 组验收改至工程楼 305，替代手册 §3.1；其余组按原安排。',['M03']),
  clause('R22','实验中心 · 设备场地分配','2026-11-11','2026-11-11','2026-11-11','B组','room','科学楼 108',
    '§3 场地。B 组验收改在科学楼 108，原手册 §3.1 对 B 组停止适用。',['M03']),
  clause('R30','课程组与实验中心联合澄清','2026-11-15','2026-11-14','2026-11-17','B组','room','科学楼 108',
    '§1 签发澄清。两份安排源于复现工作站迁移后排班未同步。经双方确认，B 组自 11 月 14 日起统一到科学楼 108 验收，本条同时取代两份场地安排。',['R21','R22']),
  clause('T40','全班提交时限补充通知','2026-11-18','2026-11-19','2026-11-18','全班','time','11 月 23 日 12:00',
    '§1 平台维护。全班截止时间顺延至 11 月 23 日 12:00，替代手册 §2.4。提交渠道沿用手册。',['M05']),
  clause('U50','展示海报草案（未署日期）','','','2026-11-13','全班','poster','A2 横版',
    '草案 §1 建议采用 A2 横版。此页尚无签发日期与执行时间。')
];
