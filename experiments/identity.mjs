import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpus,totalmem,platform,arch,release} from 'node:os';
import {join} from 'node:path';
const root=new URL('./',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
async function artifact(path){const h=createHash('sha256');for await(const part of createReadStream(path))h.update(part);return {bytes:(await stat(path)).size,sha256:h.digest('hex')};}
const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const files={};for(const name of [...new Set(names)].sort())if(/\.(mjs|py|html|css)$/.test(name)||name==='package.json'||/experiments\/(?:[^/]+\/)?(?:config|freeze|generation-sample)\.json$/.test(name))files[name]=hash(await readFile(name));
const embedding={repo:'Xenova/bge-small-zh-v1.5',revision:'75c43b069aac4d136ba6bc1122f995fedcfd2781',files:{}};
for(const path of ['tokenizer.json','config.json','onnx/model_quantized.onnx'])embedding.files[path]=await artifact(new URL('cache/bge/'+path,root));
let generation=null;
if(process.env.NOWPAST_MODEL_HOME){
  const home=process.env.NOWPAST_MODEL_HOME,dir=join(home,'b12559');
  const binary=(await readdir(dir,{recursive:true})).find(x=>x.split(/[\\/]/).at(-1)==='llama-server');
  generation={model:'Qwen2.5-0.5B-Instruct-Q4_K_M',revision:'9217f5db79a29953eb74d5343926648285ec7e67',weights:await artifact(join(home,'model.gguf')),runtime:'llama.cpp b12559',binary:binary?await artifact(join(dir,binary)):null};
}
const identity={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
  node:process.version,platform:platform(),arch:arch(),release:release(),cpu:cpus()[0]?.model,cpuCount:cpus().length,memoryBytes:totalmem(),
  sourceFiles:files,sourceDigest:hash(JSON.stringify(files)),embedding,generation};
await writeFile(new URL('MODELS-AND-SOURCE.json',root),JSON.stringify(identity,null,2)+'\n');console.log({commit:identity.commit,sourceDigest:identity.sourceDigest,embeddingSha256:embedding.files['onnx/model_quantized.onnx'].sha256,generationSha256:generation?.weights.sha256});
