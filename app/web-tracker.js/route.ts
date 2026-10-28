import { webTrackerScript } from "@/lib/web-tracker";
export async function GET() {
  return new Response(webTrackerScript, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
