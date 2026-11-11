import {notFound,redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {termsSettings,verifyAppConsent} from '@/lib/app-access';
import GameRoom from '@/components/games/game-room';
import {isConfigured,supabase} from '@/lib/supabase';
export default async function Games({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;if(slug!=='novogen')notFound();
 if(isConfigured()){
  const db=await supabase();const {data,error}=await db.from('organizations').select('id').eq('slug',slug).eq('published',true).maybeSingle();
  if(error)throw new Error('No se pudo cargar CONNECT');if(!data)notFound();
 }
 const terms=termsSettings();if(terms&&!verifyAppConsent((await cookies()).get('connect_app_consent')?.value,terms.version,process.env.CONNECT_SESSION_SECRET!))redirect('/connect/novogen/app?next=juegos');
 return <GameRoom/>;
}
