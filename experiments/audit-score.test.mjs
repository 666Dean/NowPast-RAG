import test from 'node:test';import assert from 'node:assert/strict';import {scoreAuditCase} from './audit-score.mjs';
test('correct value with wrong source is not a fully correct answer',()=>{
  const r=scoreAuditCase({fields:['room'],gold:[{field:'room',id:'class2',value:'B204'}],selected:[{field:'room',id:'class1',value:'B204'}]});assert.equal(r.perField[0].exact,1);assert.equal(r.perField[0].citationExact,0);assert.equal(r.questionExact,0);
});
test('same-value sources, mixed missing, direct links and refusal coverage are independent',()=>{
  const gold=[{field:'room',id:'B',value:'B204'},{field:'room',id:'C',value:'B204'}],input={fields:['room','fee'],gold,directOldIds:['A1'],transitiveOldIds:['A1','A0'],selected:gold,previous:['A1']};
  const r=scoreAuditCase(input);assert.equal(r.perField[0].conflict,false);assert.equal(r.perField[1].missing,true);assert.equal(r.directOldLink.exact,1);assert.equal(r.transitiveOldLink.exact,0);
  assert.equal(scoreAuditCase({...input,selected:[]}).questionExact,0);assert.equal(scoreAuditCase({...input,selected:[]}).coverage,0);
  const timeout=scoreAuditCase({...input,error:'timeout'});assert.equal(timeout.semanticTimeError,null);assert.equal(timeout.semanticRangeError,null);
});
