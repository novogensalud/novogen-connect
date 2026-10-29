import { z } from "zod";
export const sourceSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
    title: z.string().trim().min(2).max(160),
    type: z.enum(["text", "url"]),
    url: z.string().max(2048).default(""),
    content: z.string().trim().max(20000).default(""),
    status: z.enum(["draft", "approved", "archived"]).optional(),
  })
  .strict()
  .superRefine((s, c) => {
    if (s.type === "url") {
      try {
        const u = new URL(s.url);
        if (u.protocol !== "https:" || u.username || u.password) throw Error();
      } catch {
        c.addIssue({
          code: "custom",
          path: ["url"],
          message: "El enlace debe ser HTTPS y sin credenciales",
        });
      }
    } else if (s.url || s.content.length < 5)
      c.addIssue({
        code: "custom",
        path: ["content"],
        message: "El documento necesita texto y no debe incluir URL",
      });
  });
export const sourceBundleSchema = z
  .object({
    version: z.literal(1),
    sources: z.array(sourceSchema).min(1).max(100),
  })
  .strict()
  .superRefine((b, c) => {
    const keys = new Set<string>();
    for (const s of b.sources) {
      if (keys.has(s.key))
        c.addIssue({ code: "custom", message: `Clave duplicada: ${s.key}` });
      keys.add(s.key);
    }
  });
export type OrientationSource = z.infer<typeof sourceSchema>;
export type StoredOrientationSource = OrientationSource & {
  status: "draft" | "approved" | "archived";
  updated_at: string;
};
export const sourceTemplate = {
  version: 1,
  sources: [
    {
      key: "orientacion-general",
      title: "Orientación comercial general",
      type: "text",
      url: "",
      content:
        "Reemplaza este texto con información comercial validada de NOVOGEN.",
      status: "draft",
    },
  ],
};
export function parseSourceFile(
  text: string,
  filename: string,
): { version: 1; sources: OrientationSource[] } {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw Error("El archivo supera 2 MB");
  if (/\.(txt|md)$/i.test(filename)) {
    const key =
      filename
        .replace(/\.(txt|md)$/i, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "documento";
    return sourceBundleSchema.parse({
      version: 1,
      sources: [
        {
          key,
          title: filename.replace(/\.(txt|md)$/i, "").slice(0, 160),
          type: "text",
          url: "",
          content: text,
        },
      ],
    });
  }
  if (!/\.json$/i.test(filename)) throw Error("Usa JSON, TXT o Markdown");
  return sourceBundleSchema.parse(JSON.parse(text.replace(/^\uFEFF/, "")));
}
