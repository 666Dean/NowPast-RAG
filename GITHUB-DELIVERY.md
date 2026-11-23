# 本轮 GitHub 审阅交付

用户本次已授权上传。此交付用于组长审阅，保留工作分支；未合并 main、未部署、未上传模型权重或120k训练数据。

最新引擎受验提交为 `fc6cb18`，原始本地报告提交为 `b3cc382`。后续上传准备只增加可复核的结果副本、接口样例和传输说明，不改引擎。完整源码摘要在 `training/RAW-NOTICE-VALIDATION.json` 和 `service/validation/delivery-check.json`；公开快照的提交号不同，不冒充原受验提交。

## 组长先看

- `training/SOURCE-COVERAGE-FIX.md`：本轮修改、逐项失败前后输出、93项回归和限制。
- `experiments/raw-notices/results/`：四组真实模型开发推理，含请求、schema、原始输出、校验结果和用量；MANIFEST 记录与原本地产物逐字节相同的摘要。
- `service/validation/qwen-adaptation-examples.json`：五项真实HTTP请求/响应，课程、班级、日期和引用检查均通过，可用于网页联调。
- `training/INPUT-FORMAT-AUDIT.json`：训练格式与自由原文入口的条件差异。
- `training/README.md`：固定基础权重、本地环境和复现方法。

原冻结38题、93项程序回归、20项真实GGUF接口通过。新增15条开发通知中，旧入口正确完成5条、正确待确认3条、7条仍未完成；该小集中错误发布由8条降至0条。新版仍拒绝全部12条可执行通知，不能算模型语义验收通过。模型仍是1k工具试训adapter，正式120k训练、独立模型矩阵和部署尚未完成。500条真人语义复核仍由组长安排，当前完成0条。

## 上传方式与源码对应

原生Git连接超时，改通过GitHub接口创建审阅快照，基于远端 `codex/campus-engine-integration` 的 `39f23b55efca7c9a262a8cdf67a1fd73b60194ae`，不覆盖该分支。

接口仅接收UTF-8内容。六份已有历史审计gzip文件以三份去重的base64文本保存于 `experiments/next-audit/payloads/`，并保留原长度、Git blob SHA和SHA256。它们是原字节的无损传输，不是重跑或改写成绩。公开快照不直接包含这六个gzip路径，源码和其余跟踪文本保持相同内容。下载后先执行：

```sh
python3 experiments/next-audit/restore-artifacts.py
python3 experiments/next-audit/restore-artifacts.py --check
```

脚本验证原始摘要并拒绝覆盖不同文件。恢复后可沿原目录使用历史审计产物。完整120k数据、审查HTML、adapter和完整运行目录仍在先前本地交付包中，不在此GitHub快照内；需要模型推理时须按README准备权重与环境，不能把仅下载源码称为完整模型已运行。

PR以 `codex/campus-engine-integration` 为基准，供组长逐步集成；保留已有页面和教师完整原文流程。
