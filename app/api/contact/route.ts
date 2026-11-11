import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { contactRequestSchema, contactFailure } from "@/lib/contact-request";
import { isConfigured, supabase } from "@/lib/supabase";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const reply = (body: object, status: number) => Response.json(body, { status, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ message: "Abre el formulario desde CONNECT." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ message: "Formato no válido." }, 415);
  if (Number(request.headers.get("content-length")) > 4096)
    return reply({ message: "Solicitud demasiado extensa." }, 413);
  const body = await request.text();
  if (body.length > 4096) return reply({ message: "Solicitud demasiado extensa." }, 413);
  let raw;
  try { raw = JSON.parse(body); } catch { return reply({ message: "Revisa tus datos." }, 400); }
  const parsed = contactRequestSchema.safeParse(raw);
  if (!parsed.success) return reply({ message: "Revisa tu nombre, correo y autorización de contacto." }, 400);
  if (!isConfigured()) return reply({ message: "Este formulario está en demostración. No se guardó tu solicitud." }, 503);
  const p = parsed.data;
  const db = await supabase();
  const receipt = randomBytes(32).toString("hex");
  const { error } = await db.rpc("capture_connect_request", {
    p_slug: p.slug, p_name: p.name, p_email: p.email, p_phone: p.phone,
    p_service: p.service || null, p_code: p.point,
    p_consent: true, p_request_type: p.request_type, p_receipt: receipt,
  });
  if (error) {
    const failure = contactFailure(error.message);
    return reply({ message: failure.message }, failure.status);
  }
  (await cookies()).set(`connect_receipt_${p.slug}`, receipt, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  return reply({ received: true, message: "Recibimos tu solicitud. El equipo de NOVOGEN te contactará. Tu hora aún no está reservada." }, 201);
}
