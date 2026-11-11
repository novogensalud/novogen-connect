import { test } from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { originalConnectHtml } from "../lib/original-connect";
import { novogenChannels } from "../lib/channels";

test("original mobile interface uses CRM channels without changing styles or leaving script injection", () => {
  const channels = {
    ...novogenChannels,
    agenda_url: "https://example.com/agenda?x=</script><script>evil()</script>",
  };
  const html = originalConnectHtml(channels);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  new Script(script);
  assert.ok(html.includes("viewport-fit=cover"));
  assert.ok(html.includes("safe-area-inset-bottom"));
  assert.ok(html.includes("min-height:44px"));
  assert.ok(html.includes("href:st.agenda"));
  assert.ok(html.includes("https://example.com/agenda"));
  assert.ok(!html.includes("Francisco Ortiz"));
  assert.ok(!html.includes("<script>evil()"));
});

test("original app route serves NOVOGEN demo and rejects other brands", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    const { GET } = await import("../app/connect/[slug]/app/route");
    const response = await GET(
      new Request("https://example.com/connect/novogen/app"),
      { params: Promise.resolve({ slug: "novogen" }) },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-connect-storage"), "demo");
    const html = await response.text();
    assert.ok(html.includes("https://www.novogensalud.cl/reservar/"));
    const other = await GET(
      new Request("https://example.com/connect/other/app"),
      { params: Promise.resolve({ slug: "other" }) },
    );
    assert.equal(other.status, 404);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("catalogue preserves active services and hides an entire inactive subtree", async () => {
  const { visibleCatalogue } = await import("../lib/catalogue-tree");
  const group = {
    id: "10000000-0000-4000-8000-000000000010",
    name: "RECOVERY",
    category: "OPTIMIZA",
    description: "Preferencia",
    active: true,
    catalog_type: "group" as const,
  };
  const child = {
    id: "10000000-0000-4000-8000-000000000011",
    name: "RECOVERY · Essential",
    category: "OPTIMIZA",
    description: "Desde CRM",
    active: true,
    catalog_type: "service" as const,
    parent_id: group.id,
  };
  const { mobileCatalogue } = await import("../lib/original-connect");
  assert.equal(mobileCatalogue([group, child])[1].sourceId, "essential");
  assert.equal(
    visibleCatalogue([{ ...group, active: false }, child]).length,
    0,
  );
  assert.equal(visibleCatalogue([child]).length, 0);
  const html = originalConnectHtml(novogenChannels, {
    services: [group, child],
  });
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    new Script(m[1]);
});
