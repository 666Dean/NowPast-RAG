# Now / Past 时序证据图

建议负责人为 **成员 A**。在 [Issue #3 · Now / Past 时序证据图](https://github.com/666Dean/NowPast-RAG/issues/3) 中认领并记录进展。

## 现有实现

已有明确替代边、双时间和范围过滤；语义与论文的神经消息传递有别。 本目录的主要文件为 graph.mjs。

## 职责与依赖

以日期、组别和替代关系重建快照，保留并行有效与历史邻居。

输入为 knowledge 条款；snapshot(docs,date,scope,topic) 返回 current、past、scheduled、uncertain，供 qa 调用。

## 第一项工作

画出 M03 → R21/R22 → R30 的分支与汇合，补充 11 月 14、15 日以及 A 组四个边界断言；审阅追溯生效、跨组替代及未知时间的语义。

## 完成条件

11 月 14 日 B 组仍有两个冲突节点，15 日可以引用 R30，A 组仍是 M03；无日期草案不作当前依据。

提交时写明所改文件、用于验证的查询及实际结果。涉及其他模块的输入输出变更时，在 PR 中写出影响的调用方。[协作总表](../CONTRIBUTING.md)
