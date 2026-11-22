import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('every browser module dependency is served by the existing static router',()=>{
  const source=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  const paths=new Map([...source.matchAll(/\['(\/[^']+)', \['([^']+)', 'text\/javascript'\]\]/g)].map(m=>[m[1],m[2]]));
  for(const [url,file] of paths){
    const content=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    for(const m of content.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
      if(!m[1].startsWith('.') && !m[1].startsWith('/')) continue;
      const target=new URL(m[1],'http://local'+url).pathname;
      assert.ok(paths.has(target),`${url} imports missing browser route ${target}`);
    }
  }
});
