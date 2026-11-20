# 本地模型与复现

课程问答的时间、范围、冲突和替代关系由证据引擎判定。网页的“用本地模型整理”会单独调用 Qwen。模型读取本次问题、日期、范围以及检索到的原句，生成受 JSON Schema 约束的候选句编号。服务端逐条核验索引和原文，再显示带条款编号、组别和时间角色的摘录。它能在长条款里选出回答“为什么”的原因句。模型也可能选中关联较弱的句子，核验只保证引文逐字存在。主答案和原文阅读面板始终可用。

## 首次启动

本地问答服务使用 Node.js 22 或更高版本。模型准备脚本适配 Windows x64，要求 Python 3.11 或更高版本，使用 CPU 推理。本次实测为 Node.js 24、Python 3.14。无需填写模型密钥。

```powershell
cd NowPast-RAG
npm.cmd run model:prepare
npm.cmd start
```

打开 [本地服务](http://127.0.0.1:4173/)。默认地址只接受本机访问，环境变量 `PORT` 可调整端口。打开网页或提交普通问题不会加载模型。首次点击整理会启动 llama-server 子进程，绑定随机回环端口，使用一次性进程密钥。关闭应用服务会尝试退出该子进程。模型准备失败或未安装时可照常运行证据功能。

## 权重与缓存

- 使用 Qwen 官方 Qwen2.5-0.5B-Instruct-GGUF 的 Q4_K_M，权重文件 491,400,032 字节，SHA-256 为 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`，Apache-2.0。准备脚本从 Qwen 的 ModelScope 或 Hugging Face 仓库分段下载，最后对照固定摘要。[模型卡和许可证](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/9217f5db79a29953eb74d5343926648285ec7e67)
- 使用 llama.cpp b12559 官方 Windows x64 CPU 压缩包，24,876,565 字节，SHA-256 为 `2f3dcb3aea4f52bf734f52040d2a688bdd76c2f762ae200a159646b37d84e393`，主项目使用 MIT 许可，依赖许可随发行包保存。[固定版本](https://github.com/ggml-org/llama.cpp/releases/tag/b12559)
- 默认存放于 `%LOCALAPPDATA%\NowPast\models`。首次准备预留约 750 MB 磁盘空间。设置 `NOWPAST_MODEL_HOME` 可改位置，准备和启动服务时应使用相同变量。网页静态目录不包含缓存。准备完成后运行时无需联网。

## 接口

`POST /api/generate` 接收同源 JSON，字段为 `question, date, scope, mode, docs`。服务端重算检索，响应中的 `citations` 给出每条 `id, role, quote`。资料上限 1 MiB、400 条。每次整理限 18 个证据条目及 6,500 个提示正文字符，超限会提示缩小问题。仅提供一次一个的 CPU 推理。证据不足返回 422，模型不可用返回 503。
