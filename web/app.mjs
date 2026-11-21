import {references} from '../knowledge/data.mjs';
import {noticeSeed as seed} from '../knowledge/notices.mjs';
import {answer} from '../qa/answer.mjs';
import {validateDocument, validDay} from '../knowledge/schema.mjs';
import {snapshot} from '../temporal/graph.mjs';
import {relationsFor,executionFor} from './notice-relations.mjs';
import {installControls,syncControls,closeControl,installMotion,animateRoute,animateBookmark,animateWeek,animateFilteredList,updateCalendarIndicator,openDialog,closeDialog,revealSearch,concealSearch} from './controls.mjs';

const $ = (selector) => document.querySelector(selector);
const key = 'nowpast.campus.notices.v2';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const make = (tag, css, text) => {
  const node = document.createElement(tag);
  if (css) node.className = css;
  if (text != null) node.textContent = text;
  return node;
};
const button = (css, text, fn) => {
  const node = make('button', css, text);
  node.type = 'button';
  node.addEventListener('click', fn);
  return node;
};
const projectQuestion = '数据库上课地点和上课时间是什么？';
const examples = [
  ['数据库在哪上课？', '数据库上课地点', '2026-11-21', '计科2班', 'auto'],
  ['数据库作业什么时候交？', '数据库作业一截止时间', '2026-11-21', '计科2班', 'auto'],
  ['图书馆几点暂停开放？', '图书馆二层开放安排', '2026-11-21', '计科2班', 'auto'],
  ['数据库教室改到哪里了？', '数据库上课地点有什么变化？', '2026-11-21', '计科2班', 'compare']
];
let docs = [];
let requestNumber = 0;
let activeRequest;
let storageIssue = '';
let searchEpoch = 0;
let searchClosing;
let toastEpoch = 0;

