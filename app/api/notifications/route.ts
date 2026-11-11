import { isConfigured, supabase } from "@/lib/supabase";
export async function GET(request: Request) {
  if (!isConfigured())
    return Response.json(
      { items: [], enabled: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  const org = new URL(request.url).searchParams.get("org");
  if (!org || !/^[a-f0-9-]{36}$/i.test(org))
    return new Response(null, { status: 400 });
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  const { error } = await db.rpc("sync_reminders", { p_org: org });
  if (error)
    return Response.json(
      { items: [], enabled: false },
      {
        status: error.code === "42501" ? 403 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  const result = await db
    .from("commercial_notifications")
    .select("id,kind,created_at")
    .eq("organization_id", org)
    .eq("recipient_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  return Response.json(
    { items: result.data ?? [], enabled: !result.error },
    {
      status: result.error ? 503 : 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
