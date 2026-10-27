import { isConfigured } from "@/lib/supabase";
export async function GET() {
  return Response.json({
    status: "ok",
    storage: isConfigured() ? "configured-not-verified" : "demo",
  });
}
