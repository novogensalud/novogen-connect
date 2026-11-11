import { z } from "zod";
import { leadSchema } from "./domain";
export const contactRequestSchema = leadSchema.extend({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  point: z.string().regex(/^[a-f0-9]{32}$/).nullable().default(null),
  request_type: z.enum(["information", "human"]).default("information"),
  website: z.literal("").default(""),
}).strict();
export function contactFailure(message: string) {
  if (message.includes("Contact already received recently"))
    return { status: 409, message: "Ya recibimos una solicitud con este correo durante la última hora. El equipo la revisará; también puedes consultar por WhatsApp." };
  if (message.includes("Submission limit reached"))
    return { status: 429, message: "Recibimos muchas solicitudes. Intenta más tarde o consulta por WhatsApp." };
  if (/Invalid service|Invalid point|Unavailable/.test(message))
    return { status: 422, message: "Este servicio o acceso ya no está disponible. Actualiza CONNECT y vuelve a elegir." };
  return { status: 503, message: "No pudimos confirmar el envío. Conserva esta ventana e intenta de nuevo o consulta por WhatsApp." };
}
