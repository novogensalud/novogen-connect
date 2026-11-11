import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const externalId = z.string().regex(/^[1-9][0-9]{0,19}$/);
export const agendaliteEventSchema = z.object({
  schema_version: z.literal(1),
  source: z.literal("agendalite"),
  event_type: z.literal("booking.snapshot"),
  event_id: z.string().uuid(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  occurred_at: z.string().datetime(),
  purpose: z.literal("reservation_management"),
  booking: z.object({
    id: externalId,
    service_id: externalId,
    service_name: z.string().trim().min(1).max(100),
    professional_id: externalId.nullable(),
    start_at: z.string().datetime(),
    end_at: z.string().datetime(),
    status: z.enum(["pending", "confirmed", "cancelled", "expired", "deleted"]),
  }).strict().refine(b => Date.parse(b.end_at) > Date.parse(b.start_at)),
  contact: z.object({
    reference: z.string().regex(/^(booking|client):[1-9][0-9]{0,19}$/),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254).toLowerCase(),
    phone: z.string().max(30).regex(/^[+0-9 ()-]*$/),
  }).strict(),
}).strict();

export type AgendaliteEvent = z.infer<typeof agendaliteEventSchema>;
export const MAX_AGENDALITE_BYTES = 8192;

/** A retry retains the event body/ID; only the transport timestamp/signature changes. */
export function verifyAgendaliteSignature(raw: string, timestamp: string | null,
  signature: string | null, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (secret.length < 32 || secret.length > 256 || !timestamp || !/^[0-9]{10}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300 || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export function agendaliteDigest(raw: string) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Limit actual streamed bytes, including requests without Content-Length. */
export async function readAgendaliteBody(request: Request): Promise<string> {
  if (Number(request.headers.get("content-length")) > MAX_AGENDALITE_BYTES) throw new Error("body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty_body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > MAX_AGENDALITE_BYTES) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(part.value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}
