# 校务临时调课引擎 · Issue #12

## 基础与范围

依赖 PR #10 的评审修复提交 `bdd2a8f`。校务功能分支为 `codex/campus-notices-engine`，比较基准为 `codex/rag-engine-retrieval-model`。任务书采用固定版本 d5e7a988 的 CAMPUS-NOTICES.md。页面、本校公开材料和独立评测由组长负责。

实现使用 knowledge、temporal、qa、service，沿用 generation 的受约束选句。原 GNP seed、answer 调用与 /api/generate 请求继续可用。新增入口为 `POST /api/query`，支持直接取结构化证据回答。

## 两个日期和字段

```json
{
  "domain": "campus",
  "question": "2班周五数据库课几点、在哪上？",
  "asOf": "2026-11-25",
  "lessonDate": "2026-11-27",
  "classId": "计科2班",
  "course": "数据库"
}
```

请求还需 `docs`，可直接导入 `knowledge/campus-data.mjs` 的 campusSeed。离线使用 `answer(campusSeed, question, options)`，传入相同选项即可。

asOf 表示截至哪天已公布的信息，lessonDate 表示课次。date 可作为 asOf 的兼容别名。教学班、课程与课次使用显式参数，由页面核对后提供。问题文字识别所问字段，也可用 `fields:["room","time"]` 明确选择。主问法即使只写“周五”，也由 lessonDate 明确落到具体课次。

每条资料为一个可独立替换的字段。campus 元数据含 classId、course、lessonDate、field，字段为 room、time、fee、contact。scope 与 classId 一致。通知的 published 控制可见性，effective 对照课次日期。一份 25 日公布、27 日适用的调整，在 25 日问 27 日课程时即为该课次的有效依据。

替代边必须属于同班、同课程、同课次、同字段。调整教室只替代 room，time 沿用原课表。下周课程有独立课表条目，临时通知的适用课次精确限定到 27 日。

## 运行结果

| 查询 | 教室值与依据 | 时间值与依据 |
|---|---|---|
| asOf=11/24，2班，lessonDate=11/27 | A301 · S2-2026-11-27-room | 08:00–09:40 · S2-2026-11-27-time |
| asOf=11/25，同一课次 | B204 · N25-room | 同上原时间条款 |
| asOf=11/25，1班，11/27 | A301 · S1-2026-11-27-room | 原1班课表时间 |
| asOf=11/25，2班，12/04 | A301 · S2-2026-12-04-room | 下周原课表时间 |
| asOf=11/26，两份并行通知 | B204/C105 · N25-room、N26-room，conflict | 原课表时间 |
| 同日加入明确澄清 | B204 · N26-clear | 原课表时间 |

同一日的并行与澄清场景通过不同资料集表示录入前后，不推断日内签发先后。按小时追溯需要后续增加时间精度。

## 响应与网页联调

手动测试入口为 `/test-campus`，启动本地服务后可直接打开。它提供公布前后、换班、下周、冲突、澄清和费用七个场景，允许修改日期与问题，展开各字段的原文依据，并复制请求和实际响应。页面位于 service/manual-test.html、manual-test.mjs，使用同一 /api/query，供开发验收和用户试用。资料均标为虚构。

`service/validation/campus-examples.json` 提供三组完整 `{path,request,response}`，请求已包含可直接 POST 的 docs。三组分别是已公布调整、当前冲突和地点有据但费用缺证。

响应保留 status、label、summary、sections、items、research、date、scope，并增加 domain、asOf、lessonDate、classId、course、fields。fields.room 与 fields.time 各含 status、values、evidence。每个 evidence 包含 role 和完整 doc，原文在 doc.text，定位在 doc.source.locator，资料编号在 doc.id。

有效查询通过 /api/query 返回 HTTP 200，业务状态 ok、conflict 或 unknown。部分缺证时已知字段继续返回，缺证字段 values 和 evidence 为空。/api/generate 接收相同参数，证据不足返回 422，模型缺失返回 503，成功仍为 `{model,text,citations}`。主答案可经 /api/query 使用，模型用于选句。

并行通知的原句在冲突 section 中同时展示。具有明确替代边的澄清出现后，该字段更新为新依据，旧记录在 history 中保留。只在资料提供 contact 字段且原文含值时返回联系人。

## 虚构与公开资料

本轮所有校务资料均为开发者自编虚构示例，逐条标记 `source.type="fictional"`。本轮收集的真实公开校务通知为 0 条。

未来组长录入真实公开资料时，标为 `source.type="public"`，附 source.url 和可定位的 source.locator。校验器要求 URL 与原文定位，字段 value 必须逐字出现在 text。演示资料与真实资料由各自来源标签识别。

## 验收

```sh
node service/verify-delivery.mjs
NOWPAST_MODEL_HOME=/path/to/models node service/verify-delivery.mjs --model
```

指定受验源码使用 `--ref <commit>`，例如 `node service/verify-delivery.mjs --ref HEAD --model`，模型缓存变量须同样设置。报告 source.mode=commit 时，从该提交导出源码执行。工作区模式记录 dirty、状态和补丁摘要。source.files、sourceDigest 覆盖运行源码、模型/服务入口、测试与页面模块；modelArtifacts 记录实际权重和运行程序摘要。

本地实现受验提交为 d74c276，对应 GitHub 功能源码提交 `96d5d045fa55dcdfa7d712a04e904e6da1972f43`。逐一核对报告中的 25 个可执行输入与 GitHub tree 的 blob 散列，全部一致。PR #10 修复亦核对 21 个输入，全部一致。映射和源码集合摘要在 service/validation/published-source.json。报告 service/validation/delivery-check.json 附指定提交模式的实际命令、平台和完整 API 返回；campus-no-model.json 保存关闭模型的单独运行结果。默认 `node service/verify-delivery.mjs` 的工作区模式也已实际通过，报告明确显示 dirty 和工作区补丁状态。

结果分列如下。

- 冻结评测当前依据 38/38、GNP 角色 9/9、研究来源 4/4、原行为 22/22。
- GNP 开发回归 18/18，包含本轮日期区间、并列费用、逐元素与金额正例。
- 校务开发用例 10/10，见 qa/campus.test.mjs。
- HTTP 校务查询覆盖公布前后、班级、下周、冲突、澄清、缺证；无模型运行总计 12 项响应，开模型运行 17 项。
- macOS arm64、Node v26.13.0，Qwen2.5-0.5B-Instruct Q4_K_M 实测旧 GNP 三次与校务两次推理。每条引用在相同 ID 原文中逐字核验，校务时间引用原课表，冲突双方均保留。

## 剩余工作

组长接入页面、准备本校公开案例和未公开问题做独立评测。Windows 对本轮新校务功能的实机模型复测仍待执行。当前采用人工确认的原子字段与替代边，尚未自动从长通知抽取这些结构。实体名称精确匹配，星期几由显式 lessonDate 确定。运行记录属于开发验收。
