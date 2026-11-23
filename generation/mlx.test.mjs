import test from 'node:test';import assert from 'node:assert/strict';import {validateShape} from './mlx.mjs';
import {mlxCompletion,closeMlx} from './mlx.mjs';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('local unconstrained inference is checked before any business mutation',()=>{
  const schema={type:'object',properties:{ids:{type:'array',minItems:1,maxItems:2,items:{type:'string',enum:['E1','E2']}}},required:['ids'],additionalProperties:false};
  assert.doesNotThrow(()=>validateShape({ids:['E1']},schema));
  for(const x of [{ids:[]},{ids:['E3']},{ids:['E1'],extra:'x'},{}])assert.throws(()=>validateShape(x,schema));
  assert.doesNotThrow(()=>validateShape(null,{type:['string','null']}));
  assert.throws(()=>validateShape(1,{type:['string','null']}));
  assert.throws(()=>validateShape('x'.repeat(241),{type:'string',maxLength:240}));
  assert.throws(()=>validateShape(Array(81).fill('x'),{type:'array',maxItems:80,items:{type:'string'}}));
  assert.throws(()=>validateShape(['E1','E1'],{type:'array',uniqueItems:true,items:{type:'string'}}));
  const branchSchema={oneOf:[{type:'object',properties:{pending:{enum:[false]},clauses:{type:'array',minItems:1,items:{type:'string'}}},required:['pending','clauses']},{type:'object',properties:{pending:{enum:[true]},clauses:{type:'array',maxItems:0,items:{type:'string'}}},required:['pending','clauses']}]};
  assert.doesNotThrow(()=>validateShape({pending:true,clauses:[]},branchSchema));
  assert.doesNotThrow(()=>validateShape({pending:false,clauses:['source']},branchSchema));
  assert.throws(()=>validateShape({pending:false,clauses:[]},branchSchema));
  assert.throws(()=>validateShape({pending:true,clauses:['invented']},branchSchema));
});
test('an old timed-out worker exiting cannot reject the replacement worker request',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nowpast-worker-test-'));const file=join(dir,'worker');const previous=process.env.NOWPAST_MLX_PYTHON;
 await writeFile(file,`#!${process.execPath}\nconst rl=require('node:readline').createInterface({input:process.stdin});process.on('SIGTERM',()=>setTimeout(()=>process.exit(0),250));rl.on('line',l=>{const r=JSON.parse(l);if(!r.input.hang)setTimeout(()=>process.stdout.write(JSON.stringify({id:r.id,data:{ok:'yes'}})+'\\n'),500);});\n`);await chmod(file,0o755);process.env.NOWPAST_MLX_PYTHON=file;
 try{
  await mlxCompletion({input:{hang:false},schema:{}},{timeoutMs:5000});
  await assert.rejects(()=>mlxCompletion({input:{hang:true},schema:{}},{timeoutMs:200}),/超时/);
  const result=await mlxCompletion({input:{hang:false},schema:{type:'object',properties:{ok:{type:'string'}},required:['ok']}},{timeoutMs:5000});assert.equal(result.data.ok,'yes');
 }finally{closeMlx();if(previous===undefined)delete process.env.NOWPAST_MLX_PYTHON;else process.env.NOWPAST_MLX_PYTHON=previous;await rm(dir,{recursive:true,force:true});}
});
test('a missing local interpreter reports startup failure rather than a generic model close',async()=>{
 const previous=process.env.NOWPAST_MLX_PYTHON;closeMlx();process.env.NOWPAST_MLX_PYTHON=join(tmpdir(),'nowpast-missing-interpreter-'+process.pid);
 try{await assert.rejects(()=>mlxCompletion({input:{},schema:{}},{timeoutMs:5000}),/运行环境未能启动.*ENOENT/);}
 finally{closeMlx();if(previous===undefined)delete process.env.NOWPAST_MLX_PYTHON;else process.env.NOWPAST_MLX_PYTHON=previous;}
});
