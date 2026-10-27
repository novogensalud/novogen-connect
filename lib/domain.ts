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
export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(["CHECK", "VITA", "BODY", "COMPRENDE", "OPTIMIZA"]),
  description: z.string().trim().min(5).max(500),
});
export function safeLocalPath(path: string) {
  return /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(path) ? path : "/";
}
export type Organization = { id: string; name: string; slug: string };
export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  active: boolean;
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
