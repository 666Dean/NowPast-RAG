# Qwen 本地适配：阶段记录

最新原文校验续跑见 [SOURCE-COVERAGE-FIX.md](SOURCE-COVERAGE-FIX.md)：93项回归通过；新增15条开发通知中，旧入口成功完成5条、正确待确认3条、7条未完成，错误发布由8条降至0条。新版仍拒绝全部12条可执行通知，不能称为已验收完成。模型权重和正式训练审核状态未变。

最新续跑见 [V2-RUNTIME-FIX.md](V2-RUNTIME-FIX.md) 和 [V2-VALIDATION.json](V2-VALIDATION.json)：旧兼容入口5/5，新版开发入口3/5，七课次真实模型仍失败并拒绝发布。训练输入条件审计在 INPUT-FORMAT-AUDIT.json；正式训练的500条真人复核仍未完成。

本轮授权：只在本地训练、验证与交付。不 push、不上传权重、不部署、不购买外部算力。原 230 题属于已见开发诊断，不能当盲测。

## 复现顺序

从项目根目录运行，Python 3.12 / macOS Apple Silicon：

```sh
python3 -m venv training/.venv
training/.venv/bin/python -m pip install -r training/requirements.txt
training/.venv/bin/python training/prepare-base.py
training/.venv/bin/python training/data.py
training/.venv/bin/python training/prepare.py
training/.venv/bin/python training/near-audit.py
training/.venv/bin/python training/review.py
```

数据在 training/data/v2，缓存在 training/cache，运行在 training/runs，审查在 training/review，均不上传 Git。源码、固定配置、DATA-MANIFEST、TOKEN-AUDIT、NEAR-DUPLICATE-AUDIT 跟踪用于交付。生成器 `--train-worlds 60000` 支持 300k 扩容；未实际运行的扩容不计成绩。

官方 base 信息见 base-source.json；需要固定 `7ae557604adf67be50417f59c2c2f167def9a775` 的官方可训练权重、tokenizer 和 config 放入 `training/cache/qwen-base`。不要从当前 GGUF 开始 LoRA，不覆盖旧 GGUF。环境中使用 MLX/MLX-LM，PyTorch 缺失提示不影响 MLX 训练。下载文件摘要与许可应核对 MANIFEST 和原官方 Apache-2.0 LICENSE。

试训前先执行：

```sh
training/.venv/bin/python training/prepare.py --smoke-only
training/.venv/bin/python training/train.py
training/.venv/bin/python training/train.py --reload-only
training/.venv/bin/python training/metrics.py
```

第一次 train.py 在任何更新前保存原始模型同题基线。加载的是隔离的官方 BF16 权重，LoRA 配置在 smoke-config.json；prompt loss masked、EOS监督、padding按长度mask，超过1536的候选不进入这次工具子集，未截断或缩短标签。实际输入快照保存在 runs/smoke-1k/input-*，重载使用同一快照，不重新抽题。原始/adapter/重载输出和运行日志均保留；小集权重不等于正式模型。

项目使用 loss.py 的显式 target_index < length，不能直接用该版本 MLX-LM 的默认 <= 边界。tests.py 的已知 token batch 验证 padding 全部排除。错误数据与旧 padding 试验已保存在 pilot-invalid-* 并带 INVALID.json，worker 永久拒绝加载；不得把其观察成绩当作合格训练成果。`--reuse-base PATH` 仅在输入逐字相同且原始 base 身份不变时复用已有原始基线，日志明确标注不属于新推理。

## 人工审查与正式训练门槛

组长安排真人复核 500 条，打开 `review/train-500.html`。标签带 audit 字段便于核对；audit 不进入模型 messages。逐项核对后填写真实审查人、pass/fail和理由，导出 CSV。至少 200 条验证/测试材料在 leader-200.html 给组长复核。

```sh
training/.venv/bin/python training/formal-gate.py --decisions training/review/human-decisions.csv
```

未填完、任一 fail 或无 reviewer，脚本失败；不能为过关自动填 pass。系统性问题应修生成器、重新冻结和重新审核。正式 100k+ 训练与规模曲线仍需单独固定配置，不能把 1k 工具试训或 loss 下降写成已完成正式训练。当前训练/验证/测试每个 split 的具体散列和状态见 DATA-MANIFEST。

## 本地模型选择与回滚

原 llama.cpp + GGUF 是默认路线，不改变原接口。新增显式 MLX 路线：

```sh
NOWPAST_BACKEND=mlx NOWPAST_MODEL_VARIANT=base npm start
NOWPAST_BACKEND=mlx NOWPAST_MODEL_VARIANT=finetuned NOWPAST_ADAPTER="$PWD/training/runs/smoke-1k" NOWPAST_ALLOW_SMOKE=1 npm start
```

第二条仅开发验证，smoke adapter 未被允许冒充正式训练成果。删除这些环境变量即可回到原 GGUF。worker 通过本地 stdio 运行，不监听外网；HF 与 Transformers 离线加载，并拒绝外部 socket。公开网页不能自动使用作者电脑的模型，组长如需受控推理后端，须在目标机器预装依赖/权重后另行实测，此处没有部署承诺。

`/api/query`、`/api/generate`、`/api/notices/analyze`、answer旧调用都保留。`NOWPAST_INTAKE_V2=1` 开启新的领域模型原文结构（原接口不变）；`/api/generate` 请求 `generationMode:'domain-v2'` 开启逐字段模型回答，程序只核验/拒绝，不读金标修复模型输出。默认仍保留原模型选句任务。缺证字段仍按旧契约阻止生成，`/api/query` 可同时返回冲突和缺证。

缓存 v2 纳入 base revision、权重、adapter、tokenizer、template、后端依赖/运行时、量化、system/input/schema/生成参数。新实验使用 model-cache-v2.json，旧缓存不改名冒充微调结果。

独立测试暂不用于选模型；正式同尺寸前后、固定base跨检索、固定finetuned跨检索、规则基线需要同题配对另跑。原始模型输出和程序校验后的输出分表；返回 pending 不自动算正确。合并/量化需空间与实测，未运行就标未运行。
