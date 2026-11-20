import { seed, references } from '../knowledge/data.mjs';
import {answer} from '../qa/answer.mjs';
import {validateDocument} from '../knowledge/schema.mjs';

const $ = (selector) => document.querySelector(selector);
const key = 'nowpast.course.claims.v1';
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
const projectQuestion = '融合方式按哪版实现、要附哪些复现材料、去哪验收？';
const examples = [
  ['复现哪个融合算子，去哪验收？', projectQuestion, '2026-11-12', 'B组', 'auto'],
  ['论文和源码的融合方式一致吗？', '论文和源码的融合方式有什么差异？', '2026-11-18', '全班', 'auto'],
  ['澄清通知公布后，要求变了吗？', projectQuestion, '2026-11-18', 'B组', 'auto'],
  ['拿着旧排班，该去哪里验收？', 'B组拿着写有“工程楼 305”的旧排班，现在该去哪，为什么变了？', '2026-11-18', 'B组', 'auto'],
  ['从论文复现改到源码复现，改了什么？', '2026-11-05 和 2026-11-18，融合方式和消息聚合有什么变化？', '2026-11-18', 'B组', 'compare']
];
let docs = [];
let requestNumber = 0;
let activeRequest;
let storageIssue = '';

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
  $('#topic-list').replaceChildren(...[...new Set(docs.map(d => d.topic))].map(topic => new Option(topic)));
}
function navigate(view) {
  for (const id of ['ask', 'library']) {
    const active = id === view;
    $('#' + id).hidden = !active;
    $('#nav-' + id).classList.toggle('active', active);
    if (active) $('#nav-' + id).setAttribute('aria-current', 'page');
    else $('#nav-' + id).removeAttribute('aria-current');
  }
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
}
function researchList(refs) {
  const panel = make('div','research');
  if (!refs.length) return panel;
  panel.append(make('h3','','研究来源'));
  for (const ref of refs) {
    const link = make('a','research-link',ref.kind+' · '+ref.title+' ↗');
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
  detail.append(researchList(references.filter(r=>doc.refs?.includes(r.id))));
  $('#source-dialog').showModal();
}
function evidenceList(items) {
  const ul = make('ul', 'ev-list');
  for (const { doc, role } of items) {
    const li = make('li');
    const link = button('source-link', '', () => sourceDetails(doc));
    link.setAttribute('aria-label', role + '，核查原文：' + doc.title);
    link.append(make('span', 'ev-role', role), make('strong', '', doc.title), make('span', 'arrow', ' ↗'));
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
  out.textContent = '正在请求本地模型…';
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, docs }), signal });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('此站点未连接本地模型服务。');
    const data = await response.json();
    if (!response.ok || !data.text) throw new Error(data.error || '模型服务未返回整理结果。');
    if (serial === requestNumber) out.textContent = '模型整理 · ' + (data.model || '本地模型') + '\n' + data.text;
  } catch (err) {
    if (serial === requestNumber) out.textContent = '模型整理未完成。' + (signal.aborted ? '请求已超时。' : err.message) + ' 上方证据仍可核查。';
  } finally {
    clearTimeout(timer);
    if (serial === requestNumber) btn.disabled = false;
  }
}
function renderResult(result, query, serial) {
  const panel = $('#result');
  const top = make('div', 'result-head');
  top.append(make('h2', '', '查证结果'), make('span', 'fine', result.researchOnly ? '原始论文与固定源码版本' : (result.date || query.date) + ' · ' + (result.scope || query.scope)));
  const grid = make('div', 'answer-grid');
  const article = make('article', 'answer-body card');
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
        links.append(button('inline-cite', role + ' · ' + doc.id + ' ↗', () => sourceDetails(doc)));
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
  const btn = button('model-btn', '用本地模型整理', () => generate(btn, out, query, serial));
  controls.append(make('span', 'fine', '实时检索 · 条款证据合成'), btn);
  if (!result.researchOnly) article.append(controls, out);
  const evidence = make('aside', 'evidence card');
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
    const query = { question, date, scope: $('#scope').value, mode: $('#mode').value };
    renderResult(answer(docs, question, query), query, serial);
    error.textContent = storageIssue;
  } catch (e) {
    $('#result').replaceChildren();
    error.textContent = '查证未完成。' + e.message;
  }
}
function pickExample(example) {
  const [, question, date, scope, mode] = example;
  $('#question').value = question;
  $('#as-of').value = date;
  $('#scope').value = scope;
  $('#mode').value = mode;
  run();
}
function renderLibrary() {
  const list = $('#library-list');
  const filter = $('#filter').value.trim().toLowerCase();
  const matches = docs.filter(d => [d.title, d.topic, d.text, d.scope].join(' ').toLowerCase().includes(filter));
  list.replaceChildren(...matches.map(doc => {
    const row = button('row-btn', '', () => sourceDetails(doc));
    const title = make('span');
    title.append(make('span', 'topic-tag', doc.topic), make('strong', '', doc.title),
      make('span', 'row-meta', (doc.published || '公布时间未知') + ' · ' + doc.scope + ' · ' + doc.id));
    row.append(title, make('span', 'row-out', '查看原文 ↗'));
    return row;
  }));
  if (!matches.length) list.append(make('p', 'empty', '未找到匹配的资料。'));
  if (storageIssue) list.prepend(make('p', 'error', storageIssue));
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
$('#nav-ask').onclick = () => navigate('ask');
$('.brand').onclick = (e) => { e.preventDefault(); navigate('ask'); };
$('#nav-library').onclick = () => navigate('library');
$('#ask-form').onsubmit = (e) => { e.preventDefault(); run(); };
$('#filter').oninput = renderLibrary;
$('#open-import').onclick = () => {
  importForm.reset();
  $('#import-message').textContent = '';
  updateTargets();
  $('#import-dialog').showModal();
};
importForm.elements.topic.oninput = updateTargets;
importForm.elements.scope.onchange = updateTargets;
let fileRead = 0;
$('#text-file').onchange = async (e) => {
  const serial = ++fileRead;
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 60000) throw new Error('请仅导入一条 12000 字内的 TXT 条款。');
    const contents = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).trim();
    if (serial !== fileRead) return;
    if (!contents || contents.length > 12000) throw new Error('原文应含 1 至 12000 个字符。');
    importForm.elements.text.value = contents;
    if (!importForm.elements.title.value) importForm.elements.title.value = file.name.replace(/\.txt$/i, '').slice(0, 100);
    $('#import-message').textContent = '';
  } catch (err) {
    if (serial === fileRead) $('#import-message').textContent = '读取失败。' + err.message;
  }
};
importForm.onsubmit = async (e) => {
  e.preventDefault();
  const values = Object.fromEntries(new FormData(importForm));
  const doc = { id: 'local-' + crypto.randomUUID().slice(0, 8), imported: today(), aliases: [] };
  for (const field of ['title', 'published', 'effective', 'scope', 'topic', 'value', 'text']) doc[field] = values[field].trim();
  doc.supersedes = new FormData(importForm).getAll('supersedes');
  const saveButton = importForm.querySelector('button[type=submit]');
  saveButton.disabled = true;
  try {
    const persist = () => {
      const all = readEntries();
      validateDocument(doc, all);
      localStorage.setItem(key, JSON.stringify([...all.slice(seed.length), doc]));
    };
    if (navigator.locks) await navigator.locks.request(key, persist);
    else persist();
    $('#filter').value = '';
    refresh();
    $('#import-dialog').close();
    run();
    sourceDetails(doc);
  } catch (err) {
    $('#import-message').textContent = '保存失败。' + err.message;
  } finally {
    saveButton.disabled = false;
  }
};
document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => $('#' + btn.dataset.close).close());
window.addEventListener('storage', e => { if (e.key === key || e.key === null) { refresh(); run(); } });
window.addEventListener('hashchange', () => navigate(location.hash === '#library' ? 'library' : 'ask'));
for (const example of examples) {
  const btn = button('example-btn', example[0], () => pickExample(example));
  btn.append(make('span', 'arrow', '↗'));
  $('#examples').append(btn);
}
refresh();
pickExample(examples[0]);
navigate(location.hash === '#library' ? 'library' : 'ask');
