import { z } from "zod";
const https = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Usa una URL HTTPS sin credenciales");
const social = (hosts: string[]) =>
  https.refine((value) => {
    if (!value) return true;
    try {
      return hosts.includes(new URL(value).hostname.toLowerCase());
    } catch {
      return false;
    }
  }, "El dominio no corresponde a este canal");
export const channelSchema = z.object({
  website_url: https,
  agenda_url: https,
  instagram_url: social(["instagram.com", "www.instagram.com"]),
  tiktok_url: social([
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
  ]),
  whatsapp_url: social(["wa.me", "api.whatsapp.com", "www.whatsapp.com"]),
  email: z.string().trim().max(254).email().or(z.literal("")),
});
export type PublicChannels = z.infer<typeof channelSchema>;
export const emptyChannels: PublicChannels = {
  website_url: "",
  agenda_url: "",
  instagram_url: "",
  tiktok_url: "",
  whatsapp_url: "",
  email: "",
};
export const novogenChannels: PublicChannels = {
  website_url: "https://novogensalud.cl/",
  agenda_url: "https://www.novogensalud.cl/reservar/",
  instagram_url: "https://www.instagram.com/novogen.temuco",
  tiktok_url: "",
  whatsapp_url: "https://wa.me/56944683094",
  email: "novogen.temuco@gmail.com",
};
