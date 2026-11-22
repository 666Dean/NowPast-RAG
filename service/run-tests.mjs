import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Browser helper manual-test.mjs is an ES module served to a browser, not a Node test.
const roots=['knowledge','temporal','retrieval','qa','generation','service','web','experiments'];
const files=roots.flatMap(dir=>readdirSync(dir).filter(name=>name.endsWith('.test.mjs')).map(name=>dir+'/'+name));
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
if(result.error) throw result.error;
process.exitCode=result.status ?? 1;
