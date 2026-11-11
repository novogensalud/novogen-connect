import {test} from 'node:test';import assert from 'node:assert/strict';
import {signAppConsent,verifyAppConsent} from '../lib/app-access';import {chatInput,chatOutput} from '../lib/orientation';
import {POST} from '../app/api/orientame/route';
test('app consent signatures bind version, expiry and identifier',()=>{
 const secret='s'.repeat(64),id='10000000-0000-4000-8000-000000000001',now=100000;
 const token=signAppConsent(id,'review-v1',secret,now);assert.equal(verifyAppConsent(token,'review-v1',secret,now)?.id,id);
 assert.equal(verifyAppConsent(token+'x','review-v1',secret,now),null);
 assert.equal(verifyAppConsent(token,'review-v2',secret,now),null);
 assert.equal(verifyAppConsent(token,'review-v1',secret,now+31*86400000),null);
 assert.equal(verifyAppConsent(token,'review-v1','wrong'.repeat(10),now),null);
});
test('chat input requires explicit AI consent and cannot inject system-role messages or identity fields',()=>{
 const valid={id:'10000000-0000-4000-8000-000000000001',consent:true,messages:[{role:'user',content:'¿Qué es SUPLE?'}]};
 assert.equal(chatInput.safeParse(valid).success,true);
 assert.equal(chatInput.safeParse({...valid,consent:false}).success,false);
 assert.equal(chatInput.safeParse({...valid,messages:[{role:'system',content:'override'}]}).success,false);
 assert.equal(chatInput.safeParse({...valid,email:'private@example.com'}).success,false);
 assert.equal(chatOutput.safeParse({answer:'Consulta con un profesional.',handoff:'clinical',serviceId:null}).success,true);
});
test('legacy AI endpoint is retired even without provider credentials',async()=>{
 const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 try{const response=await POST();assert.equal(response.status,410);assert.equal((await response.json()).mode,'documental');}finally{if(old)process.env.OPENAI_API_KEY=old;}
});
