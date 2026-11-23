import test from 'node:test';import assert from 'node:assert/strict';import {validateDomainAnswer} from './domain-answer.mjs';
const doc=(id,value)=>({id,value,text:'地点'+value});
const a=doc('A','B204'),b=doc('B','C301'),past=doc('OLD','A101');
const result={sections:[{field:'room',status:'conflict',items:[{doc:a,role:'冲突依据'},{doc:b,role:'冲突依据'},{doc:past,role:'已被替代'}]},{field:'fee',status:'unknown',items:[]}],items:[{doc:a,role:'冲突依据'},{doc:b,role:'冲突依据'},{doc:past,role:'已被替代'}]};
const answer={answers:{room:{status:'conflict',values:['B204','C301'],citations:[{id:'A',quote:a.text},{id:'B',quote:b.text}]},fee:{status:'unknown',values:[],citations:[]}},previous:['OLD'],pending:false};
test('validated answer keeps conflict and independent missing evidence; no gold repair',()=>{
  assert.equal(validateDomainAnswer(result,answer),answer);
  for(const mutate of [x=>x.answers.room.values.pop(),x=>x.answers.room.citations[0]={id:'OLD',quote:past.text},x=>x.answers.fee.values.push('100元'),x=>delete x.answers.fee,x=>x.previous.push('A')]){const copy=structuredClone(answer);mutate(copy);assert.throws(()=>validateDomainAnswer(result,copy));}
});
