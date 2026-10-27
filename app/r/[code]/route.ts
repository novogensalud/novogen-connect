import { NextRequest, NextResponse } from "next/server";
import { supabase, isConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!isConfigured()) {
    if (code === "demo-recepcion")
      return NextResponse.redirect(
        new URL("/connect/novogen?point=demo-recepcion", request.url),
        { status: 303, headers: { "Cache-Control": "no-store" } },
      );
    return new Response("Punto no disponible", { status: 404 });
  }
  if (!/^[a-f0-9]{32}$/.test(code))
    return new Response("Punto no disponible", { status: 404 });
  const db = await supabase();
  const { data, error } = await db.rpc("resolve_point", { p_code: code });
  if (error)
    return new Response("No se pudo resolver el punto. Intenta más tarde.", {
      status: 503,
    });
  if (!data || !/^[a-z0-9-]{1,60}$/.test(data))
    return new Response("Punto no disponible", { status: 404 });
  return NextResponse.redirect(
    new URL(`/connect/${data}?point=${encodeURIComponent(code)}`, request.url),
    { status: 303, headers: { "Cache-Control": "no-store" } },
  );
}
