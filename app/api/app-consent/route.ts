import {cookies} from 'next/headers';import {randomUUID} from 'node:crypto';
import {termsSettings,verifyAppConsent,signAppConsent} from '@/lib/app-access';import {isConfigured,supabase} from '@/lib/supabase';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){const terms=termsSettings();const accepted=terms?verifyAppConsent((await cookies()).get('connect_app_consent')?.value,terms.version,process.env.CONNECT_SESSION_SECRET!):null;return Response.json({required:Boolean(terms),accepted:Boolean(accepted),terms},{headers});}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 const raw=await request.text();if(raw.length>1024)return new Response(null,{status:413});
 const terms=termsSettings();if(!terms||!isConfigured())return Response.json({message:'Los términos aún no están habilitados.'},{status:503,headers});
 try{const p=JSON.parse(raw);if(p.accepted!==true||p.version!==terms.version||Object.keys(p).some(k=>!['accepted','version'].includes(k)))return new Response(null,{status:400});}catch{return new Response(null,{status:400});}
 const id=randomUUID(),db=await supabase();const {error}=await db.rpc('record_app_consent',{p_slug:'novogen',p_id:id,p_version:terms.version});
 if(error)return Response.json({message:'No pudimos registrar tu aceptación. Intenta de nuevo.'},{status:503,headers});
 (await cookies()).set('connect_app_consent',signAppConsent(id,terms.version,process.env.CONNECT_SESSION_SECRET!),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:30*86400,path:'/'});
 return Response.json({accepted:true},{headers});
}
