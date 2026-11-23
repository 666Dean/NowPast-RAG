# 2026-11-23 本地续跑交付

本轮已修复模型运行与原文入口的程序问题，并恢复旧兼容入口。新版自由原文入口仍未验收通过；不能称为已经完成正式领域模型。没有训练新权重、推送、合并或部署。

受验源码：`5fc19e4`（完整 SHA 见 V2-VALIDATION.json），分支 `codex/qwen-adaptation-local`。此前修复提交为 `5393b29`、`489a7c6`。报告提交可以晚于受验源码；报告不把自己的提交冒充受验提交。

## 影响范围与兼容

修改 generation 的 MLX 推理、通知解析及校验，training 的输入封装、开发探针与只读审计。调用链为 `/api/notices/analyze → analyzeNotice → structuredCompletion → MLX worker`；`/api/generate` 仍使用原选句入口。answer、/api/query、旧浏览器数据和教师完整原文流程保留，未修改网页和冻结金标。

新版仍需 `NOWPAST_INTAKE_V2=1` 明确开启。默认重复惩罚为 1；开发试验 1.1 没有变成默认值，也没有逐题挑参数。公开请求、响应结构没有改动。模型不完整、无依据或重复时继续返回失败，教师原文可以保留。

## 实际修复

1. 旧 worker 先套聊天模板，再把字符串交给 Outlines，库又套一次模板。改为传 `Chat(messages)`，真实 tokenizer 与库适配器单测证明只套一次。解码 schema 不再整段塞进语言提示，避免模型复述结构。
2. 大的嵌套字符串/数组上界导致约束编译困难。仅在解码器副本移除大上界，原 schema 的 80 条及字符串长度限制仍由服务核验。没有截取模型输出前缀当成功结果。
3. 所用 outlines-core 会优先处理与 oneOf 并列的 type，实际绕过分支约束。改为根节点只有 oneOf；真实解码器回归确认“空 clauses + pending=false”和“非空 clauses + pending=true”均不能生成，服务也独立拒绝。
4. 明确新值完整性、重复条款、字段归属和同源引用在写入前检查。教室原句不能作为费用；七项通知不能只发布前六项。
5. 旧入口也移除六项硬上限，改为最多 80 项和按输入规模设定输出预算。七条完整模拟结果能原子发布，六条结果会整份拒绝；这不等于真实模型已能理解七条。
6. 关联编号数量以实际候选数为上限，声明唯一性，并在服务拒绝重复编号。原来只有一个候选也允许输出十二个编号，放大了重复生成问题。
7. 无歧义“即日起”的生效日期限定为公布日，不能混成后续课次日或截止日；有其他显式/相对生效期时不强行套用这一提示。
8. 探针增加实际源码逐文件摘要、参数和状态检查，并检查课程、班级、公布日、生效日及课次，不能仅因 HTTP 200 判成功。缓存身份新增 Python 可执行文件摘要，区分修复后的运行环境。

## 修复前后真实输出摘录

- 旧作业延期关联：修复前原始输出反复出现 `"DB-DUE-NEW"`，最后 JSON 截断，HTTP 503；修复后 HTTP 200，`field=deadline`、`value=11月28日18:00`、`effective=2026-11-25`、`supersedes=["DB-DUE-NEW"]`。
- 旧教室调整：先前模型返回 `effective=2026-11-27`，混淆即日与课次；最终返回 `published=2026-11-25`、`effective=2026-11-25`、`lessonDate=2026-11-27`、`value=C205`。
- 新版矛盾结构：曾实际返回 `{"clauses":[],"pending":false}`，被 Node 校验拒绝。修复真实解码分支后，未理解的单项通知返回 `{"clauses":[],"pending":true}`，接口仍 503 待确认，不能把它算作理解成功。
- 新版两项变更：默认参数曾反复生成时间条款直至截断。固定开发参数 1.1 后实际返回 C302 和 10:00–11:40，两条均为交互设计、数媒3班、11月27日课次，生效日11月25日。代码与参数均发生变化，因此不把这项差异单独归因于训练或某一个代码修复。
- 七课次真实模型：生成了七条，但重复 C101/C103/C104，漏掉 C105/C106/C107，另有值与引用不匹配。最终 HTTP 503：`AI 遗漏了原文明示的变更要求，尚未发布任何条款。` 没有自动补答案，也没有发布前几条。

完整原始请求、响应和时间在 `training/runs/interface-fix`；worker 原始文本（包括截断内容）在 `training/runs/worker-output.jsonl`，编译与生成阶段记录在 worker-events.jsonl。路径及摘要见 V2-VALIDATION.json；本地包包含这些未纳入 Git 的证据。

## 实际验收结果

