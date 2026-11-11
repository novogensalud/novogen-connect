import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/config";
import { agendaliteDigest, agendaliteEventSchema, readAgendaliteBody, verifyAgendaliteSignature } from "@/lib/agendalite-integration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const reply = (status: number, message: string) => Response.json({ message }, { status, headers });
  const secret = process.env.CONNECT_AGENDALITE_SECRET || "";
  const slug = process.env.CONNECT_AGENDALITE_ORGANIZATION || "novogen";
  const config = getSupabaseConfig();
  if (process.env.CONNECT_AGENDALITE_ENABLED !== "true" || secret.length < 32 || secret.length > 256 || !config.url || !config.key)
    return reply(503, "Integración no habilitada.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415, "Formato no válido.");
  let raw: string;
  try { raw = await readAgendaliteBody(request); }
  catch (error) { return reply(error instanceof Error && error.message === "body_too_large" ? 413 : 400, "Solicitud no válida."); }
  if (!verifyAgendaliteSignature(raw, request.headers.get("x-novogen-timestamp"), request.headers.get("x-novogen-signature"), secret))
    return reply(401, "Autenticación no válida.");
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return reply(400, "Solicitud no válida."); }
  const parsed = agendaliteEventSchema.safeParse(payload);
  if (!parsed.success) return reply(400, "Datos de reserva no válidos.");
  // Anonymous Supabase identity + a dedicated, organization-scoped RPC credential.
  // No staff session cookie or broad service-role key is used by this receiver.
  const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("ingest_agendalite_booking", {
    p_slug: slug, p_secret: secret, p_event: parsed.data, p_digest: agendaliteDigest(raw),
  });
  if (error) {
    if (error.code === "23505" || error.message.includes("integration_conflict")) return reply(409, "Conflicto de sincronización; requiere revisión.");
    return reply(503, "No se confirmó la sincronización; reintentar.");
  }
  return Response.json({ received: true, result: data }, { status: 200, headers });
}
