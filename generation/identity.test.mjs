import test from 'node:test';import assert from 'node:assert/strict';import {inferenceKey} from './identity.mjs';
test('cache identity separates weights, tokenizer, template, runtime, quantization and all prompt parameters',()=>{
  const a={baseRevision:'v1',base:'A',adapter:null,tokenizer:'T',chatTemplate:'C',runtime:'R',quantization:'Q'},r={system:'s',input:{a:1},schema:{type:'object'},parameters:{temperature:0,seed:42,max_tokens:256}};
  const key=inferenceKey(a,r);
  for(const field of Object.keys(a))assert.notEqual(inferenceKey({...a,[field]:'different'},r),key,field);
  for(const field of Object.keys(r))assert.notEqual(inferenceKey(a,{...r,[field]:'different'}),key,field);
});
