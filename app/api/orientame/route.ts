// Legacy generated-response endpoint retired. The documentary widget talks directly to WordPress.
import {assistantAvailable} from '@/lib/app-access';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){return Response.json({available:assistantAvailable(),mode:'documental',embedUrl:'https://www.novogensalud.cl/?orientame_embed=1'},{headers});}
export async function POST(){return Response.json({message:'ORIÉNTAME ahora usa respuestas documentales aprobadas. Abre el asistente desde CONNECT.',mode:'documental'},{status:410,headers});}
