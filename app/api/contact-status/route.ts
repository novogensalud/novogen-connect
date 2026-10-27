import { cookies } from "next/headers";
import { isConfigured, supabase } from "@/lib/supabase";
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug))
    return new Response(null, { status: 400 });
  const headers = { "Cache-Control": "private, no-store" };
  const receipt = (await cookies()).get(`connect_receipt_${slug}`)?.value;
  if (!receipt || !/^[a-f0-9]{64}$/.test(receipt) || !isConfigured())
    return Response.json({ items: [], enabled: true }, { headers });
  const db = await supabase();
  const { data, error } = await db.rpc("get_contact_status", {
    p_slug: slug,
    p_receipt: receipt,
  });
  const row = data?.[0];
  return Response.json(
    {
      items: row
        ? [
            {
              id: row.updated_at,
              kind:
                row.stage === "new"
                  ? "Solicitud recibida"
                  : "Tu solicitud comercial tiene una actualización",
            },
          ]
        : [],
      enabled: !error,
    },
    { status: error ? 503 : 200, headers },
  );
}
