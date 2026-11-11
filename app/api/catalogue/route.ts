import { publicCatalogue } from "@/lib/public-catalogue";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || 'novogen';
  const headers = {'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'};
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return Response.json({error:'invalid_slug'},{status:400,headers});
  try {
    const catalogue = await publicCatalogue(slug,url.origin);
    return Response.json(catalogue ?? {error:'not_available'},{status:catalogue ? 200 : 404,headers});
  } catch { return Response.json({error:'temporarily_unavailable'},{status:503,headers}); }
}