function readEntries() {
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(saved)) throw new Error('保存的资料格式有误。');
  const all = [...seed];
  for (const doc of saved) {
    validateDocument(doc, all);
    all.push(doc);
  }
  return all;
}
function refresh() {
  try {
    docs = readEntries();
    storageIssue = '';
  } catch {
    docs = [...seed];
    storageIssue = '本机保存的资料暂时无法读取。本次只展示课程示例资料。';
  }
  $('#nav-count').textContent = docs.length;
  renderLibrary();
  renderDashboard();
  renderNotices();
  $('#topic-list').replaceChildren(...[...new Set(docs.map(d => d.topic))].map(topic => new Option(topic)));
}
const viewNames = {home:'首页',space:'课程空间',notices:'通知中心',schedule:'日程',ask:'通知问答',library:'课程资料',help:'使用帮助'};
let activeView = Object.hasOwn(viewNames,location.hash.slice(1)) ? location.hash.slice(1) : 'home';
function navigate(view, focus = false) {
  if (!viewNames[view]) view = 'home';
  const previousView = activeView;
  if (previousView !== view) closeControl({animate:false});
  activeView = view;
  for (const id of Object.keys(viewNames)) $('#' + id).hidden = id !== view;
  document.querySelectorAll('[data-view]').forEach(node => {
    const active = node.dataset.view === view;
    node.classList.toggle('active', active);
    if (active) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  if (view === 'home') {
    const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hour12:false}).format(new Date()));
    const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    $('#page-title').replaceChildren(make('span','greeting-prefix',greeting + '，'),make('strong','greeting-name',ui.role === 'teacher' ? '老师' : '同学'));
  } else $('#page-title').textContent = viewNames[view];
  $('#page-subtitle').hidden = view !== 'home';
  document.title = '时知 NowPast · ' + viewNames[view];
  $('.nav-indicator').hidden = view === 'help';
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  requestAnimationFrame(updateIndicators);
  syncControls();
  if (focus && previousView !== view) animateRoute($('#'+view),Object.keys(viewNames).indexOf(view)>Object.keys(viewNames).indexOf(previousView)?1:-1);
  if (focus) $('#page-title').scrollIntoView({block:'start'});
}
function researchList(refs) {
  const panel = make('div','research');
  if (!refs.length) return panel;
  panel.append(make('h3','','研究来源'));
  for (const ref of refs) {
    const link = make('a','research-link',ref.kind+' · '+ref.title+'');
    link.href = ref.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    panel.append(link,make('p','research-note',ref.note));
  }
  return panel;
}
function sourceDetails(doc) {
  const detail = $('#source-detail');
  const heading = make('h2', '', doc.title);
  heading.id = 'source-title';
  const fields = make('dl');
  const oldTitles = (doc.supersedes || []).map(id => docs.find(d => d.id === id)?.title || id);
  for (const [name, value] of [
    ['条款主题', doc.topic], ['适用范围', doc.scope], ['公布日期', doc.published],
    ['生效日期', doc.effective], ['导入日期', doc.imported], ['替代条款', oldTitles.join('、') || '无明确声明'],
    ['原文定位', doc.id]
  ]) fields.append(make('dt', '', name), make('dd', '', value || '未知'));
  detail.replaceChildren(heading, fields, make('h3', 'field-head', '原文片段'), make('blockquote', 'quote', doc.text));
  detail.append(noticeConnections({docs:[doc]},false,true));
  detail.append(researchList(references.filter(r=>doc.refs?.includes(r.id))));
  sourceOrigin = document.activeElement;
  markRead([doc.id]);
  openDialog($('#source-dialog'));
}
function evidenceList(items) {
  const ul = make('ul', 'ev-list');
  for (const { doc, role } of items) {
    const li = make('li');
    const link = button('source-link', '', () => sourceDetails(doc));
    link.setAttribute('aria-label', role + '，核查原文：' + doc.title);
    link.append(make('span', 'ev-role', role), make('strong', '', doc.title), make('span', 'arrow', ''));
    li.append(link, make('div', 'fine', (doc.published || '公布时间未知') + ' · ' + doc.scope + ' · ' + doc.topic));
    ul.append(li);
  }
  return ul;
}
function revisionGraph(items) {
  const records = new Map(items.map(({doc}) => [doc.id, doc]));
  const graph = make('div', 'revision-graph');
  const chronological = [...records.values()].sort((a, b) => a.published.localeCompare(b.published) || a.id.localeCompare(b.id));
  for (const doc of chronological) {
    const parents = doc.supersedes.map(id => records.get(id)).filter(Boolean);
    if (!parents.length) continue;
    const row = make('div', 'relation');
    parents.forEach((parent, i) => {
      if (i) row.append(make('span', 'fine', '+'));
      row.append(button('graph-node', parent.id, () => sourceDetails(parent)));
    });
    row.append(make('span', 'arrow', '→'), button('graph-node', doc.id, () => sourceDetails(doc)));
    graph.append(row);
  }
  if (graph.childElementCount) graph.prepend(make('div', 'graph-title', '明确替代关系 · 旧条款 → 新条款'));
  return graph;
}
async function generate(btn, out, query, serial) {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), 120000);
  btn.disabled = true;
  btn.dataset.busy = 'true';
  btn.setAttribute('aria-busy','true');
  const originalLabel = btn.textContent;
  btn.textContent = '正在整理';
  out.textContent = '正在整理回答…';
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, docs }), signal });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('此站点未连接本地模型服务。');
    const data = await response.json();
    if (!response.ok || !data.text) throw new Error(data.error || '模型服务未返回整理结果。');
    if (serial === requestNumber) out.textContent = '整理结果\n' + data.text;
  } catch (err) {
    if (serial === requestNumber) out.textContent = '模型整理未完成。' + (signal.aborted ? '请求已超时。' : err.message) + ' 上方证据仍可核查。';
  } finally {
    clearTimeout(timer);
    if (serial === requestNumber) {
      btn.disabled = false;
      delete btn.dataset.busy;
      btn.setAttribute('aria-busy','false');
      btn.textContent = originalLabel;
    }
  }
}
function renderResult(result, query, serial) {
  const panel = $('#result');
  const top = make('div', 'result-head');
  top.append(make('h2', '', '查证结果'), make('span', 'fine', result.researchOnly ? '原始论文与固定源码版本' : (result.date || query.date) + ' · ' + (result.scope || query.scope)));
  const grid = make('div', 'answer-grid');
  const article = make('article', 'answer-body');
  article.append(make('span', 'badge ' + result.status, result.label));
  const sections = result.sections || [];
  if (sections.length) {
    const groups = make('div', 'claim-groups');
    for (const section of sections) {
      const block = make('section', 'claim-block');
      const heading = make('h3', 'claim-head', (section.scope !== result.scope ? section.scope + ' · ' : '') + section.topic);
      const state = make('small', 'claim-state ' + section.status, section.label);
      heading.append(state);
      const copy = make('p', 'claim-copy');
      const records = new Map((section.items || []).map(({ doc }) => [doc.id, doc]));
      const cited = new Set();
      for (const part of section.summary.split(/(\[[\w-]+\])/g)) {
        const doc = records.get(part.slice(1, -1));
        if (part.startsWith('[') && doc) {
          const cite = button('inline-cite', part, () => sourceDetails(doc));
          cite.title = doc.title;
          copy.append(cite);
          cited.add(doc.id);
        } else copy.append(document.createTextNode(part));
      }
      block.append(heading, copy);
      const links = make('div', 'claim-links');
      for (const { doc, role } of section.items || []) {
        if (cited.has(doc.id)) continue;
        links.append(button('inline-cite', role + ' · ' + doc.id + '', () => sourceDetails(doc)));
        links.lastChild.title = role + ' · ' + doc.title;
      }
      if (links.childElementCount) block.append(links);
      groups.append(block);
    }
    article.append(groups);
  } else article.append(make('p', 'answer-copy', result.summary));
  const out = make('p', 'model-output');
  out.setAttribute('aria-live', 'polite');
  const controls = make('div', 'answer-bottom');
  const btn = button('model-btn', '整理回答', () => generate(btn, out, query, serial));
  controls.append(btn);
  if (!result.researchOnly) article.append(controls, out);
  const evidence = make('aside', 'evidence panel');
  evidence.append(make('h3', '', '引用与版本依据'));
  if (result.items?.length) evidence.append(revisionGraph(result.items), evidenceList(result.items));
  else if (!result.research?.length) evidence.append(make('p', 'empty', '当前查询没有可引用的条款。'));
  if (result.research?.length) evidence.append(researchList(result.research));
  grid.append(article, evidence);
  panel.replaceChildren(top, grid);
}
function run() {
  const question = $('#question').value.trim();
  const error = $('#query-error');
  const date = $('#as-of').value;
  const serial = ++requestNumber;
  activeRequest?.abort();
  if (!question || !date) {
    error.textContent = '请填写问题并选择有效日期。';
    $('#result').replaceChildren();
    return;
  }
  try {
    setContext(date, $('#scope').value);
    const query = { question, date, scope: $('#scope').value, mode: $('#mode').value };
    renderResult(answer(docs, question, query), query, serial);
    error.textContent = storageIssue;
  } catch (e) {
    $('#result').replaceChildren();
    error.textContent = '查证未完成。' + e.message;
  }
}
function renderLibrary() {
  const list=$('#library-list');
  const filter=$('#filter').value.trim().toLowerCase();
  const matches=noticeGroups().filter(group=>[group.title,group.scope,...group.docs.map(doc=>doc.text)].join(' ').toLowerCase().includes(filter));
  $('#library-count').textContent=matches.length+' 份通知';
  list.replaceChildren(...matches.map(group=>{
    const row=button('row-btn','',()=>openNotice(group));
    const title=make('span');
    title.append(make('strong','',group.title),make('span','row-meta',(group.published || '公布时间待确认')+' · '+(group.docs[0].issuer || group.scope)));
    row.append(title,make('span','row-out','查看原文'));return row;
  }));
  if (!matches.length) list.append(make('p','empty','未找到通知'));
  if (storageIssue) list.prepend(make('p','error',storageIssue));
}
const importForm = $('#import-form');
function updateTargets() {
  const container = $('#targets');
  const chosen = new Set(new FormData(importForm).getAll('supersedes'));
  const topic = importForm.elements.topic.value.trim();
  const scope = importForm.elements.scope.value;
  const candidates = docs.filter(d => d.topic === topic && (d.scope === scope || d.scope === '全班' || scope === '全班'));
  container.replaceChildren(...candidates.map(d => {
    const label = make('label', 'target');
    const input = make('input');
    input.type = 'checkbox';
    input.name = 'supersedes';
    input.value = d.id;
    input.checked = chosen.has(d.id);
    label.append(input, make('span', '', d.title + ' · ' + d.id + ' · ' + d.scope));
    return label;
  }));
  if (!candidates.length) container.append(make('span', 'fine', '此主题与范围下暂无旧条款。'));
}

