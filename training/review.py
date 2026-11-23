"""Prepare actual human review materials; never pre-fill a passed decision."""
import pathlib,json,html,collections
ROOT=pathlib.Path(__file__).resolve().parent;out=ROOT/'review'
for name in ['train-500','leader-200']:
    rows=[json.loads(l) for l in (out/(name+'.jsonl')).read_text().splitlines()]
    parts=['<!doctype html><meta charset="utf-8"><title>NowPast 虚构数据人工审查</title><style>body{max-width:1100px;margin:30px auto;font:16px/1.7 system-ui}pre{white-space:pre-wrap;background:#f7f4f0;padding:16px}details{border-bottom:1px solid #ddd;padding:10px}button{padding:8px}textarea{width:98%}</style>',
      '<h1>虚构校务数据：人工语义审查</h1><p>自动检查已跑；以下判定必须由真人逐项完成。核对：原文是否完整、日期角色、身份、字段、引用、授权、冲突与缺证是否合理。发现系统性错误请记录，不只删除个别错例。</p><label>审查人 <input id="reviewer"></label><button onclick="download()">导出判定 CSV</button>']
    for r in rows:
        audit=r['audit'];parts.append(f'<details data-id="{audit["id"]}"><summary>{audit["id"]} / {audit["task"]} / {audit["scene"]}</summary><h3>输入</h3><pre>{html.escape(json.dumps(json.loads(r["messages"][1]["content"]),ensure_ascii=False,indent=2))}</pre><h3>预登记标签（需核对）</h3><pre>{html.escape(json.dumps(json.loads(r["messages"][2]["content"]),ensure_ascii=False,indent=2))}</pre><select><option value="pending">未审查</option><option value="pass">正确</option><option value="fail">有误</option></select><textarea placeholder="问题与理由"></textarea></details>')
    parts.append('''<script>function download(){const q=s=>'"'+String(s).replaceAll('"','""')+'"';const reviewer=document.querySelector('#reviewer').value;if(!reviewer){alert('请填写真实审查人');return}let lines=['id,reviewer,decision,notes'];for(const d of document.querySelectorAll('details'))lines.push([d.dataset.id,reviewer,d.querySelector('select').value,d.querySelector('textarea').value].map(q).join(','));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}));a.download='human-decisions.csv';a.click()}</script>''')
    (out/(name+'.html')).write_text('\n'.join(parts))
print('Created review HTML; human completed=0')