|检查|结果|范围|
|---|---|---|
|Node 回归|82/82|包含完整七项、缺一项拒绝、启动失败、进程竞态、引用和日期|
|Python 提示与真实解码器|3/3|真实 tokenizer/Outlines，非模拟模型成绩|
|Python 数据与 loss|3/3|真实 GPU 环境下重跑，含 padding/EOS mask|
|冻结题|38/38|原金标未改|
|证据角色/研究/行为|9/9、4/4、22/22|原验收|
|默认 GGUF 真实接口|20/20|固定提交 verify-delivery --model|
|1k adapter 旧兼容入口|5/5|选句、冲突+缺证、教室、未见课程两项、作业延期|
|1k adapter 新版开发入口|3/5|单项教室、作业延期仍待确认|
|1k adapter 七课次|0/1|模型漏项，被完整性校验拒绝|
|断网重启模型|5/5|外联确实被系统封锁；字段、冲突历史、缺证、选句、真实原文|

独立测试集没有推理或调参。五个接口探针是已观察的开发例，不能解释为系统准确率或正式训练收益。七课次拒绝保证没有错误发布，但本题任务仍失败。

中间对照保留：在 `489a7c6` 的同一组五题上，adapter 默认参数 1 为 2/5，开发参数 1.1 为 3/5；原始 base 同参数 1.1 为 2/5。旧入口在该提交为4/5，最终源码恢复5/5。每组原始模型与校验结果都保留，没有删去负结果或用规则答案代替模型原始文本。此小集不支持正式提升结论，也不是完整公平基线矩阵。

## 运行环境修复

复测途中 `.venv/bin/python3` 指向的外部 Codex 运行时路径消失，四个实际模型请求启动失败；该轮保存在 `http-v2-source5393-default.json`，归为运行失败，不算模型语义成绩。

恢复使用 [Astral Python Build Standalone 官方发布](https://github.com/astral-sh/python-build-standalone/releases/tag/20261110) 中的 `cpython-3.12.16+20261110-aarch64-apple-darwin-install_only.tar.gz`，下载摘要按官方 release asset digest 核验：`e956e60bc9465d577ef8062059aa05cd3a2665b4b8678a2ed24e432368330b8f`。安装于项目忽略目录 training/cache/python-repair，修复项目虚拟环境链接，未改系统 Python，原配置有备份。

原解释器为3.12.14，当前3.12.16；MLX、Outlines依赖与 adapter 未改。这是运行环境变化，不把前后运行宣称为完全相同环境。恢复后的训练 loss 单测第一次受 GPU 权限限制失败，开放本机 GPU 后3/3通过，两份日志均保留。

Adapter 仍为原1k工具试训，SHA256：`8040e10f7da0dba5a32ab2e446df36bd66270dfc3cbdf221a965f2029b02f381`。本轮没有训练、合并、导出或量化新模型。

## 训练输入审计与未完成项

只读检查 train/valid，没有读取独立 test。训练集36,000条抽取样本全部提供完整世界身份；16,255条混合不同公布日的通知，2,322条包含不同具体事项身份。验证集对应为1,800、815、116条。训练与验证文件摘要未变，原文/值逐字同源检查未发现违例。

这说明训练格式和单份教师原文入口存在条件差异，不直接证明标签错误；多通知样本的日期也可能在原文中明示。正式训练前，组长应复核完整身份提示是否过强，并分别评估单通知原文和带完整结构的条件。统计与样本ID在 INPUT-FORMAT-AUDIT.json。

500条真人复核仍为0条完成，formal-gate 实际以退出码2拒绝启动。用户已指定由组长安排，审查入口为 `training/review/train-500.html`，不能由AI自动勾选通过。

仍未完成：新版自由原文语义验收、七课次真实模型完整发布、正式120k训练与规模曲线、独立模型基线矩阵、合并/量化对照、部署。已有小集权重和大数据文件不等于这些工作完成。

## 复现

在项目根目录、预装权重和依赖的 Apple Silicon 环境运行：

```sh
npm test
training/.venv/bin/python training/prompting-tests.py
training/.venv/bin/python training/tests.py
python3 training/input-format-audit.py
NOWPAST_MODEL_HOME=/private/tmp/nowpast-models node service/verify-delivery.mjs --ref 5fc19e4 --model

export NOWPAST_BACKEND=mlx
export NOWPAST_MODEL_VARIANT=finetuned
export NOWPAST_ADAPTER="$PWD/training/runs/smoke-1k"
export NOWPAST_ALLOW_SMOKE=1
export NOWPAST_MLX_REPETITION_PENALTY=1
export NOWPAST_PROBE_TAG=local-repeat
NOWPAST_INTAKE_V2=0 node training/interface-probe.mjs
NOWPAST_INTAKE_V2=1 NOWPAST_MLX_REPETITION_PENALTY=1.1 node training/interface-probe.mjs
NOWPAST_INTAKE_V2=0 node training/interface-probe.mjs seven-lessons
```

HTTP样例可直接取最终三个 source5fc19 JSON 的 request/response。字段在旧接口中保持兼容；界面不需手工输入 topic/value/关联编号。新版失败要保留原文与待确认状态，不能当作已发布。
