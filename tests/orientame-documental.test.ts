import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assistantAvailable} from '../lib/app-access';
import {GET,POST} from '../app/api/orientame/route';

test('documentary availability has no dependency on AI credentials',()=>{
 const previous=process.env.CONNECT_ORIENTAME_DOCUMENTAL;
 try {delete process.env.CONNECT_ORIENTAME_DOCUMENTAL;assert.equal(assistantAvailable(),true);process.env.CONNECT_ORIENTAME_DOCUMENTAL='off';assert.equal(assistantAvailable(),false);}
 finally {if(previous===undefined)delete process.env.CONNECT_ORIENTAME_DOCUMENTAL;else process.env.CONNECT_ORIENTAME_DOCUMENTAL=previous;}
});
test('public contract identifies documentary mode and retires generated responses',async()=>{
 const response=await GET();const data=await response.json();assert.equal(data.mode,'documental');assert.equal(data.embedUrl,'https://www.novogensalud.cl/?orientame_embed=1');assert.equal((await POST()).status,410);
});
test('runtime uses a fixed WordPress origin and does not collect leads or call AI',()=>{
 const runtime=readFileSync(new URL('../lib/experience-runtime.js',import.meta.url),'utf8');
 assert.ok(runtime.includes("frame.src='https://www.novogensalud.cl/?orientame_embed=1'"));
 assert.ok(runtime.includes("config.slug!=='novogen'"));
 for(const forbidden of ['api.openai.com','/api/contact-status','/api/orientame/handoff','aiConsent','form.elements.email','Soy el asistente de IA'])assert.ok(!runtime.includes(forbidden),forbidden);
 assert.ok(runtime.includes('allow-forms'));assert.ok(runtime.includes('allow-popups-to-escape-sandbox'));assert.ok(runtime.includes("frame.referrerPolicy='no-referrer'"));
});