// Dashboard state stays in this browser; course evidence keeps its original schema.
const uiKey = 'nowpast.workspace.ui.v1';
function loadUI() {
  try {
    const saved = JSON.parse(localStorage.getItem(uiKey) || '{}');
    return {
      read: Array.isArray(saved.read) ? saved.read.filter(x => typeof x === 'string') : [],
      saved: Array.isArray(saved.saved) ? saved.saved.filter(x => typeof x === 'string') : [],
      checks: Array.isArray(saved.checks) ? saved.checks.filter(x => typeof x === 'string') : [],
      role: saved.role === 'teacher' ? 'teacher' : 'student', collapsed: saved.collapsed === true
    };
  } catch { return {read:[],saved:[],checks:[],role:'student',collapsed:false}; }
}
let ui = loadUI();
let contextDate = today();
let contextScope = '计科2班';
let calendarDay = contextDate;
let calendarFocused = false;
let homeFilter = 'all';
let noticeFilter = 'all';
let sourceOrigin;
let sourceNoticeId;
let toastTimer;
const dateObject = date => new Date(date + 'T12:00:00Z');
const dayAfter = (date, amount) => {
  const value = dateObject(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};
const shortDate = date => date ? Number(date.slice(5, 7)) + ' 月 ' + Number(date.slice(8, 10)) + ' 日' : '日期待核';
const weekday = date => ['周日','周一','周二','周三','周四','周五','周六'][dateObject(date).getUTCDay()];
const icon = name => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class','icon');
  svg.setAttribute('aria-hidden','true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href','#i-' + name);
  svg.append(use);
  return svg;
};
function persistUI() {
  try { localStorage.setItem(uiKey, JSON.stringify(ui)); return true; }
  catch { toast('浏览器未允许保存，更改仅在本次访问有效。'); return false; }
}
function toast(message, undo) {
  clearTimeout(toastTimer);
  toastEpoch++;
  $('#toast').getAnimations().forEach(animation=>animation.cancel());
  $('#toast-message').textContent = message;
  $('#toast-undo').hidden = !undo;
  $('#toast-undo').onclick = undo ? () => { undo(); dismissToast(); } : null;
  $('#toast').hidden = false;
  toastTimer = setTimeout(dismissToast,undo ? 9000 : 4500);
}
function dismissToast() {
  clearTimeout(toastTimer);
  const epoch = toastEpoch;
  const element = $('#toast');
  if (element.hidden) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) { element.hidden = true; return; }
  const animation = element.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(8px)'}],{duration:150,easing:'cubic-bezier(.16,1,.3,1)'});
  animation.finished.catch(()=>{}).then(()=>{if(epoch===toastEpoch)element.hidden=true;});
}
function emptyState(message, kind = 'calendar', action, callback) {
  const node = make('div','empty-state');
  node.append(icon(kind), make('p','',message));
  if (action) node.append(button('text-button',action,callback));
  return node;
}
function selectedGroups() { return contextScope === '全校' ? ['计科1班','计科2班'] : [contextScope]; }
function currentDocs(topic, group = contextScope) {
  const groups = group === '全校' ? ['计科1班','计科2班'] : [group];
  return [...new Map(groups.flatMap(g => snapshot(docs,contextDate,g,topic).current).map(d => [d.id,d])).values()];
}
function documentStates() {
  const states = new Map();
  const rank = {past:0,uncertain:1,scheduled:2,current:3,conflict:4};
  for (const topic of new Set(docs.map(d => d.topic))) {
    for (const group of selectedGroups()) {
      const view = snapshot(docs,contextDate,group,topic);
      const conflict = new Set(view.current.map(d => d.value.replace(/\s/g,''))).size > 1;
      for (const [kind, list] of [['past',view.past],['uncertain',view.uncertain],['scheduled',view.scheduled],[conflict?'conflict':'current',view.current]]) {
        for (const doc of list) if (!states.has(doc.id) || rank[kind] > rank[states.get(doc.id)]) states.set(doc.id,kind);
      }
    }
  }
  return states;
}
function noticeGroups() {
  const states = documentStates();
  const groups = new Map();
  for (const doc of docs) {
    if (!states.has(doc.id)) continue;
    const id = [doc.noticeId || doc.title,doc.published,doc.scope].join('|');
    if (!groups.has(id)) groups.set(id,{id,title:doc.title,published:doc.published,scope:doc.scope,docs:[]});
    groups.get(id).docs.push(doc);
  }
  return [...groups.values()].map(group => {
    const kinds = group.docs.map(doc => states.get(doc.id));
    group.state = kinds.includes('conflict') ? 'conflict' : kinds.includes('current') ? 'current' : kinds.includes('scheduled') ? 'scheduled' : kinds.includes('uncertain') ? 'uncertain' : 'past';
    group.label = group.state === 'current' && kinds.includes('past') ? '部分更新' : ({current:'现行',conflict:'材料冲突',scheduled:'待生效',uncertain:'时间待核',past:'已替代'})[group.state];
    group.unread = group.docs.some(doc => !ui.read.includes(doc.id));
    group.saved = ui.saved.includes(group.id);
    group.changed = group.docs.some(doc => doc.supersedes.length > 0);
    return group;
  }).sort((a,b) => (b.published || b.docs[0].imported).localeCompare(a.published || a.docs[0].imported) ||
    (b.docs.map(doc=>doc.analysis?.analyzedAt || '').sort().at(-1) || '').localeCompare(a.docs.map(doc=>doc.analysis?.analyzedAt || '').sort().at(-1) || ''));
}
function markRead(ids) {
  ui.read = [...new Set([...ui.read,...ids])];
  persistUI();
  updateCounters();
}
function updateCounters() {
  const groups = noticeGroups().filter(g => g.state !== 'past');
  const unread = groups.filter(g => g.unread).length;
  $('#nav-notice-count').textContent = unread || '';
  $('#home-unread').textContent = unread ? unread + ' 条未读' : '';
  $('#bell-dot').hidden = unread === 0;
  $('#notification-shortcut').setAttribute('aria-label','查看未读通知，' + unread + ' 条');
}
function filteredNotices(groups, filter, query = '') {
  const q = query.trim().toLowerCase();
  return groups.filter(group => (filter !== 'unread' || group.unread) &&
    (filter !== 'changed' || group.changed) && (filter !== 'saved' || group.saved) &&
    (!q || [group.title,group.scope,...group.docs.flatMap(d => [d.topic,d.value,d.text])].join(' ').toLowerCase().includes(q)));
}
function currentNoticeGroups() {
  const seen=new Set();
  return noticeGroups().filter(group=>{
    if (group.state==='past') return false;
    const activity=group.docs[0].activity || group.id;
    const id=activity+'|'+group.scope;
    if (seen.has(id)) return false;
    seen.add(id);return true;
  });
}
function bookmark(group, origin) {
  const listId = origin.closest('.notice-list').id;
  const position = [...$('#' + listId).querySelectorAll('.notice-bookmark')].indexOf(origin);
  const wasSaved = ui.saved.includes(group.id);
  ui.saved = wasSaved ? ui.saved.filter(id => id !== group.id) : [...ui.saved,group.id];
  if (persistUI()) toast(wasSaved ? '已取消收藏' : '已收藏通知');
  renderHomeNotices();
  renderNotices();
  const buttons = [...$('#' + listId).querySelectorAll('.notice-bookmark')];
  const nextFocus = buttons.find(node => node.dataset.bookmarkId === group.id) ||
    buttons[Math.min(position,buttons.length - 1)] ||
    $(listId === 'home-notices' ? '#home-tabs button[data-filter="' + homeFilter + '"]' : '#notice-tabs button[data-filter="' + noticeFilter + '"]');
  nextFocus?.focus({preventScroll:true});
  animateBookmark(nextFocus);
}
function noticeRow(group) {
  const row = make('article','notice-item');
  const open = button('notice-main','',() => openNotice(group));
  open.dataset.noticeId = group.id;
  const kind = make('span','notice-kind' + (group.docs.some(d => d.topic === '截止时间') ? ' paper' : ''));
  kind.append(icon(group.docs[0].id.startsWith('M') || group.docs[0].id.startsWith('F') ? 'link' : group.docs.some(d => d.topic === '验收地点') ? 'pin' : group.docs.some(d => d.topic === '截止时间') ? 'clock' : 'file'));
  const content = make('span','notice-content');
  const title = make('span','notice-title-row');
  title.append(make('strong','notice-title',group.title));
  if (group.unread) { const dot = make('span','unread-dot'); dot.setAttribute('aria-label','未读'); title.append(dot); }
  const meta = make('span','notice-meta');
  meta.append(make('span','',group.docs[0].issuer || group.scope),make('span','meta-divider'),make('time','',shortDate(group.published)+' 发布'));
  if (!['current'].includes(group.state)) meta.append(make('span','status '+group.state,group.label));
  const execution=executionFor(group.docs,docs,{date:contextDate,scope:contextScope});
  const plan=make('span','notice-execution');
  for (const [name,value] of [['clock',execution.when],['pin',execution.where],['check',execution.action]]) {
    const line=make('span','execution-line');line.append(icon(name),document.createTextNode(value));plan.append(line);
  }
  content.append(title,plan,meta);
  open.append(kind,content);
  const save = button('notice-bookmark','',() => bookmark(group,save));
  save.dataset.bookmarkId = group.id;
  save.append(icon('bookmark'));
  save.setAttribute('aria-label',(group.saved ? '取消收藏：' : '收藏：') + group.title);
  save.setAttribute('aria-pressed',String(group.saved));
  const body=make('div','notice-body');
  body.append(open,noticeConnections(group));
  row.append(body,save);
  return row;
}
function noticeConnections(group,featured = false,expanded = false) {
  const container=make('div','notice-connections'+(featured?' feature-connections':''));
  const relations=relationsFor(group.docs,docs,{date:contextDate,scope:contextScope});
  if (!relations.length) {
    return container;
  }
  const previous=relations.some(relation=>relation.direction==='previous');
  if (!previous && !expanded) {
    return container;
  }
  container.append(make('span','connection-heading',previous?'原通知':'后续通知'));
  const groups=new Map();
  for (const relation of relations) {
    const target=relation.direction==='previous'?relation.prior:relation.doc;
    const id=[target.title,target.published,target.scope,relation.direction].join('|');
    if (!groups.has(id)) groups.set(id,{target,relations:[]});
    groups.get(id).relations.push(relation);
  }
  for (const {target,relations:links} of groups.values()) {
    const entry=make('div','connection-entry');
    const open=button('connection-link',target.title,()=>{
      const related=noticeGroups().find(notice=>notice.docs.some(doc=>doc.id===target.id));
      if (related) openNotice(related); else sourceDetails(target);
    });
    open.setAttribute('aria-label','打开关联通知：'+target.title+'，'+(target.published || '公布日期待核'));
    entry.append(open,make('span','connection-date',(target.published || '日期待核')+' · '+target.scope));
    if (previous && expanded) {
      if (!expanded && links.length>1) {
        const effective=[...new Set(links.map(link=>link.doc.effective))];
        entry.append(make('p','connection-change',links.map(link=>link.doc.topic).join('、')+'已更新'),
          make('span','change-effective',effective.length===1 && effective[0]?shortDate(effective[0])+' 生效':'各项生效日期见原文'));
        container.append(entry);
        continue;
      }
      for (const {doc,prior,kind,label} of links) {
        const change=make('p','connection-change');
        change.append(make('span','change-topic',''));
        change.append(document.createTextNode(prior.value===doc.value?'沿用 '+doc.value:prior.value+' 改为 '+doc.value));
        change.append(make('span','change-effective',doc.effective?shortDate(doc.effective)+' 生效':'生效日期待核'));
        if (kind==='parallel') change.lastChild.textContent='并行依据，未替代旧通知';
        entry.append(change);
      }
    }
    container.append(entry);
  }
  return container;
}
function openNotice(group) {
  sourceOrigin = document.activeElement;
  sourceNoticeId = group.id;
  markRead(group.docs.map(doc => doc.id));
  const heading = make('h2','',group.title); heading.id = 'source-title';
  const meta = make('div','notice-meta');
  meta.append(make('span','',shortDate(group.published)),make('span','',group.scope),make('span','status '+group.state,group.label));
  const fragment = document.createDocumentFragment();
  fragment.append(heading,meta,noticeConnections(group,false,true));
  const states = documentStates();
  for (const doc of group.docs) {
    const section = make('section','notice-detail-clause');
    const head = make('div','section-heading');
    const state = states.get(doc.id);
    head.append(make('h3','',doc.topic),make('span','status '+state,({current:'现行',past:'已替代',scheduled:'待生效',conflict:'材料冲突',uncertain:'时间待核'})[state]));
    section.append(head,make('p','',doc.excerpt || doc.text));
    const details = make('div','notice-meta');
    details.append(make('span','',doc.effective ? shortDate(doc.effective) + ' 生效' : '生效日期待核'));
    details.append(button('text-button','条款 ' + doc.id,() => sourceDetails(doc)));
    section.append(details);
    fragment.append(section);
  }
  const refs = references.filter(ref => group.docs.some(doc => doc.refs?.includes(ref.id)));
  if (group.docs.some(doc=>doc.analysis?.method==='rag-notice-intake')) {
    const original=make('details','notice-original');
    original.append(make('summary','','查看通知完整原文'),make('p','quote',group.docs[0].text));
    fragment.append(original);
  }
  if (refs.length) fragment.append(researchList(refs));
  const actions = make('div','notice-detail-actions');
  actions.append(button('primary','核查这条通知',async () => {
    await closeDialog($('#source-dialog'));
    askQuestion(group.docs.map(doc => doc.topic).join('、') + '现在按什么要求执行？', contextDate, contextScope);
  }));
  $('#source-detail').replaceChildren(fragment);
  openDialog($('#source-dialog'));
}
function renderFeature() {
  const groups = currentNoticeGroups();
  const group = groups.find(g => g.state!=='past' && g.docs.some(doc=>doc.field==='deadline')) || groups.find(g => g.state !== 'past');
  const feature = $('#featured-notice');
  if (!group) { feature.replaceChildren(emptyState('暂无已公布的通知','bell')); return; }
  feature.dataset.noticeId = group.id;
  const top = make('div','feature-top');
  const scope = make('span','feature-label'); scope.append(icon('bell'),document.createTextNode(group.docs[0].issuer || group.scope));
  top.append(scope);
  const title = make('h2','',group.title);
  const execution=executionFor(group.docs,docs,{date:contextDate,scope:contextScope});
  const value = make('p','feature-value',execution.when);
  const actionText=make('p','feature-action',execution.where+' · '+execution.action);
  const bottom = make('div','feature-bottom');
  const meta = make('span','feature-meta'); meta.append(icon('clock'),document.createTextNode(shortDate(group.published) + ' 发布'));
  const action = button('feature-button','查看通知',() => openNotice(group)); action.append(icon('arrow'));
  bottom.append(meta,action);
  feature.replaceChildren(top,title,value,actionText,noticeConnections(group,true),bottom);
}
function renderHomeNotices() {
  let groups = currentNoticeGroups().filter(g => !['uncertain'].includes(g.state));
  const featureId = $('#featured-notice').dataset.noticeId;
  groups = filteredNotices(groups,homeFilter).filter(g => g.id !== featureId).slice(0,3);
  const list = $('#home-notices');
  list.replaceChildren(...groups.map(noticeRow));
  if (!groups.length) list.append(emptyState(homeFilter === 'unread' ? '当前通知已全部读完' : '暂无匹配的通知','bell','查看全部通知',() => navigate('notices')));
  updateCounters();
  requestAnimationFrame(updateIndicators);
}
function renderNotices() {
  syncControls();
  const state = $('#notice-status').value;
  let groups = (state==='active'?currentNoticeGroups():noticeGroups()).filter(g => state === 'all' || state==='active' || g.state === state);
  groups = filteredNotices(groups,noticeFilter,$('#notice-search').value);
  $('#notice-result-count').textContent = groups.length + ' 条通知';
  $('#notice-list').replaceChildren(...groups.map(noticeRow));
  if (!groups.length) $('#notice-list').append(emptyState(noticeFilter === 'saved' ? '还没有收藏的通知' : noticeFilter === 'unread' ? '当前筛选下没有未读通知' : '没有匹配的通知','bell','重置筛选',() => {
    noticeFilter = 'all'; $('#notice-search').value = ''; $('#notice-status').value = 'active'; renderNotices();
  }));
  $('#mark-all-read').disabled = !noticeGroups().some(g => g.unread);
  requestAnimationFrame(updateIndicators);
}
function scheduleEvents() {
  const events=new Map();
  for (const group of noticeGroups().filter(group=>group.state!=='past')) {
    const execution=executionFor(group.docs,docs,{date:contextDate,scope:contextScope});
    if (!execution.date || !execution.time || execution.conflict || events.has(execution.activity)) continue;
    events.set(execution.activity,{...execution,id:execution.activity,title:execution.course || group.title,destination:execution.where,
      scope:group.scope,doc:group.docs[0]});
  }
  return [...events.values()].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
function eventRow(event) {
  const row = button('agenda-event','',() => sourceDetails(event.doc));
  const date = make('span','event-date');
  date.append(make('strong','',event.date.slice(8)),make('span','',Number(event.date.slice(5,7)) + '月 · ' + weekday(event.date)));
  const content = make('span','event-content');
  content.append(make('h3','',event.title),make('p','event-task',event.action));
  const location = make('p'); location.append(icon('folder'),document.createTextNode(event.destination));
  content.append(location);
  const time = make('p'); time.append(icon('clock'),make('span','event-time',event.time + (event.type==='assignment'?' 前':'')),make('span','',event.scope));
  content.append(time);
  row.append(date,content);
  return row;
}
function renderWeek(container) {
  const start = dayAfter(calendarDay,-((dateObject(calendarDay).getUTCDay()+6)%7));
  const events = scheduleEvents();
  const indicator = container.querySelector('.calendar-selection') || make('span','calendar-selection');
  indicator.setAttribute('aria-hidden','true');
  container.replaceChildren(indicator,...Array.from({length:7},(_,index) => {
    const date = dayAfter(start,index);
    const hasEvent = events.some(event => event.date === date);
    const node = button('day-button' + (date === today() ? ' is-today' : '') + (hasEvent ? ' has-event' : ''),'',() => {
      calendarDay = date; calendarFocused = true; renderSchedule();
      const selectedButton = container.querySelector('[data-date="' + calendarDay + '"]');
      selectedButton?.focus({preventScroll:true});
    });
    node.dataset.date = date;
    node.setAttribute('aria-pressed',String(calendarDay === date));
    node.setAttribute('aria-label',shortDate(date) + '，' + weekday(date) + (hasEvent ? '，有安排' : ''));
    node.append(make('span','weekday',weekday(date)),make('span','day-number',String(Number(date.slice(8)))));
    node.onkeydown = event => {
      const offsets = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-index,End:6-index};
      if (!(event.key in offsets)) return;
      event.preventDefault();
      calendarDay = dayAfter(date,offsets[event.key]); calendarFocused = true;
      const targetId = container.id; renderSchedule();
      document.querySelector('#' + targetId + ' [data-date="' + calendarDay + '"]')?.focus();
    };
    return node;
  }));
  requestAnimationFrame(()=>updateCalendarIndicator(container));
}
function renderSchedule() {
  const month = Number(calendarDay.slice(0,4)) + ' 年 ' + Number(calendarDay.slice(5,7)) + ' 月';
  $('#mini-month').textContent = month;
  $('#schedule-month').textContent = month;
  renderWeek($('#mini-week')); renderWeek($('#schedule-week'));
  const events = scheduleEvents();
  const selected = events.filter(event => event.date === calendarDay);
  const upcoming = events.filter(event => event.date >= contextDate && event.date !== calendarDay);
  const homeEvents = calendarFocused ? selected : events.filter(event => event.date >= contextDate).slice(0,1);
  $('#agenda-range-title').textContent = calendarFocused ? shortDate(calendarDay) + ' · ' + weekday(calendarDay) : '接下来';
  $('#home-agenda').replaceChildren(...homeEvents.map(eventRow));
  if (!homeEvents.length) $('#home-agenda').append(make('p','empty',calendarFocused ? '当天暂无已公布安排' : '暂无后续安排'));
  $('#selected-day-title').textContent = shortDate(calendarDay) + ' · ' + weekday(calendarDay);
  $('#selected-day-count').textContent = selected.length + ' 项安排';
  $('#day-agenda').replaceChildren(...selected.map(eventRow));
  if (!selected.length) $('#day-agenda').append(emptyState('当天暂无已公布安排','calendar',upcoming.length ? '查看下一项安排' : null,() => {
    calendarDay = upcoming[0].date; calendarFocused = true; renderSchedule();
  }));
  $('#upcoming-agenda').replaceChildren(...upcoming.map(eventRow));
  if (!upcoming.length) $('#upcoming-agenda').append(make('p','empty','暂无后续安排'));
  $('#home-room').replaceChildren();
  $('#schedule-rooms').replaceChildren(...events.filter(event=>event.type==='course' && event.date>=contextDate).map(event=>{
    const section=make('section','room-detail');
    section.append(make('h3','',event.title),make('p','',event.when || event.date+' '+event.time),make('p','',event.destination),
      button('text-button','查看通知',()=>sourceDetails(event.doc)));
    return section;
  }));
  if (!$('#schedule-rooms').childElementCount) $('#schedule-rooms').append(make('p','empty','暂无课程安排'));
}
function renderChecklist() {
  const values = new Map();
  let hasConflict = false;
  for (const group of selectedGroups()) {
    for (const topic of new Set(docs.filter(doc=>doc.noticeType==='assignment' && doc.field==='task').map(doc=>doc.topic))) {
      const current = snapshot(docs,contextDate,group,topic).current;
      if (new Set(current.map(doc => doc.value)).size > 1) { hasConflict = true; continue; }
      for (const doc of current) {
        if (!values.has(doc.id)) values.set(doc.id,{doc,groups:new Set()});
        values.get(doc.id).groups.add(group);
      }
    }
  }
  const keyFor = item => [ui.role,contextScope,item.doc.id].join('|');
  const completed = () => [...values.values()].filter(item => ui.checks.includes(keyFor(item))).length + ' / ' + values.size;
  $('#checklist-count').textContent = completed();
  $('#checklist').replaceChildren(...[...values.values()].map(item => {
    const {doc,groups} = item;
    const row = make('label','checklist-row');
    const input = make('input'); input.type = 'checkbox'; input.checked = ui.checks.includes(keyFor(item));
    const check = make('span','checkmark'); check.setAttribute('aria-hidden','true'); check.append(icon('check'));
    const label = make('span','checklist-label',(contextScope === '全班' && groups.size < 2 ? [...groups].join('、') + ' · ' : '') + doc.value);
    input.onchange = () => {
      const checkKey = keyFor(item);
      ui.checks = input.checked ? [...new Set([...ui.checks,checkKey])] : ui.checks.filter(key => key !== checkKey);
      persistUI();
      $('#checklist-count').textContent = completed();
    };
    row.append(input,check,label); return row;
  }));
  if (!values.size) $('#checklist').append(make('p','empty','暂无待交作业'));
  if (hasConflict) $('#checklist').append(button('text-button','作业要求待确认',() => navigate('notices',true)));
}
// Move the same nodes at the breakpoint so visual and keyboard reading order agree.
function syncHomeLayout() {
  const overview = $('.overview-grid');
  const focused = document.activeElement;
  const feature = $('#featured-notice'), agenda = $('.agenda-panel'), notices = $('.latest-section');
  const preparation = $('.preparation-panel'), question = $('#quick-ask-form');
  const mobile = window.matchMedia('(max-width:900px)').matches;
  if (mobile && overview.querySelector('.notice-column')) {
    overview.replaceChildren(feature,agenda,notices,preparation,question);
  } else if (!mobile && !overview.querySelector('.notice-column')) {
    const left = make('div','notice-column'), right = make('div','schedule-column');
    left.append(feature,notices,question); right.append(agenda,preparation);
    overview.replaceChildren(left,right);
  }
  if (focused !== document.activeElement && focused?.isConnected && overview.contains(focused)) focused.focus({preventScroll:true});
}
function renderSpace() {
  const list=$('#course-requirements');
  const seen=new Set();
  list.replaceChildren();
  for (const group of noticeGroups().filter(group=>group.state!=='past' && group.docs[0].noticeType!=='school')) {
    const execution=executionFor(group.docs,docs,{date:contextDate,scope:contextScope});
    if (seen.has(execution.activity)) continue;
    seen.add(execution.activity);
    const row=button('row-btn','',()=>openNotice(group));
    const copy=make('span');
    copy.append(make('strong','',group.title),make('span','row-meta',execution.when),make('p','',execution.where+' · '+execution.action));
    row.append(copy);list.append(row);
  }
  if (!list.childElementCount) list.append(make('p','empty','暂无课程和作业通知'));
}
function renderDashboard() { renderFeature(); renderHomeNotices(); renderSchedule(); renderChecklist(); renderSpace(); }
function setContext(date,scope) {
  if (!validDay(date)) return;
  const changed = contextDate !== date || contextScope !== scope;
  contextDate = date; contextScope = scope;
  $('#context-date').value = date; $('#context-scope').value = scope;
  $('#as-of').value = date; $('#scope').value = scope;
  syncControls();
  if (changed) { calendarDay = date; calendarFocused = false; renderDashboard(); renderNotices(); }
}
function askQuestion(question,date = contextDate,scope = contextScope,mode = 'auto') {
  setContext(date,scope);
  $('#question').value = question; $('#mode').value = mode;
  navigate('ask',true); run();
}
function updateIndicators() {
  document.querySelectorAll('.week-strip').forEach(updateCalendarIndicator);
  const nav = $('.main-nav .nav.active');
  if (nav) {
    $('.nav-indicator').style.setProperty('--nav-x',nav.offsetLeft + 'px');
    $('.nav-indicator').style.setProperty('--nav-width',nav.offsetWidth + 'px');
  }
  for (const [selector,filter] of [['#home-tabs',homeFilter],['#notice-tabs',noticeFilter]]) {
    const tabs = $(selector);
    tabs.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed',String(node.dataset.filter === filter)));
    const active = tabs.querySelector('button[aria-pressed="true"]');
    if (active && tabs.offsetWidth) {
      tabs.style.setProperty('--tab-width',active.offsetWidth + 'px');
      tabs.style.setProperty('--tab-x',active.offsetLeft + 'px');
    }
  }
}
function setRole(role) {
  ui.role = role === 'teacher' ? 'teacher' : 'student';
  $('#role-picker').value = ui.role;
  $('#avatar').textContent = ui.role === 'teacher' ? '师' : '同';
  $('#avatar').setAttribute('aria-label',ui.role === 'teacher' ? '教师视角' : '学生视角');
  $('#teacher-import').hidden = ui.role !== 'teacher';
  $('#teacher-import').replaceChildren(icon('plus'),document.createTextNode('发布通知'));
  $('#preparation-title').textContent = '作业清单';
  $('#open-import').hidden=ui.role!=='teacher';
  navigate(activeView);
  renderChecklist();
}
function openImport() {
  fileRead++;
  intakeRequest?.abort();
  importForm.reset();
  const automatic=ui.role==='teacher';
  importForm.dataset.intake=String(automatic);
  $('#import-title').textContent=automatic?'发布课程通知':'添加课程资料';
  $('#notice-text-label').textContent=automatic?'通知完整原文':'原文片段';
  $('#intake-note').hidden=true;
  $('#intake-progress').hidden=true;
  for (const node of importForm.querySelectorAll('[data-teacher-field]')) node.hidden=!automatic;
  for (const node of importForm.querySelectorAll('[data-manual-field]')) {
    node.hidden=automatic;
    node.querySelectorAll('input,select').forEach(input=>{input.disabled=automatic;});
  }
  importForm.elements.topic.required=!automatic;
  importForm.elements.value.required=!automatic;
  importForm.querySelector('button[type="submit"]').textContent=automatic?'发布通知':'保存资料';
  importForm.elements.scope.value = contextScope;
  if (ui.role === 'teacher') {
    importForm.elements.published.value = today();
  }
  $('#import-message').textContent = '';
  updateTargets(); syncControls(); openDialog($('#import-dialog'));
}
document.querySelectorAll('[data-view]').forEach(node => node.addEventListener('click',() => navigate(node.dataset.view,true)));
document.querySelectorAll('.brand,.mobile-brand').forEach(node => node.addEventListener('click',event => { event.preventDefault(); navigate('home',true); }));
$('#context-date').onchange = event => {
  if (!validDay(event.target.value)) { event.target.value = contextDate; toast('请选择有效日期'); return; }
  setContext(event.target.value,contextScope);
  if (activeView === 'ask' && $('#question').value.trim()) run();
};
$('#context-scope').onchange = event => { setContext(contextDate,event.target.value); if (activeView === 'ask' && $('#question').value.trim()) run(); };
$('#role-picker').onchange = event => { setRole(event.target.value); persistUI(); };
for (const [selector,setFilter] of [['#home-tabs',value => { homeFilter = value; renderHomeNotices(); }],['#notice-tabs',value => { noticeFilter = value; renderNotices(); }]]) {
  $(selector).querySelectorAll('button').forEach(node => node.onclick = () => {
    setFilter(node.dataset.filter);
    animateFilteredList($(selector==='#home-tabs'?'#home-notices':'#notice-list'));
  });
}
$('#notice-search').oninput = renderNotices;
$('#notice-status').onchange = renderNotices;
$('#search-form').onsubmit = event => {
  event.preventDefault(); noticeFilter = 'all'; $('#notice-status').value = 'all';
  $('#notice-search').value = $('#global-search').value; closeSearch(); navigate('notices',true); renderNotices();
};
$('#notification-shortcut').onclick = () => { noticeFilter = 'unread'; $('#notice-status').value = 'active'; $('#notice-search').value = ''; navigate('notices',true); renderNotices(); };
$('#mark-all-read').onclick = () => {
  const added = noticeGroups().flatMap(group => group.docs.map(doc => doc.id)).filter(id => !ui.read.includes(id));
  markRead(added); renderHomeNotices(); renderNotices();
  toast('已将当前范围的通知标为已读',() => {
    ui.read = ui.read.filter(id => !added.includes(id)); persistUI(); renderHomeNotices(); renderNotices();
  });
};
for (const [id,amount] of [['mini-prev',-7],['mini-next',7],['schedule-prev',-7],['schedule-next',7]]) {
  $('#' + id).onclick = () => {
    calendarDay = dayAfter(calendarDay,amount); calendarFocused = true; renderSchedule();
    document.querySelectorAll('.week-strip').forEach(element=>{if(element.offsetParent)animateWeek(element,Math.sign(amount));});
  };
}
for (const id of ['mini-today','schedule-today']) $('#' + id).onclick = () => {
  setContext(today(),contextScope); calendarDay = today(); calendarFocused = false; renderSchedule();
};
$('#quick-ask-form').onsubmit = event => { event.preventDefault(); const question = $('#quick-question').value.trim(); if (question) askQuestion(question); };
$('#ask-form').onsubmit = event => { event.preventDefault(); run(); };
$('#filter').oninput = renderLibrary;
$('#open-import').onclick = openImport;
$('#teacher-import').onclick = openImport;
importForm.elements.topic.oninput = updateTargets;
importForm.elements.scope.onchange = updateTargets;
let fileRead = 0;
let intakeRequest;
$('#text-file').onchange = async event => {
  const serial = ++fileRead;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 60000) throw new Error('请导入一条 12000 字内的 TXT 条款。');
    const contents = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).trim();
    if (serial !== fileRead) return;
    if (!contents || contents.length > 12000) throw new Error('原文应含 1 至 12000 个字符。');
    importForm.elements.text.value = contents;
    if (!importForm.elements.title.value) importForm.elements.title.value = file.name.replace(/\.txt$/i,'').slice(0,100);
    $('#import-message').textContent = '';
  } catch (error) { if (serial === fileRead) $('#import-message').textContent = '读取失败。' + error.message; }
};
importForm.onsubmit = async event => {
  event.preventDefault();
  if (importForm.dataset.intake==='true') {await publishNotice();return;}
  const data = new FormData(importForm);
  const values = Object.fromEntries(data);
  const doc = {id:'local-' + crypto.randomUUID().slice(0,8),imported:today(),aliases:[]};
  for (const field of ['title','published','effective','scope','topic','value','text']) doc[field] = values[field].trim();
  doc.supersedes = data.getAll('supersedes');
  const save = importForm.querySelector('button[type="submit"]');
  const originalLabel = save.textContent;
  save.disabled = true;
  save.dataset.busy = 'true';
  save.setAttribute('aria-busy','true');
  save.textContent = '保存中';
  try {
    const persist = () => {
      const all = readEntries();
      validateDocument(doc,all);
      localStorage.setItem(key,JSON.stringify([...all.slice(seed.length),doc]));
    };
    if (navigator.locks) await navigator.locks.request(key,persist); else persist();
    fileRead++;
    $('#filter').value = '';
    refresh();
    await closeDialog($('#import-dialog'));
    if ($('#question').value.trim()) run();
    sourceDetails(doc);
    toast('资料已保存');
  } catch (error) { $('#import-message').textContent = '保存失败。' + error.message; }
  finally {
    save.disabled = false;
    delete save.dataset.busy;
    save.setAttribute('aria-busy','false');
    save.textContent = originalLabel;
  }
};
async function publishNotice() {
  const data=Object.fromEntries(new FormData(importForm));
  const input={title:data.title.trim(),text:data.text.trim(),published:data.published,scope:data.scope,course:data.course,noticeType:data.noticeType};
  const controller=new AbortController();
  intakeRequest=controller;
  const serial=++fileRead;
  const timer=setTimeout(()=>controller.abort(),180000);
  const submit=importForm.querySelector('button[type="submit"]');
  const editable=[...importForm.querySelectorAll('input,select,textarea')].filter(node=>!node.disabled);
  editable.forEach(node=>node.disabled=true);
  submit.disabled=true;submit.dataset.busy='true';submit.setAttribute('aria-busy','true');submit.textContent='正在发布';
  $('#intake-progress').hidden=false;$('#import-message').textContent='';
  try {
    const response=await fetch('/api/notices/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,docs}),signal:controller.signal});
    if (!response.headers.get('content-type')?.includes('application/json')) throw Error('通知 AI 服务尚未连接，请启动项目服务后重试。');
    const result=await response.json();
    if (!response.ok) throw Error(response.status===503?'发布服务暂时不可用，原文已保留，请重试。':result.error || '发布未完成，请重试。');
    if (controller.signal.aborted || serial!==fileRead) return;
    if (!Array.isArray(result.clauses) || !result.clauses.length) throw Error('AI 未返回可发布的通知要求。');
    const persist=()=>{
      if (controller.signal.aborted || serial!==fileRead) return;
      const all=readEntries();
      for (const doc of result.clauses) {validateDocument(doc,all);all.push(doc);}
      localStorage.setItem(key,JSON.stringify(all.slice(seed.length)));
    };
    if (navigator.locks) await navigator.locks.request(key,persist); else persist();
    if (controller.signal.aborted || serial!==fileRead) return;
    $('#filter').value='';refresh();setContext(input.published,input.scope);
    await closeDialog($('#import-dialog'));
    const group=noticeGroups().find(group=>group.docs.some(doc=>doc.id===result.clauses[0].id));
    if (group) openNotice(group);
    toast('通知已发布');
  } catch(error) {
    if (serial===fileRead) $('#import-message').textContent=controller.signal.aborted?'AI 整理超时，原文已保留，请重试。':error.message;
  } finally {
    clearTimeout(timer);
    if (intakeRequest===controller) {
      editable.forEach(node=>node.disabled=false);
      submit.disabled=false;delete submit.dataset.busy;submit.setAttribute('aria-busy','false');submit.textContent='发布通知';
      $('#intake-progress').hidden=true;intakeRequest=undefined;
    }
  }
}
document.querySelectorAll('[data-close]').forEach(node => node.onclick = () => closeDialog($('#' + node.dataset.close)));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{
  event.preventDefault(); closeDialog(dialog);
}));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click',event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog(dialog);
}));
$('#source-dialog').addEventListener('close',() => {
  renderHomeNotices(); renderNotices();
  const origin = sourceNoticeId ? [...document.querySelectorAll('[data-notice-id]')].find(node => node.tagName === 'BUTTON' && node.dataset.noticeId === sourceNoticeId && node.offsetParent) : sourceOrigin;
  (origin?.isConnected ? origin : sourceOrigin?.isConnected ? sourceOrigin : $('#main')).focus({preventScroll:true});
  sourceNoticeId = null;
});
$('#import-dialog').addEventListener('close',() => { fileRead++;intakeRequest?.abort(); });
$('#toast-close').onclick = dismissToast;
window.addEventListener('hashchange',() => navigate(location.hash.slice(1) || 'home'));
window.addEventListener('storage',event => {
  if (event.key === uiKey || event.key === null) { ui = loadUI(); setRole(ui.role); renderDashboard(); renderNotices(); }
  if (event.key === key || event.key === null) { refresh(); if ($('#question').value.trim()) run(); }
});
window.addEventListener('resize',updateIndicators);
window.matchMedia('(max-width:900px)').addEventListener('change',syncHomeLayout);
document.addEventListener('keydown',event => {
  document.body.classList.add('keyboard-input');
  if (document.querySelector('dialog[open]')) return;
  const editing = event.target.matches('input,textarea,select,[role="combobox"],[contenteditable="true"]');
  if ((event.key === '/' && !editing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
    event.preventDefault();
    if (window.matchMedia('(max-width:700px)').matches) { navigate('notices',true); $('#notice-search').focus(); }
    else openSearch();
  }
});
document.addEventListener('pointerdown',() => document.body.classList.remove('keyboard-input'),{passive:true});
for (const example of examples) $('#examples').append(button('example-btn',example[0],() => askQuestion(example[1],example[2],example[3],example[4])));
$('#context-date').value = contextDate;
$('#as-of').value = contextDate;
$('#scope').value = contextScope;
installControls();
installMotion();
syncHomeLayout();
refresh();
setRole(ui.role);
navigate(location.hash.slice(1) || 'home');
history.scrollRestoration = 'manual';
window.scrollTo({top:0,behavior:'instant'});
window.addEventListener('load',() => window.scrollTo({top:0,behavior:'instant'}),{once:true});

function openSearch() {
  searchEpoch++;
  searchClosing = null;
  $('#search-form').hidden = false;
  $('#toggle-search').setAttribute('aria-expanded','true');
  revealSearch($('#search-form'));
  $('#global-search').focus();
}
function closeSearch() {
  if ($('#toggle-search').getAttribute('aria-expanded')!=='true') return searchClosing || Promise.resolve();
  const epoch = ++searchEpoch;
  $('#toggle-search').setAttribute('aria-expanded','false');
  searchClosing = concealSearch($('#search-form')).then(ready=>{
    if (ready && epoch===searchEpoch) $('#search-form').hidden = true;
  });
  return searchClosing;
}
$('#toggle-search').onclick = () => {
  if ($('#toggle-search').getAttribute('aria-expanded')!=='true') openSearch();
  else { closeSearch(); $('#toggle-search').focus(); }
};
document.addEventListener('click',event => {
  if (!$('#search-form').hidden && !event.target.closest('.header-search')) closeSearch();
});
document.addEventListener('keydown',event => {
  if (event.key==='Escape' && !$('#search-form').hidden) { closeSearch(); $('#toggle-search').focus(); }
});
