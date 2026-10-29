import { isConfigured, supabase } from "@/lib/supabase";
import { sourceTemplate } from "@/lib/orientame-sources";
export async function GET(request: Request) {
  const url = new URL(request.url),
    org = url.searchParams.get("org");
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": 'attachment; filename="orientame-fuentes.json"',
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.get("template") === "1")
    return new Response(JSON.stringify(sourceTemplate, null, 2), {
      headers: {
        ...headers,
        "Content-Disposition":
          'attachment; filename="orientame-plantilla.json"',
      },
    });
  if (!isConfigured())
    return Response.json(
      { error: "La demostración no contiene fuentes guardadas" },
      { status: 409 },
    );
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  if (!org || !/^[a-f0-9-]{36}$/i.test(org))
    return new Response(null, { status: 400 });
  const { data: m } = await db
    .from("memberships")
    .select("role")
    .eq("organization_id", org)
    .eq("user_id", user.id)
    .maybeSingle();
  if (m?.role !== "admin") return new Response(null, { status: 403 });
  const { data, error } = await db
    .from("orientame_sources")
    .select("key,title,type,url,content,status")
    .eq("organization_id", org)
    .order("key")
    .limit(101);
  if (error)
    return Response.json(
      {
        error:
          "No se pudieron exportar las fuentes; revisa la migración 007 y la conexión",
      },
      { status: 503 },
    );
  if (data.length > 100)
    return Response.json(
      { error: "El volumen supera el límite de exportación de esta versión" },
      { status: 413 },
    );
  // Preserve every source, including archived records, for a portable backup.
  return new Response(JSON.stringify({ version: 1, sources: data }, null, 2), {
    headers,
  });
}
