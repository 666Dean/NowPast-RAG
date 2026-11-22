import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const source=process.argv[2] || 'HEAD',commit=execFileSync('git',['rev-parse',source],{encoding:'utf8'}).trim();
const output='service/validation/s1-reproduction.json',scratch=mkdtempSync(join(tmpdir(),'nowpast-s1-'));
const edits=[
  {file:'qa/campus.mjs',from:'|什么时候',to:''},
  {file:'generation/model.mjs',from:"return result.status==='unknown' || (result.sections || []).some(section=>section.status==='unknown');",to:"return result.status==='unknown';"}
];
const hash=s=>createHash('sha256').update(s).digest('hex');
const result={baseCommit:commit,baseline:'controlled reconstruction: reverse only S1 fixes from the identified source; not an invented old commit',edits};
try{
  const archive=execFileSync('git',['archive',commit],{maxBuffer:64*1024*1024});
  const tar=spawnSync('tar',['-x','-C',scratch],{input:archive});assert.equal(tar.status,0);
  mkdirSync(join(scratch,'experiments/results'),{recursive:true});
  function run(name){
    const r=spawnSync(process.execPath,['service/s1-probes.mjs',`experiments/results/${name}.json`],{cwd:scratch,env:process.env,stdio:'inherit',timeout:180000});
    assert.equal(r.status,0);return JSON.parse(readFileSync(join(scratch,`experiments/results/${name}.json`)));
  }
  result.sourceHashes={};
  for(const e of edits){
    const path=join(scratch,e.file),original=readFileSync(path,'utf8');assert.ok(original.includes(e.from),e.file);
    const before=original.replace(e.from,e.to);writeFileSync(path,before);result.sourceHashes[e.file]={fixed:hash(original),baseline:hash(before)};
  }
  result.before=run('before');assert.equal(result.before[0].response.fields.time,undefined);assert.equal(result.before[1].status,200);
  for(const e of edits) writeFileSync(join(scratch,e.file),execFileSync('git',['show',commit+':'+e.file]));
  result.after=run('after');assert.deepEqual(result.after[0].response.fields.time.values,['08:00–09:40']);assert.equal(result.after[1].status,422);
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(output);
}finally{rmSync(scratch,{recursive:true,force:true});}
