import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createAppServer} from './server.mjs';

test('the recovered public files retain the recorded source hashes',async()=>{
 const manifest=JSON.parse(await readFile(new URL('./recovery-manifest.json',import.meta.url),'utf8'));
 assert.ok(manifest.files.length>10);
 for(const file of manifest.files){
  const data=await readFile(new URL('./public/'+file.path,import.meta.url));
  assert.equal(data.length,file.bytes,file.path);
  assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.path);
 }
});
test('the standalone server serves the application, PWA and assets without exposing repository files',async()=>{
 const server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try {
  const root=await fetch(base);assert.equal(root.status,200);assert.match(await root.text(),/NOVOGEN CONNECT/);
  for(const [path,type] of [['/assets/index-BYM0Pqi2.js','javascript'],['/assets/index-CCqY9ld8.css','text/css'],['/manifest.webmanifest','application/manifest'],['/sw.js','javascript'],['/icons/icon-192.png','image/png']]){
   const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok(response.headers.get('content-type').includes(type),path);
  }
  assert.equal((await fetch(base+'/servicios')).status,200);
  for(const path of ['/README.md','/server.mjs','/assets/missing.js','/.git/config.txt'])assert.equal((await fetch(base+path)).status,404,path);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
