import { originalConnectHtml } from "@/lib/original-connect";
import { channelSchema, emptyChannels, novogenChannels } from "@/lib/channels";
import { isConfigured, supabase } from "@/lib/supabase";
import { demoServices } from "@/lib/demo";
import type { Service } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // The recovered branding and fixed service descriptions belong to NOVOGEN only.
  if (slug !== "novogen") return new Response("No disponible", { status: 404 });
  let channels = novogenChannels;
  let services: Service[] = demoServices;
  const pointInput = new URL(request.url).searchParams.get("point");
  const point =
    pointInput && /^[a-f0-9]{32}$/.test(pointInput) ? pointInput : null;
  if (isConfigured()) {
    const db = await supabase();
    const org = await db
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (org.error)
      return new Response("No se pudo cargar CONNECT", { status: 503 });
    if (!org.data) return new Response("No disponible", { status: 404 });
    const organizationId = org.data.id;
    const [result, catalogue] = await Promise.all([
      db
        .from("public_channels")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      db
        .from("services")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("created_at"),
    ]);
    if (result.error)
      return new Response("No se pudieron cargar los canales", { status: 503 });
    const parsed = channelSchema.safeParse(result.data ?? emptyChannels);
    if (!parsed.success)
      return new Response("Revisa los canales de CONNECT en el CRM", {
        status: 503,
      });
    channels = parsed.data;
    if (catalogue.error)
      return new Response("No se pudo cargar el catálogo", { status: 503 });
    services = catalogue.data ?? [];
  }
  return new Response(
    originalConnectHtml(channels, {
      services,
      slug,
      point,
      demo: !isConfigured(),
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Connect-Storage": isConfigured() ? "configured" : "demo",
      },
    },
  );
}
