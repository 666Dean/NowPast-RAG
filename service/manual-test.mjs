import {campusSeed,campusConflictSeed,campusClarifiedSeed} from '/knowledge/campus-data.mjs';

const $=selector=>document.querySelector(selector);
const datasets={normal:campusSeed,conflict:campusConflictSeed,clarified:campusClarifiedSeed};
const scenarios=[
  {label:'通知公布前',asOf:'2026-11-24'},
  {label:'通知公布后',asOf:'2026-11-25'},
  {label:'换成1班',classId:'计科1班'},
  {label:'查下一周',lessonDate:'2026-12-04'},
  {label:'两份通知冲突',asOf:'2026-11-26',dataset:'conflict'},
  {label:'加入澄清',asOf:'2026-11-26',dataset:'clarified'},
  {label:'问费用',question:'数据库课在哪上，要交多少钱？'}
];
let latest;
let requestNumber=0;
let activeRequest;

function element(tag,text,className='') {
  const node=document.createElement(tag);
  node.textContent=text;
  node.className=className;
  return node;
}

function render(response) {
  const panel=$('#result');
  panel.replaceChildren(element('h2',response.label));
  panel.append(element('p',`截至 ${response.asOf}，${response.classId} ${response.lessonDate} 的数据库课`,'muted'));
  if(!response.sections.length) panel.append(element('p',response.summary));
  for(const section of response.sections) {
    const article=element('article','');
    article.append(element('h2',section.topic));
    article.append(element('p',section.values.length?section.values.join(' / '):'资料中没有依据','value '+section.status));
    if(section.status==='conflict') article.append(element('p','两份有效通知说法不同，请核对双方原文。','conflict'));
    for(const {doc,role} of section.items) {
      const details=element('details','','evidence');
      details.append(element('summary',`${role} · ${doc.title} · ${doc.id}`));
      details.append(element('p',`公布于 ${doc.published || '未知'}，适用 ${doc.campus.lessonDate}，${doc.campus.classId}`,'muted'));
      details.append(element('blockquote',doc.text));
      details.append(element('p',`虚构资料 · ${doc.source.locator}`,'muted'));
      article.append(details);
    }
    panel.append(article);
  }
}

async function query(event) {
  event?.preventDefault();
  if(!$('#query-form').reportValidity()) return;
  activeRequest?.abort();
  activeRequest=new AbortController();
  const serial=++requestNumber;
  const request={domain:'campus',course:'数据库',asOf:$('#as-of').value,lessonDate:$('#lesson-date').value,
    classId:$('#class-id').value,question:$('#question').value.trim(),docs:datasets[$('#dataset').value]};
  $('#submit').disabled=true;
  $('#feedback').textContent='正在查询…';
  $('#copy').disabled=true;
  try {
    const response=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(request),signal:activeRequest.signal});
    const data=await response.json();
    if(!response.ok) throw Error(data.error || '查询失败');
    if(serial!==requestNumber) return;
    render(data);
    latest={request,response:data};
    $('#copy').disabled=false;
    $('#copy-status').textContent='';
    $('#copy-text').hidden=true;
    $('#feedback').textContent='查询完成';
  } catch(error) {
    if(serial===requestNumber) $('#feedback').textContent=error.name==='AbortError'?'查询已取消':error.message;
  } finally {
    if(serial===requestNumber) $('#submit').disabled=false;
  }
}

for(const scenario of scenarios) {
  const button=element('button',scenario.label);
  button.type='button';
  button.addEventListener('click',()=>{
    $('#as-of').value=scenario.asOf || '2026-11-25';
    $('#lesson-date').value=scenario.lessonDate || '2026-11-27';
    $('#class-id').value=scenario.classId || '计科2班';
    $('#dataset').value=scenario.dataset || 'normal';
    $('#question').value=scenario.question || '数据库课几点、在哪上？';
    query();
  });
  $('#presets').append(button);
}
$('#query-form').addEventListener('submit',query);
$('#copy').addEventListener('click',async()=>{
  if(!latest) return;
  const text=JSON.stringify(latest,null,2);
  try {
    await navigator.clipboard.writeText(text);
    $('#copy-status').textContent='已复制，可粘贴到聊天里';
  } catch {
    $('#copy-text').value=text;
    $('#copy-text').hidden=false;
    $('#copy-text').select();
    $('#copy-status').textContent='请复制下面的记录';
  }
});
