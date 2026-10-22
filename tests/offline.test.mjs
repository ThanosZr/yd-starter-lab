import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('index.html is standalone and all inline scripts parse',()=>{
  const doc=fs.readFileSync('index.html','utf8');
  assert.match(doc,/<div id="root">/);
  assert.doesNotMatch(doc,/<script[^>]+src=/i,'must not rely on external JS scripts');
  assert.doesNotMatch(doc,/<script[^>]+type="module"/i,'must not rely on module syntax');
  const scripts=[...doc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.ok(scripts.length>=2,'must bundle React and main app');
  scripts.forEach((src,i)=>assert.doesNotThrow(()=>new vm.Script(src,{filename:`inline${i}.js`})));
});
