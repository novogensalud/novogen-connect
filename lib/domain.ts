import { z } from "zod";
export const stages = [
  "new",
  "contacted",
  "qualified",
  "booked",
  "closed_lost",
] as const;
export type Stage = (typeof stages)[number];
export const stageLabels: Record<Stage, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  booked: "Reserva informada",
  closed_lost: "Cerrado",
};
export const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/),
  service: z.string().uuid().or(z.literal("")),
  consent: z.literal("on"),
});
export const serviceSchema = z
  .object({
    catalog_type: z.enum(["service", "group"]).default("service"),
    parent_id: z.preprocess(
      (v) => (v === "" ? null : v),
      z.string().uuid().nullable().default(null),
    ),
    action_url: z
      .string()
      .trim()
      .max(2048)
      .default("")
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Usa un enlace HTTPS sin credenciales"),
    action_label: z.string().trim().max(60).default(""),
    subcategory: z.preprocess(
      (value) => (value === "" ? null : value),
      z.enum(["SUPLE", "RECOVERY", "GLOW"]).nullable().default(null),
    ),
    name: z.string().trim().min(2).max(80),
    category: z.enum([
      "CHECK",
      "VITA",
      "BODY",
      "COMPRENDE",
      "OPTIMIZA",
      "SEGUIMIENTO",
    ]),
    description: z.string().trim().min(5).max(500),
  })
  .refine((s) => !s.subcategory || s.category === "OPTIMIZA", {
    message: "La subcategoría solo corresponde a OPTIMIZA",
    path: ["subcategory"],
  });
export function safeLocalPath(path: string) {
  return /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(path) ? path : "/";
}
export type Organization = { id: string; name: string; slug: string };
export type Service = {
  catalog_type?: "service" | "group";
  parent_id?: string | null;
  action_url?: string;
  action_label?: string;
  id: string;
  name: string;
  category: string;
  description: string;
  active: boolean;
  subcategory?: string | null;
};
export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  service_id: string | null;
  opportunities: { id: string; stage: Stage; next_action: string | null }[];
};
export type Point = { id: string; code: string; name: string; active: boolean };
