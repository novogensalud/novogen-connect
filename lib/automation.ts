import { z } from "zod";
export const interactionKinds = [
  "page_view",
  "service_view",
  "whatsapp_click",
  "email_click",
  "website_click",
  "contact_started",
] as const;
export const interactionSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
    id: z.string().uuid(),
    session: z.string().uuid(),
    kind: z.enum(interactionKinds),
    service: z.string().uuid().nullable().optional(),
    point: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .nullable()
      .optional(),
    consent: z.literal(true),
  })
  .strict();
export const interactionLabels: Record<string, string> = {
  page_view: "Visitas a CONNECT",
  service_view: "Consultas de servicios",
  whatsapp_click: "Clics a WhatsApp desde CONNECT",
  email_click: "Clics a correo",
  website_click: "Clics al sitio institucional",
  contact_started: "Formularios iniciados",
};
export type FollowupTask = {
  id: string;
  opportunity_id: string;
  state: "pending" | "done" | "cancelled";
  human_required: boolean;
  due_at: string;
  red_at: string;
  assigned_to: string | null;
};
export type CommercialNotification = {
  id: string;
  kind: "new_request" | "reminder" | "human_handoff";
  created_at: string;
  read_at: string | null;
};
export const notificationLabels = {
  new_request: "Nueva solicitud comercial",
  reminder: "Hay un seguimiento pendiente",
  human_handoff: "Una persona solicita atención humana",
};
