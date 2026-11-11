import {createHmac,timingSafeEqual} from 'node:crypto';
export type TermsSettings={version:string;url:string;privacyUrl:string};
export function termsSettings():TermsSettings|null{
 const version=process.env.CONNECT_TERMS_VERSION,url=process.env.CONNECT_TERMS_URL,privacyUrl=process.env.CONNECT_PRIVACY_URL;
 if(!version||!/^[a-zA-Z0-9._-]{1,80}$/.test(version)||!url||!privacyUrl||!process.env.CONNECT_SESSION_SECRET||process.env.CONNECT_SESSION_SECRET.length<32)return null;
 try{for(const value of [url,privacyUrl]){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;}}catch{return null;}
 return {version,url,privacyUrl};
}
export function signAppConsent(id:string,version:string,secret:string,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({id,version,exp:now+30*86400000})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function verifyAppConsent(token:string|undefined,version:string,secret:string,now=Date.now()):{id:string;version:string}|null{
 if(!token||token.length>1024||secret.length<32)return null;
 try{const [payload,mac,extra]=token.split('.');if(extra||!payload||!mac)return null;const expected=createHmac('sha256',secret).update(payload).digest();const supplied=Buffer.from(mac,'base64url');if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;const p=JSON.parse(Buffer.from(payload,'base64url').toString());return /^[0-9a-f-]{36}$/.test(p.id)&&p.version===version&&p.exp>now&&p.exp<=now+31*86400000?{id:p.id,version:p.version}:null;}catch{return null;}
}
export function assistantAvailable(){return process.env.CONNECT_ORIENTAME_DOCUMENTAL !== 'off';}
