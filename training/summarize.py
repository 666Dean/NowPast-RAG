"""Build a local handoff index from actual files, never from planned results."""
import json,pathlib,hashlib,subprocess,statistics
root=pathlib.Path(__file__).resolve().parent;repo=root.parent
read=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
manifest=read(root/'DATA-MANIFEST.json');tokens=read(root/'TOKEN-AUDIT.json');run=root/'runs/smoke-1k';trained=read(run/'training-manifest.json');metrics=read(run/'task-metrics.json')
for s in manifest['splits']:assert sha(root/f'data/v2/{s["split"]}.jsonl.gz')==s['sha256']==tokens['datasetHashes'][s['split']]
before=read(run/'base-validation.json');after=read(run/'adapter-validation.json');reloaded=read(run/'reloaded.json');assert len(after)==len(reloaded)==32 and all(a['raw']==b['raw'] for a,b in zip(after,reloaded))
assert sha(run/'adapters.safetensors')==trained['adapterSha256']
events=[json.loads(l) for l in (run/'events.jsonl').read_text().splitlines()];last=next(r for r in reversed(events) if r['kind']=='train');assert last['trained_tokens']==read(run/'mask-check.json')['targetTokensAvailable']
inventory=[]
for area in [root/'data',root/'review',root/'runs',repo/'experiments/next-audit']:
    for p in sorted(area.rglob('*')):
        if p.is_file():inventory.append({'path':str(p.relative_to(repo)),'bytes':p.stat().st_size,'sha256':sha(p)})
sources={}
for directory in ['knowledge','temporal','retrieval','qa','generation','service','training']:
    for p in (repo/directory).glob('*'):
        if p.suffix in ['.py','.mjs','.json'] and p.name!='DELIVERY-MANIFEST.json' and p.is_file():sources[str(p.relative_to(repo))]=sha(p)
summary={'type':'local development handoff; NOT formal competition submission','sourceCommit':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'sourceMode':'workspace with per-file hashes','dirtyStatus':subprocess.check_output(['git','status','--porcelain'],encoding='utf8'),
    'branch':subprocess.check_output(['git','branch','--show-current']).decode().strip(),'sourceHashes':sources,'data':manifest,'tokenAudit':tokens,'training':trained,'actualTargetTokens':last['trained_tokens'],
    'reloadRawIdentical':32,'reviewOwner':'team leader (user chose this)','humanReviewsCompleted':0,'formalTrainingAllowed':False,
    'notRun':['120k formal SFT','10k/50k/100k training scale curve','independent test model inference','fixed formal finetuned model across retrieval baselines','merged weights export','GGUF/ONNX export','deployment','forum/competition submission'],
    'integrationStatus':'default GGUF preserved and verified; opt-in MLX smoke model has real schema failures and is NOT product-ready','inventory':inventory}
