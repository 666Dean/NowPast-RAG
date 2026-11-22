# 组长本地接入契约

工作在 `codex/campus-engine-integration`，不 push、不合并远端 main。页面沿用 PR #14。现有 `answer(docs, question, options)`、`POST /api/query`、`POST /api/generate`、`POST /api/notices/analyze` 都保留。新模块的浏览器静态路由已添加，并有逐模块依赖测试。

## 查询

课次：`{domain:'campus',asOf:'2026-11-25',lessonDate:'2026-11-27',classId:'计科2班',course:'数据库',question:'什么时候、在哪上？',docs}`。

作业：以稳定 `activityId:'数据库-作业一'` 代替课次；可显式 `fields:['task','deadline','channel']`。截止日是 deadline 的值，不是作业身份。学校公告传 `course:'校务公告'`、公告活动日期和 `fields:['service']`；`全校` 来源可供其他班级查询。

`asOf` 是截至哪天本地已经知道的资料：公布、导入都不得晚于该日。`lessonDate` 是问哪一天的课。生效晚于课次的要求不可用；已公布且将在课前生效的调整可以用于未来课次。原 GNP 的旧时间接口维持冻结语义。日期或课次/作业身份不明确时返回 unknown，不猜下一周或另一份作业。

响应保留 `status,label,summary,sections,items`，校务另有 `fields`。每个字段都有独立 `status,values,evidence`。整体 conflict 不代表所有字段都有证据；任一所问字段 unknown，`/api/generate` 就返回 422 与 `missing` 字段列表。`/api/query` 仍返回双方冲突原句及费用缺证。直接调用 `generate` 也执行同一缺证检查。

原文引用在 `items[].doc`：稳定 id、title、published、text、excerpt、source；旧通知经 supersedes/relations 引用具体旧 id。前端继续用现有原文抽屉打开对应记录。新旧格式读取适配不重新编号、不修改原始文本。

## 教师原文发布

仍只提供 title、text、published、scope 以及已有 docs，不要求教师手填 topic、value、字段或旧通知。明确的标准语句走保守原文语法路径；其他文体调用现有本地模型。返回的每个 value 必须在同一 quote 和 text 中，关联按课程、班级、课次/作业、字段、公布时点核验。无关时允许空关联；没有明确变更授权的不同值只作为并行材料。

现有浏览器数据无需迁移：教师记录经 `canonicalNotices` 只在读取时转换；校务记录经 `teacherNotices` 可供原文分析匹配，保留 ID 和来源。新课程生成的 topic 包含具体课次或作业，防止页面按主题查快照时混入另一课次。

## 给组长的调用位置

`web/app.mjs` 的问答 `answer` 调用、模型 `/api/generate` 调用、教师 `/api/notices/analyze` 调用及 `executionFor` 调用均保留。若页面要改为服务端统一快照，只需由组长在问答调用中传上述 domain/asOf/lessonDate/activityId；课程卡片可消费同样 fields。动态新增班级的筛选控件由组长接入，后端已支持未见班级。不在主页面加入解析或算法解释。

完整真实 HTTP 请求和响应由 `node service/integration-probes.mjs` 产生，保存于 `service/validation/local-integration-api.json`。原失败前后结果和真实模型整理输出在 experiments/results。所有新增案例均为虚构演示数据。
