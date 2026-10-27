import { interactionSchema } from "@/lib/automation";
import { isConfigured, supabase } from "@/lib/supabase";
export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 4096) return new Response(null, { status: 413 });
  let input;
  try {
    input = interactionSchema.safeParse(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!input.success) return new Response(null, { status: 400 });
  if (!isConfigured())
    return Response.json({ stored: false, mode: "demo" }, { status: 202 });
  const p = input.data;
  const db = await supabase();
  const payload = {
    p_slug: p.slug,
    p_id: p.id,
    p_session: p.session,
    p_kind: p.kind,
    p_service: p.service ?? null,
    p_code: p.point ?? null,
  };
  let { error } = await db.rpc("record_interaction", {
    ...payload,
    p_target: p.target ?? null,
  });
  if (
    error?.code === "PGRST202" &&
    [
      "page_view",
      "service_view",
      "whatsapp_click",
      "email_click",
      "website_click",
      "contact_started",
    ].includes(p.kind)
  ) {
    const legacy = await db.rpc("record_interaction", payload);
    error = legacy.error;
  }
  return Response.json(
    { stored: !error },
    { status: error ? 503 : 202, headers: { "Cache-Control": "no-store" } },
  );
}
