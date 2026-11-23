# 组长在 PowerShell 复核（Windows 命令格式，未在 Windows 实测）

解压本地交付包后，进入其中 NowPast-RAG 目录。PowerShell 中：

```powershell
node --version
npm test
npm run eval
node experiments/next-audit.mjs
$env:NOWPAST_MODEL_HOME = 'D:\NowPast\models'
node service/verify-delivery.mjs --model
```

audit 需要包内 experiments/full/data 与 results 原始产物，不能只下载公开 GitHub 源码。源码身份核对需要可用 Git；独立源码快照没有历史时，应从39f23b5仓库工作分支应用补丁，或为快照初始化本地Git后明确记录新的本地SHA，不能把新SHA写成旧受验SHA。默认服务的模型缓存应按原 generation/prepare_model.py 准备Windows运行时，不复制Mac的llama-server二进制。

本轮训练后端为 Apple Silicon MLX，**Windows 不能直接安装运行该训练环境**。请在本机Mac上重放 training/README.md 中的训练/adapter步骤。跨平台权重转换、PyTorch加载adapter或Windows部署尚未实现/测试，不在这里声称兼容；不要把上述Node审计能运行等同于训练后端支持Windows。

人工审查不需要GPU：打开 training/review/train-500.html 与 leader-200.html，逐项核实后导出判定CSV，交回组员执行formal-gate.py。无真实审查人或有待确认项时不得启动正式训练。
