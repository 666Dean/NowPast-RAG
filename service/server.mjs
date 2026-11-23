import http from 'node:http';
import { readFile } from 'node:fs/promises';
import {answer} from '../qa/answer.mjs';
import {validateDocument} from '../knowledge/schema.mjs';
import { closeModel, generate, hasMissingEvidence } from '../generation/model.mjs';
import {analyzeNotice,validateNoticeInput} from '../generation/notice.mjs';
import {generateDomainAnswer} from '../generation/domain-answer.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
const hosts = new Set([host + ':' + port, 'localhost:' + port]);
const files = new Map([
  ['/', ['web/index.html', 'text/html']],
  ['/index.html', ['web/index.html', 'text/html']],
  ['/test-campus', ['service/manual-test.html', 'text/html']],
  ['/service/manual-test.mjs', ['service/manual-test.mjs', 'text/javascript']],
  ['/web/style.css', ['web/style.css', 'text/css']],
  ['/web/controls.css', ['web/controls.css', 'text/css']],
  ['/web/controls.mjs', ['web/controls.mjs', 'text/javascript']],
  ['/web/assets/mountain-dawn.webp', ['web/assets/mountain-dawn.webp', 'image/webp']],
  ['/web/app.mjs', ['web/app.mjs', 'text/javascript']],
  ['/web/notice-relations.mjs', ['web/notice-relations.mjs', 'text/javascript']],
  ['/knowledge/data.mjs', ['knowledge/data.mjs', 'text/javascript']],
  ['/knowledge/notices.mjs', ['knowledge/notices.mjs', 'text/javascript']],
  ['/knowledge/schema.mjs', ['knowledge/schema.mjs', 'text/javascript']],
  ['/knowledge/notice-adapter.mjs', ['knowledge/notice-adapter.mjs', 'text/javascript']],
  ['/temporal/graph.mjs', ['temporal/graph.mjs', 'text/javascript']],
  ['/retrieval/rank.mjs', ['retrieval/rank.mjs', 'text/javascript']],
  ['/qa/answer.mjs', ['qa/answer.mjs', 'text/javascript']],
  ['/qa/campus.mjs', ['qa/campus.mjs', 'text/javascript']],
  ['/temporal/campus.mjs', ['temporal/campus.mjs', 'text/javascript']],
  ['/temporal/integrity.mjs', ['temporal/integrity.mjs', 'text/javascript']],
  ['/knowledge/campus-data.mjs', ['knowledge/campus-data.mjs', 'text/javascript']]
]);
function json(res, code, payload) {
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
  res.end(JSON.stringify(payload));
}
async function parseRequest(req, intake = false) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw Error('资料超过 1 MiB，请减少本次整理的条款数。');
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || (!intake && (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000)) ||
      !Array.isArray(body.docs) || (!intake && !body.docs.length) || body.docs.length > 400) throw Error('问题或资料库格式无效。');
  if (intake) validateNoticeInput(body);
  const validated = [];
  for (const doc of body.docs) { validateDocument(doc, validated); validated.push(doc); }
  return body;
}
let busy = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!hosts.has(req.headers.host)) return json(res, 403, {error:'请从本站访问。'});
  const path = (req.url || '/').split('?')[0];
  if (path === '/api/generate' || path === '/api/query' || path === '/api/notices/analyze') {
    if (req.method !== 'POST') return json(res, 405, {error:'请提交问题和资料。'});
    if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) return json(res, 403, {error:'仅限同源请求。'});
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, {error:'请求须为 JSON。'});
    if (path!=='/api/query' && busy) return json(res, 429, {error:'本机正在整理另一份回答，请稍后再试。'});
    if (path!=='/api/query') busy = true;
    try {
      let query;
      try { query = await parseRequest(req,path==='/api/notices/analyze'); }
      catch (err) { return json(res, 400, {error: err instanceof SyntaxError ? '请求 JSON 无效。' : err.message}); }
      if (path==='/api/notices/analyze') return json(res,200,await analyzeNotice(query.docs,query));
      const {question, docs, ...options} = query;
      const result = answer(docs, question, options);
      if(path==='/api/query') return json(res,200,result);
      if (result.researchOnly) return json(res, 422, {error:'研究来源直查请查看原始依据，本地模型仅整理课程条款。'});
      if (hasMissingEvidence(result)) return json(res, 422, {error:'当前证据不足，请先核查或补充资料。',missing:result.sections.filter(section=>section.status==='unknown').map(section=>section.topic)});
      const generated = options.generationMode==='domain-v2' ? await generateDomainAnswer(result,question) : await generate(result, question);
      return json(res, 200, generated);
    } catch (err) {
      return json(res, 503, {error: err.name === 'TimeoutError' ? '本地模型推理超时。' : err.message});
    } finally { if(path!=='/api/query') busy = false; }
  }
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, {error:'不支持此操作。'});
  const file = files.get(path);
  if (!file) return json(res, 404, {error:'页面不存在。'});
  try {
    const data = await readFile(new URL('../' + file[0], import.meta.url));
    res.writeHead(200, {'Content-Type':file[1] + '; charset=utf-8', 'Content-Length':data.length, 'Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { json(res, 500, {error:'站点文件读取失败。'}); }
});
server.requestTimeout = 45000;
server.listen(port, host, () => console.log('NowPast http://' + host + ':' + port));
process.on('exit', closeModel);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { closeModel(); server.close(); server.closeAllConnections(); });
}
