# 本地模型与引用核验

执行负责人为 **组员 AI**。任务跟踪见 [Issue #6 · 本地模型与引用核验](https://github.com/666Dean/NowPast-RAG/issues/6)。

## 现有实现

已有 Windows x64 CPU 下载校验和 llama.cpp 推理适配。 本目录的主要文件为 model.mjs、prepare_model.py、runtime.md。

## 职责与依赖

把选定证据送入真实本地 Qwen，并核验受约束输出。

由 service 调用 generate(result,question)；返回 model、text、citations。准备命令从仓库根目录运行 npm run model:prepare。

## 第一项工作

分别用多句澄清、单句条款、互相冲突的两份材料验收选句。记录模型版本、输入、原句与失败响应；检查相关性与逐字存在性。

## 完成条件

每个引文都能回到相同 ID 的原句；相互冲突的依据不会漏掉一方；没有模型时网页仍提供规则回答。

提交时写明所改文件、用于验证的查询及实际结果。涉及其他模块的输入输出变更时，在 PR 中写出影响的调用方。[协作总表](../CONTRIBUTING.md)
