import { getSupabaseConfig } from "./config";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
export function isConfigured() {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}
export async function supabase() {
  if (!isConfigured()) throw new Error("Supabase no está configurado");
  const { url, key } = getSupabaseConfig();
  const jar = await cookies();
  return createServerClient(url!, key!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (
        values: { name: string; value: string; options: CookieOptions }[],
      ) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server components cannot write cookies; actions refresh them. */
        }
      },
    },
  });
}
