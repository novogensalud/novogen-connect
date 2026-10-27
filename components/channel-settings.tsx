import { supabase } from "@/lib/supabase";
import {
  emptyChannels,
  novogenChannels,
  type PublicChannels,
} from "@/lib/channels";
import { saveChannels } from "@/app/actions";
export async function ChannelSettings({
  org,
  slug,
  demo,
}: {
  org: string;
  slug: string;
  demo: boolean;
}) {
  let channels: PublicChannels =
    slug === "novogen" ? novogenChannels : emptyChannels;
  if (!demo) {
    const db = await supabase();
    const { data, error } = await db
      .from("public_channels")
      .select("*")
      .eq("organization_id", org)
      .maybeSingle();
    if (error)
      return (
        <section className="panel form-panel">
          <h2>Canales de CONNECT FLASH</h2>
          <p>
            Activa la migración 004 para administrar los enlaces y medir cada
            botón.
          </p>
        </section>
      );
    channels = data ?? emptyChannels;
  }
  const fields = [
    ["website_url", "Sitio institucional"],
    ["agenda_url", "Agenda / reservas"],
    ["instagram_url", "Instagram"],
    ["tiktok_url", "TikTok"],
    ["whatsapp_url", "WhatsApp"],
    ["email", "Correo comercial"],
  ] as const;
  return (
    <section className="panel form-panel">
      <h2>Canales de CONNECT FLASH</h2>
      <p>
        Los enlaces publicados se administran aquí. Los canales vacíos no abren
        un destino ni generan accesos ficticios.
      </p>
      <form action={saveChannels} className="edit-form">
        <input type="hidden" name="org" value={org} />
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type={key === "email" ? "email" : "url"}
              name={key}
              defaultValue={channels[key]}
              maxLength={key === "email" ? 254 : 2048}
              placeholder={key === "email" ? "contacto@empresa.cl" : "https://"}
            />
          </label>
        ))}
        <button className="button primary" disabled={demo}>
          Guardar enlaces de FLASH
        </button>
      </form>
    </section>
  );
}
