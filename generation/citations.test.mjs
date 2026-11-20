import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySelection} from './model.mjs';

const candidates = [{key:'E1',doc:{id:'A',text:'地点是甲楼。'},role:'冲突依据',lines:['地点是甲楼。']},
  {key:'E2',doc:{id:'B',text:'地点是乙楼。'},role:'冲突依据',lines:['地点是乙楼。']}];

test('both conflicting sources survive citation selection', () => {
  assert.deepEqual(verifySelection(candidates,{E1:'1',E2:'1'}).map(c=>c.id),['A','B']);
});
test('reject incomplete, extra, invalid and mistyped model selections', () => {
  for (const choice of [null,[],{E1:'1'},{E1:'1',E2:'1',E3:'1'},{E1:1,E2:'1'},
    {E1:'0',E2:'1'},{E1:'2',E2:'1'},{E1:'1.0',E2:'1'}]) {
    assert.throws(()=>verifySelection(candidates,choice));
  }
});
test('a quote must belong to its own source, not merely another source', () => {
  assert.throws(()=>verifySelection([{...candidates[0],lines:['地点是乙楼。']}],{E1:'1'}));
});
