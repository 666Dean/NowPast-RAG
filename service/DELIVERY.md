# RAG 引擎与模型服务交付

基于 main 提交 `948d36aea2a46099bff9a9121ea6e1d61e5e015b`，工作分支 `codex/rag-engine-retrieval-model`。
本轮只修改 temporal、retrieval、generation、service；未改 UI、研究说明与独立评测金标。关联 #2、#3、#4、#5、#6、#8；本轮没有完成这些 Issue 所有长期目标，建议逐项验收后决定是否关闭。

## 结果与修复

| 检查 | 起点 | 本轮 |
|---|---:|---:|
| 当前证据集合完全匹配 | 35/38 | 38/38 |
| 当前证据集合平均 F1 | 93.4% | 100.0% |
| 关闭历史通道的完全匹配 | 30/38 | 33/38 |
| GNP 证据角色 | 8/9 | 9/9 |
| 研究引用定位 | 4/4 | 4/4 |
| 原有边界验收 | 22/22 | 22/22 |

GNP08、X06、X07 从失败变为成功，原 38 题无退化。BM25 仍为 16/38、平均 F1 52.2%，已知正确主题的 Latest 仍为 33/38、平均 F1 96.5%。原始逐题结果见 main 的 evaluation/results.json，本轮逐题结果见 [validation/evaluation-results.json](validation/evaluation-results.json)。

- 日期解析与主题路由共用日期语法；路由前移除日期，日期本身不再召回截止时间。日期仍由 answer 用来重建前后快照，真实的截止时间提问照常检索。
- 增加有限的名称、容器、存储介质、柜位同义词归一，并保留分数和跨主题差距要求；名称类意图还需来源中的内容词支持。模糊候选统一比较 Now 与 Past 的主题，避免小型历史池产生虚假的高置信度。精确编号、旧值、主题与别名仍优先。
- 从主题中的“方式／方法”后缀提取动词词干，支持“如何融合、如何聚合”等表达。
- 新增 macOS 官方 llama.cpp 运行支持，保留 Windows 路径。强化模型输出核验：不能缺项、加项、返回错误类型、越界句号或引用另一条来源的句子。

没有按题号、预期条款 ID 或日期写修复特判。回归测试中的编号仅用于断言。

## 新测试与时间边界

`retrieval/regression.test.mjs` 和 `generation/citations.test.mjs` 共 8 个测试组，通过 8/8。覆盖日期的多种写法、日期单独出现、仍需回答的截止时间、新口语问法、另一组开发者自编资料、未知对象、费用/人数缺证、混合已知未知问题、错误模型结构与跨来源引文。

日期与组别已实际检查：11/08 B组当前是 F01，B13 已公布待生效；11/12 B组是 B13，A组仍是 F01。11/14 B组 R21/R22 冲突，11/15 可采用已公布但晚导入的 R30；同日 A组保持 M03。新增 B组补充通知只在其生效日后改变 B组；未署日期草案不回填到导入前，也不作为确定依据。

这些新增测试由修改引擎的开发者编写，属于开发回归，不能替代另一位成员的独立盲测。语料仍然很小且为虚构资料，38/38 不能解释为真实用户准确率。

## 真实模型与 HTTP 验证

实测环境：macOS arm64，Node.js 24.22.3，Python 3.12.14，llama.cpp b12559，Qwen2.5-0.5B-Instruct Q4_K_M。模型与运行程序均下载并通过固定 SHA-256 校验。使用 CPU 推理；Windows 与 Intel Mac 本轮未实机验证。

通过真实 HTTP 请求验证：

1. 单条报告要求：200，返回 M01 原句。
2. 多句澄清问“为什么”：200，R30 选出“源于复现工作站迁移后排班未同步”的原因句，并保留历史来源的角色。
3. 未解决地点冲突：200，R21 与 R22 两方均保留，同时将 M03 标成已被替代。
4. 缺少费用依据：422。
5. 空模型缓存：503。
6. 论文/源码研究直查：422，继续使用研究原始依据展示，不送入课程选句。