(root/'DELIVERY-MANIFEST.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
pilot=metrics['metrics'];base=pilot['base-validation.json']['all'];fine=pilot['adapter-validation.json']['all']
text=f'''# Qwen 适配阶段：本地交接

当前分支 `{summary['branch']}`，受验实现提交见清单；本轮不 push、不上传模型、不合并 main、不部署。完整任务书在 training/TASKBOOK.md。组长安排 500 条真人审查，这是用户明确选择；本地材料已备齐，但不能替真人填通过。

## 已完成与实际证据

1. 原 230 题×9 方法 2,070 条输出审计，所有输入都可重建为相同 cacheKey；公开39f23b5的69个报告文件散列匹配原服务身份。旧HTTP原始字节/finish_reason未保存，列为无法复核。至少18个可逐行案例、首因/多标签统计、修正评分和原公开核心55k重放在 experiments/next-audit；同值多来源、错误引用、超时、直接/传递旧链分别评价。原始模型50.4%不是页面准确率，角色缺失的因果仍需配对实验。
2. 数据：训练120k、验证6k、独立测试12k，分别24k/1.2k/2.4k世界。训练去实体后的事实指纹22,177，不把这些当作22,177种业务语义；有限场景/模板重复很高。任务配额36k抽取、30k关系、42k问答、12k负例；普通约16%、困难约45%。引用、身份、可见性、有效日期和泄漏自动检查已跑，具体散列/分布/长度在 DATA-MANIFEST 和 TOKEN-AUDIT。MinHash候选内Jaccard的近重复审计如实记录高模板重复，跨集合高相似候选为0，不声称搜索完全。
3. 真实试训：官方Qwen2.5-0.5B-Instruct固定revision，BF16 base + 180,224个LoRA参数；1,000条/500次更新，实际受监督token **{last['trained_tokens']:,}**，总输入token {read(run/'mask-check.json')['allTokensAvailable']:,}，耗时{trained['seconds']:.1f}秒，MLX分配器峰值{trained['peakMemoryBytes']/1e9:.3f}GB（不是整机进程RSS）。Adapter SHA256 `{trained['adapterSha256']}`。使用本项目严格loss mask，EOS监督、全部padding排除、截断0。新进程重载32题逐字相同。
4. 32道固定**验证诊断**：base原始结构完整JSON率{base['jsonValid']['value']:.1%}，adapter为{fine['jsonValid']['value']:.1%}；任务完全匹配{base['taskExact']['value']:.1%}→{fine['taskExact']['value']:.1%}。这些是训练格式下、固定512输出token预算的极小诊断，不是12k盲测，不与旧230题50.4%横比，不证明产品端到端提升；长输出和格式失败完整保留。原始base响应在重训时按输入/权重身份核验复用，非新推理。
5. 引擎：两知识时点分别重建、晚导入不投影、同值多来源、独立缺证、撤销、循环/缺失父/跨身份检测；旧接口/旧浏览器数据兼容。新领域原文和问答路径是显式选择，校验只拒绝非法建议，不读金标补答案。主工作台/web与原冻结题未改。74项Node回归、3项Python检查、38原冻结题与20项默认GGUF真实HTTP/模型验收已通过，日志和源文件身份随包。

## 不能标完成的项目

- **正式100k+训练与规模曲线没有运行**：尚缺500条真人语义复核，组长负责安排。数据自动检查不能替代人工审查。
- MLX smoke权重可真实加载/生成/重载，但通用原文发布与旧选句接口仍有结构失败；程序拒绝，没有发布错误要求。默认GGUF没有被替换。新路径是开发接入，不可称产品主模型已通过。
- 独立12k测试未推理，固定微调模型跨Vector/BM25/Latest/NowPast矩阵未运行；模型原始与校验后系统须另表。旧230题已看过，仍只是诊断。
- 没有合并或量化导出：磁盘余量约1GiB，安全副本/导出空间不足；base与adapter分别保留。没有真实公网部署或比赛正式提交。

## 修订与负结果

future作业生效标签错误、padding首token监督、长链跨月日历等系统问题都已修生成器/损失并重跑；无效试验完整留在 pilot-invalid-*，带 INVALID.json，worker拒绝加载。不能引用其loss或成绩充当合格结果。详见 REVISIONS.md。

## 组长接手

打开 training/review/train-500.html 逐项人工复核，填写真实审查人与理由并导出CSV；验证材料在 leader-200.html。执行 formal-gate.py，发现系统性错例应修生成器并重审，不能自动填pass。正式训练前冻结配置、评估预算和checkpoint选择规则，再跑1k/10k/50k/100k收益曲线及独立测试。

复现命令、模型选择、回滚见 training/README.md；所有权重、数据和结果实际路径/散列在 DELIVERY-MANIFEST.json。模型卡在 MODEL-CARD.md。MLX运行时与训练环境隔离；默认服务回滚不改旧GGUF。Qoder过程暂缓，本轮没有其贡献记录。
'''
(repo/'NEXT-STAGE-DELIVERY.md').write_text(text)
print({'adapter':trained['adapterSha256'],'samples':trained['actualSamplesSeen'],'targetTokens':last['trained_tokens'],'humanPending':500,'inventoryFiles':len(inventory)})
