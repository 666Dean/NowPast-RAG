import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDates, withoutDates} from './graph.mjs';
import {answer} from '../qa/answer.mjs';
import {seed} from '../knowledge/data.mjs';

const reference = '2026-11-20';

test('paper sections, model versions and numeric parameters are preserved', () => {
  for (const question of [
    '论文第3.2节的融合方式是什么？',
    '论文 § 3.2 中的 Hadamard 融合在哪里？',
    '3.2.1节的聚合方式',
    '版本 1.1 的融合方式',
    'v 1.1 的聚合方式',
    'Qwen2.5 能解释融合方式吗？',
    'Qwen2.5-0.5B 的模型版本',
    '负采样比例为0.5时的融合方式',
    'dropout=0.1，学习率0.01',
    '条款 DOC-11-08 的融合方式'
  ]) {
    assert.deepEqual(parseDates(question, reference), [], question);
    assert.equal(withoutDates(question), question);
  }
});

test('short and full dates remain supported alongside research sections', () => {
  for (const date of ['11.8', '11/8', '11-8', '11月8日', '2026.11.8', '2026/11/8', '2026-11-08', '2026年11月8号']) {
    const question = `${date}，B组按论文第3.2节用什么融合方式？`;
    assert.deepEqual(parseDates(question, reference), ['2026-11-08'], date);
    assert.ok(withoutDates(question).includes('第3.2节'));
    const result = answer(seed, question, {date: reference, scope:'B组'});
    assert.equal(result.date, '2026-11-08');
    assert.equal(result.status, 'ok');
    assert.ok(result.items.some(item => item.doc.id==='F01' && item.role==='当前依据'));
    assert.ok(result.items.some(item => item.doc.id==='B13' && item.role==='已公布待生效'));
  }
  assert.deepEqual(parseDates('第3.2节，11月8日和11月12日，版本1.1', reference), ['2026-11-08','2026-11-12']);
  assert.deepEqual(parseDates('2026-11-08B组用什么融合方式？', reference), ['2026-11-08']);
});

test('source questions with section numbers return the research citation', () => {
  for (const question of ['论文第3.2节的融合方式是什么？', '论文 §3.2 中的 Hadamard 融合在哪里？']) {
    const result = answer(seed, question, {date: reference, scope:'B组'});
    assert.equal(result.status, 'ok', question);
    assert.equal(result.researchOnly, true);
    assert.equal(result.date, reference);
    assert.deepEqual(result.research.map(source => source.id), ['paper-fusion']);
    assert.deepEqual(result.items, []);
  }
});

test('invalid calendar dates are still rejected and matches do not leak between calls', () => {
  for (const date of ['2026-11-31','2026-02-29','11月31日']) {
    assert.equal(answer(seed, `${date} B组的融合方式`, {date: reference}).status, 'unknown');
  }
  for (let round=0; round<3; round++) {
    assert.deepEqual(parseDates('2026-11-08', reference), ['2026-11-08']);
    assert.equal(withoutDates('论文第3.2节'), '论文第3.2节');
  }
});
