import { createClient } from "@supabase/supabase-js";
import { interactionSchema } from "@/lib/automation";
import { getSupabaseConfig } from "@/lib/config";
import { allowedWebOrigin } from "@/lib/analytics";
export async function OPTIONS() {
  // Requested origin is validated against the organization's website on POST.
  // JSON POST is required; avoid accepting cross-site form submissions.
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response(null, { status: 415 });
  const raw = await request.text();
  if (raw.length > 4096) return new Response(null, { status: 413 });
  let input;
  try {
    input = interactionSchema.safeParse(JSON.parse(raw));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!input.success) return new Response(null, { status: 400 });
  const p = input.data;
  if (
    p.service ||
    p.point ||
    ![
      "page_view",
      "agenda_click",
      "instagram_click",
      "tiktok_click",
      "whatsapp_click",
      "email_click",
      "website_click",
    ].includes(p.kind)
  )
    return new Response(null, { status: 400 });
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return Response.json({ stored: false }, { status: 503 });
  // Anonymous client deliberately ignores CRM cookies on this public collector.
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await db
    .from("organizations")
    .select("id")
    .eq("slug", p.slug)
    .eq("published", true)
    .maybeSingle();
  if (!data) return new Response(null, { status: 403 });
  const { data: channels } = await db
    .from("public_channels")
    .select("website_url")
    .eq("organization_id", data.id)
    .maybeSingle();
  if (!allowedWebOrigin(origin, channels?.website_url ?? ""))
    return new Response(null, { status: 403 });
  const { error } = await db.rpc("record_web_interaction", {
    p_slug: p.slug,
    p_id: p.id,
    p_session: p.session,
    p_kind: p.kind,
    p_target: p.target ?? null,
    p_origin: origin,
  });
  return Response.json(
    { stored: !error },
    {
      status: error ? 503 : 202,
      headers: {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Cache-Control": "no-store",
      },
    },
  );
}