真实请求和返回保存在 [validation/api-results.json](validation/api-results.json)。每条摘录已逐字检查存在于同 ID 原文，成功返回的引用条数与引擎证据条数一致；没有用模拟模型代替上述三次推理。页面模块资源已通过 HTTP 检查，后续 Chrome 联调记录见 [开发日志](DEVLOG.md)。

## 前端接入

`answer(docs, question, options)` 和 `POST /api/generate` 的请求/响应字段保持不变，无需前端迁移。

[validation/engine-examples.json](validation/engine-examples.json) 包含可直接导入的 docs 和两个 `{request,response}` 样例。第一个是 11/08 B组的 F01 当前依据与 B13 待生效补丁，第二个是 11/14 B组的 R21/R22 冲突。

页面可用 `answer(fixture.docs, example.request.question, example.request)` 重算，并对照 `example.response`；模型请求可用 `{...example.request,docs:fixture.docs}` POST 到 `/api/generate`。模型成功响应仍为 `{model,text,citations}`，错误仍为 `{error}`。新增 `verifySelection` 只是服务内部复用的校验函数，未改变现有协议。受影响的前端调用位置为 web/app.mjs 的 generate 函数，但该调用无需修改。

## 复现命令

完整交付检查可运行 `node service/verify-delivery.mjs`。模型准备完成并设置 NOWPAST_MODEL_HOME 后，加 `--model` 验证真实模型。该命令在临时干净副本中检查逐题结果和 HTTP 返回，并将报告保存为 service/validation/delivery-check.json。新一轮额外补充了课程融合要求与未知设备费用的混合问题，当前开发回归为 9/9。需求、任务和当前进度见根目录 REQUIREMENTS.md。

从仓库根目录运行（Node.js 22+）：

```sh
node --test retrieval/regression.test.mjs generation/citations.test.mjs
npm run eval
node service/verify-service.mjs
```

`npm run eval` 会按原逻辑更新 evaluation/ 下的报告；本轮没有把这些自动生成的更新纳入提交，保留独立评测工作区的原始版本。

macOS 真实模型验收：

```sh
export NOWPAST_MODEL_HOME=/private/tmp/nowpast-models
python3 generation/prepare_model.py
node service/verify-service.mjs --model
npm start
```

Windows 继续使用 `npm run model:prepare`，也可设置 NOWPAST_MODEL_HOME。准备与启动须使用同一缓存目录；临时目录中的缓存以后可能被系统清理。

## 研究核对与限制

阅读了组内提供的出版版 PDF 第 3-5 页（发表页 727-729，§3.1-3.3），并核对固定提交 `4bc08b4e818f3b70220f7f0234765b32b7fc403d` 的 [PastGraph/Now/GNP/Aggregator 源码](https://github.com/for4ever44/GNP/blob/4bc08b4e818f3b70220f7f0234765b32b7fc403d/gnp.v1.0.py#L117-L260)。

PastGraph 是带边特征的注意力消息传递；Now 是 BatchNorm/LayerNorm 两路 MLP。论文 §3.2 描述平均消息和 Hadamard 融合，固定源码 Aggregator 第 119-121 行选择时间最新消息，GNP.forward 第 258-260 行执行 Past 归一化、拼接 Now、线性投影。本轮据此核对课程证据角色；未训练 GNP，也没有用论文链路预测的 AP/AUC 代替问答指标。论文原文件未上传到仓库。

语义归一是有限词表，并非开放域语义模型；近义的存储介质可能仍需更细的业务区分。原本的人工拆条款、主题标注、替代关系和冲突值比较仍有限制。逐字存在只能证明摘录来自原文，不能自动证明它完整回答了问题。Qoder 本轮未使用，不将此次 Codex 开发记录宣称为 Qoder 贡献。

GitHub 写权限已开通。交付分支为 `codex/rag-engine-retrieval-model`，上传时以最新 main `18f96ea` 为父提交，包含同学更新后的分工文档。代码、开发日志、逐题结果与联调样例均位于此分支，供 PR 验收。本地开发提交为 `08bea02` 和 `c5ff104`，GitHub 交付将这轮变更集中为一个提交。
