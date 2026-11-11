import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactRequestSchema,contactFailure} from '../lib/contact-request';
import {POST} from '../app/api/contact/route';
const valid={name:'Persona',email:'qa@example.com',phone:'',service:'',consent:'on',slug:'novogen'};
test('contact validation requires explicit consent and rejects arbitrary personal fields and invalid attribution',()=>{
  assert.ok(contactRequestSchema.safeParse(valid).success);
  for(const change of [{consent:undefined},{website:'spam'},{point:'untrusted'},{clinical_notes:'private'},{request_type:'booked'}])
    assert.equal(contactRequestSchema.safeParse({...valid,...change}).success,false);
  assert.equal(contactFailure('Contact already received recently').status,409);
  assert.equal(contactFailure('Invalid service').status,422);
  assert.equal(contactFailure('Submission limit reached').status,429);
  assert.equal(contactFailure('database secret detail').message.includes('secret'),false);
});
test('contact endpoint rejects cross-origin and oversized payloads before persistence',async()=>{
  const request=(body:string,origin='https://evil.test')=>new Request('https://connect.test/api/contact',{method:'POST',headers:{origin,'content-type':'application/json'},body});
  assert.equal((await POST(request(JSON.stringify(valid)))).status,403);
  assert.equal((await POST(request('x'.repeat(5000),'https://connect.test'))).status,413);
  assert.equal((await POST(request('{bad','https://connect.test'))).status,400);
  assert.equal((await POST(request(JSON.stringify({...valid,consent:''}),'https://connect.test'))).status,400);
});
