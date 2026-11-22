# 本地实验复现

所有新语料均为虚构。原冻结题和金标在 evaluation 中保持不变。使用 Node.js 22+；当前实跑 Node 26.13.0、macOS arm64、Python 3.12。下载模型需要联网，检索和推理均在本机 CPU 运行。

## 环境

```sh
python3 -m venv experiments/.venv
experiments/.venv/bin/python -m pip install -r experiments/requirements.txt
experiments/.venv/bin/python experiments/prepare-embedding.py
export NOWPAST_MODEL_HOME=/private/tmp/nowpast-models
python3 generation/prepare_model.py
```

模型路径可换为自己的缓存位置。Qwen2.5-0.5B Q4_K_M 文件 SHA256 必须为 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`；llama.cpp b12559。BGE 固定 revision 和实际权重摘要由 prepare-embedding.py 写入缓存清单；不需要安装 PyTorch。

## 数据与冻结

```sh
node experiments/generate.mjs
node experiments/generate-answers.mjs --freeze-only
node experiments/school/generate.mjs
NOWPAST_EXPERIMENT_DIR=./school/ node experiments/generate-answers.mjs --freeze-only
node experiments/full/generate.mjs
node experiments/audit.mjs
```

首次复现应使用交付中已跟踪的 generation-sample.json，不重新抽题；generate-answers 的 --freeze-only 仅首次创建缺少的样本清单。原样本来源冻结文件含生成时间/提交，因此重建后 freeze.json 自身散列可能不同；数据压缩包 SHA256 必须逐项一致。若主动生成新配置，另存目录与新样本清单，不能覆盖已冻结验收记录。

`full` 是最终去重完整实验：五个种子，每种子 1,470 通知、13,000 唯一问题、11,000 测试问题和 1,100 个独立测试事件检查点；学校公告、课程和作业均覆盖。原始版本和补充版本保留用于审计，不能将其与 full 相加来扩大独立事件数。

可调世界数、种子、问题数见 config.json。更细的课程/班级/课次/作业/版本/干扰比例调试生成器：

```sh
node experiments/parametric.mjs experiments/debug-config.json
```

debug-config.json 可分别修改 coursesPerWorld、classesPerWorld、lessonsPerCourse、assignmentsPerCourse、versions、distractorRatio 等；输出独立事件检查点金标，不调用引擎生成答案。该扩展调试集不冒充已运行的完整实验成绩。

## 完整检索、模型与报告

```sh
NOWPAST_EXPERIMENT_DIR=./full/ OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 experiments/.venv/bin/python experiments/retrieve.py
NOWPAST_EXPERIMENT_DIR=./full/ OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 experiments/.venv/bin/python experiments/retrieve.py --scale
NOWPAST_EXPERIMENT_DIR=./full/ node experiments/evaluate.mjs
NOWPAST_EXPERIMENT_DIR=./full/ node experiments/generate-answers.mjs
NOWPAST_EXPERIMENT_DIR=./full/ node experiments/report.mjs
```

中断模型运行后可以用缓存继续；相同 prompt/input/schema/model 参数才复用。记录总方法×问题数、实际不同模型输入数与缓存复用数，不能把缓存复用称为新一次真实推理。逐题、总表、场景、规模、延迟、token、聚类区间、错例和数据审计保存在 full/results。原始首次模型题和补充公告题的输入在 full/generation-sample.json 中固定为 230 道，每种子 46 道。

首次无 PyTorch 路线前尝试的安装因磁盘空间不足终止；实际正式实验使用固定 ONNX CPU 量化向量模型。所有方法共享模型与提示；经典向量 RAG 是工程基线，不声称复现原 RAG 训练方案。依据：[原 RAG 论文](https://arxiv.org/abs/2005.11401)、[BGE 模型说明](https://huggingface.co/BAAI/bge-small-zh-v1.5)、[固定 ONNX 制品](https://huggingface.co/Xenova/bge-small-zh-v1.5/tree/75c43b069aac4d136ba6bc1122f995fedcfd2781)。

## 开发与服务验收

```sh
npm test
npm run eval
node service/integration-probes.mjs
node service/verify-delivery.mjs
node service/verify-delivery.mjs --model
NOWPAST_MODEL_HOME=/private/tmp/nowpast-models node experiments/intake-probe.mjs
node service/verify-s1.mjs de3b4ec
```

verify-delivery 支持 --ref SHA 验证独立临时检出；输出每文件摘要和源码身份。S1 修复前后使用明确源码与精确逆向修改重建，保留真实模型响应，不伪造“旧提交”。组长仍负责独立验收题与金标复核。没有 push 或远端合并操作。
