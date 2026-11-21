import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {answer} from '../qa/answer.mjs';
import {seed} from '../knowledge/data.mjs';

export const reviewQuestions = [
  'B组11/14-11/15的验收地点有变化吗？',
  'B组11月8日至12日的融合方式有变化吗？',
  'B组融合方式和设备费用各是什么？',
  'B组用什么融合方式，设备费用是多少？',
  'B组使用融合方式需要多少元？'
];
export function reviewOutputs() {
  return reviewQuestions.map(question => ({question, response: answer(seed, question, {date:'2026-11-20',scope:'B组'})}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputs = reviewOutputs();
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(outputs,null,2)+'\n');
  console.log(JSON.stringify(outputs.map(({question,response})=>({question,date:response.date,status:response.status,
    sections:response.sections.map(s=>({topic:s.topic,status:s.status,summary:s.summary,
      evidence:s.items.map(i=>({id:i.doc.id,role:i.role}))}))})),null,2));
}
