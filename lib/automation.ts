import { z } from "zod";
export const interactionKinds = [
  "page_view",
  "service_view",
  "whatsapp_click",
  "email_click",
  "website_click",
  "contact_started",
  "agenda_click",
  "instagram_click",
  "tiktok_click",
  "button_click",
] as const;
export const interactionTargets = [
  "orientame",
  "services",
  "promos",
  "agenda",
  "instagram",
  "tiktok",
  "whatsapp",
  "email",
  "website",
  "service_info",
  "service_contact",
  "service_close",
  "contact_submit",
  "team_access",
  "crm_access",
  "device_enable",
  "device_pause",
  "install_app",
  "install_close",
] as const;
export const targetLabels: Record<string, string> = {
  orientame: "ORIÉNTAME",
  services: "SERVICIOS",
  promos: "PROMOS",
  agenda: "Agenda",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  email: "Correo",
  website: "IR A NOVOGEN / sitio",
  service_info: "Más información",
  service_contact: "Solicitar orientación de servicio",
  service_close: "Cerrar ficha",
  contact_submit: "Enviar solicitud",
  team_access: "Acceso equipo",
  crm_access: "Acceso al CRM",
  device_enable: "Activar alertas",
  device_pause: "Pausar alertas",
  install_app: "Instalar CONNECT",
  install_close: "Cerrar instrucciones de instalación",
};
const pairedTargets: Record<string, string> = {
  whatsapp_click: "whatsapp",
  email_click: "email",
  website_click: "website",
  service_view: "service_info",
  agenda_click: "agenda",
  instagram_click: "instagram",
  tiktok_click: "tiktok",
};
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
    target: z.enum(interactionTargets).nullable().optional(),
    consent: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "button_click" && !value.target)
      ctx.addIssue({
        code: "custom",
        path: ["target"],
        message: "El botón debe tener un identificador",
      });
    if (
      value.target &&
      pairedTargets[value.kind] &&
      pairedTargets[value.kind] !== value.target
    )
      ctx.addIssue({
        code: "custom",
        path: ["target"],
        message: "El botón no corresponde al canal",
      });
    if (
      ["agenda_click", "instagram_click", "tiktok_click"].includes(
        value.kind,
      ) &&
      value.target !== pairedTargets[value.kind]
    )
      ctx.addIssue({
        code: "custom",
        path: ["target"],
        message: "Falta identificar el canal",
      });
    if (["page_view", "contact_started"].includes(value.kind) && value.target)
      ctx.addIssue({
        code: "custom",
        path: ["target"],
        message: "El evento no es un clic",
      });
    if (
      value.kind === "button_click" &&
      value.target &&
      Object.values(pairedTargets).includes(value.target)
    )
      ctx.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Usa el tipo específico del canal",
      });
    if (value.target?.startsWith("service_") && !value.service)
      ctx.addIssue({
        code: "custom",
        path: ["service"],
        message: "Falta identificar el servicio",
      });
  });
export const interactionLabels: Record<string, string> = {
  page_view: "Visitas a CONNECT",
  service_view: "Consultas de servicios",
  whatsapp_click: "Clics a WhatsApp desde CONNECT",
  email_click: "Clics a correo",
  website_click: "Clics al sitio institucional",
  contact_started: "Formularios iniciados",
  agenda_click: "Clics a agenda",
  instagram_click: "Clics a Instagram",
  tiktok_click: "Clics a TikTok",
  button_click: "Otros botones de CONNECT FLASH",
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
