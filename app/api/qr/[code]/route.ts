import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { supabase, isConfigured } from "@/lib/supabase";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!isConfigured()) {
    if (code !== "demo-recepcion")
      return new Response("No disponible", { status: 404 });
  } else {
    const db = await supabase();
    const { data } = await db
      .from("connect_points")
      .select("id")
      .eq("code", code)
      .single();
    if (!data) return new Response("No disponible", { status: 404 });
  }
  const svg = await QRCode.toString(
    new URL(`/r/${code}`, request.url).toString(),
    {
      type: "svg",
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#173c3d", light: "#ffffff" },
    },
  );
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="connect-${code}.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
