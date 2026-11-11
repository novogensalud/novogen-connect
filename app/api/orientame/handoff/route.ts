import {cookies} from 'next/headers';import {z} from 'zod';import {supabase,isConfigured} from '@/lib/supabase';import {termsSettings,verifyAppConsent} from '@/lib/app-access';
const input=z.object({service:z.string().uuid().nullable(),kind:z.enum(['commercial','clinical'])}).strict();
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'};const reply=(message:string,status:number)=>Response.json({message},{status,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply('Abre CONNECT para solicitar contacto.',403);
 const raw=await request.text();if(raw.length>1024)return reply('Solicitud no válida.',413);
 let parsed;try{parsed=input.safeParse(JSON.parse(raw));}catch{return reply('Solicitud no válida.',400);}if(!parsed.success)return reply('Solicitud no válida.',400);
 const terms=termsSettings(),jar=await cookies();if(!terms||!isConfigured()||!verifyAppConsent(jar.get('connect_app_consent')?.value,terms.version,process.env.CONNECT_SESSION_SECRET!))return reply('Vuelve a iniciar tu acceso en CONNECT.',403);
 const receipt=jar.get('connect_receipt_novogen')?.value;if(!receipt||!/^[a-f0-9]{64}$/.test(receipt))return reply('Completa tus datos para solicitar contacto.',401);
 const db=await supabase();const {data,error}=await db.rpc('request_contact_handoff',{p_slug:'novogen',p_receipt:receipt,p_service:parsed.data.service,p_kind:parsed.data.kind});
 if(error||data!==true)return reply('No pudimos confirmar la derivación. Intenta de nuevo.',503);
 return reply(parsed.data.kind==='clinical'?'Registramos tu solicitud para coordinar contacto con un profesional habilitado.':'Registramos tu solicitud para que el equipo comercial continúe contigo.',200);
}
