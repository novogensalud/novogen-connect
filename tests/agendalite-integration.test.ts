import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { agendaliteEventSchema, verifyAgendaliteSignature, readAgendaliteBody } from "../lib/agendalite-integration";
import { POST } from "../app/api/integrations/agendalite/route";

const secret = "fixture-only-not-a-real-key-".padEnd(40, "x");
const fixture = () => ({ schema_version: 1, source: "agendalite", event_type: "booking.snapshot",
  event_id: randomUUID(), revision: 1, occurred_at: "2026-10-31T18:00:00Z", purpose: "reservation_management",
  booking: { id: "123", service_id: "9", service_name: "VITA", professional_id: null, start_at: "2026-11-02T13:30:00Z", end_at: "2026-11-02T15:00:00Z", status: "confirmed" },
  contact: { reference: "booking:123", name: "Contacto de prueba", email: "fixture@example.com", phone: "+56900000000" } });

test("commercial envelope rejects clinical fields, marketing assumptions and invalid periods", () => {
  const event = fixture();
  assert.equal(agendaliteEventSchema.safeParse(event).success, true);
  for (const field of ["custom_fields", "diagnosis", "rut", "clinical_results", "marketing_consent", "notes"])
    assert.equal(agendaliteEventSchema.safeParse({ ...event, [field]: "must not travel" }).success, false);
  assert.equal(agendaliteEventSchema.safeParse({ ...event, contact: { ...event.contact, marketing_consent: true } }).success, false);
  assert.equal(agendaliteEventSchema.safeParse({ ...event, booking: { ...event.booking, end_at: event.booking.start_at } }).success, false);
});

test("signature authenticates exact UTF-8 body and rejects stale, altered and missing credentials", () => {
  const raw = JSON.stringify(fixture()), timestamp = "1793469600";
  const signature = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  assert.equal(verifyAgendaliteSignature(raw, timestamp, signature, secret, Number(timestamp)), true);
  assert.equal(verifyAgendaliteSignature(raw + " ", timestamp, signature, secret, Number(timestamp)), false);
  assert.equal(verifyAgendaliteSignature(raw, timestamp, signature, secret, Number(timestamp) + 301), false);
  assert.equal(verifyAgendaliteSignature(raw, timestamp, signature, "", Number(timestamp)), false);
  assert.equal(verifyAgendaliteSignature(raw, timestamp, "sha256=bad", secret, Number(timestamp)), false);
});

test("request body is bounded in bytes without trusting Content-Length", async () => {
  const body = JSON.stringify(fixture());
  assert.equal(await readAgendaliteBody(new Request("https://example.test", { method: "POST", body })), body);
  await assert.rejects(readAgendaliteBody(new Request("https://example.test", { method: "POST", body: "é".repeat(5000) })), /body_too_large/);
});

test("HTTP receiver stays disabled by default and rejects unsigned or clinical payloads without network calls", async () => {
  const keys = ["CONNECT_AGENDALITE_ENABLED", "CONNECT_AGENDALITE_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error("network forbidden in this test"); };
  try {
    delete process.env.CONNECT_AGENDALITE_ENABLED;
    const request = (body: string, extra: Record<string, string> = {}) => new Request("https://connect.example.test/api/integrations/agendalite", {
      method: "POST", headers: { "content-type": "application/json", ...extra }, body,
    });
    assert.equal((await POST(request(JSON.stringify(fixture())))).status, 503);
    process.env.CONNECT_AGENDALITE_ENABLED = "true";process.env.CONNECT_AGENDALITE_SECRET = secret;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
    assert.equal((await POST(request(JSON.stringify(fixture())))).status, 401);
    const raw = JSON.stringify({ ...fixture(), clinical_results: "must not be imported" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = "sha256=" + createHmac("sha256", secret).update(timestamp + "." + raw).digest("hex");
    assert.equal((await POST(request(raw, { "x-novogen-timestamp": timestamp, "x-novogen-signature": signature }))).status, 400);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key];else process.env[key] = previous[index]; });
  }
});

test("booking import is transactional, organization-scoped and independent of marketing leads", async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of ["202610270001_connect_core.sql", "202610310010_agendalite_commercial_bookings.sql"])
      await db.exec(await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"));
    const orgA = (await db.query<{ id: string }>("select id from public.organizations where slug='novogen'")).rows[0].id;
    const orgB = "b0000000-0000-4000-8000-000000000001";
    const adminA = "a0000000-0000-4000-8000-000000000002", agentB = "b0000000-0000-4000-8000-000000000002";
    await db.exec(`insert into auth.users values('${adminA}'),('${agentB}');
      insert into public.organizations(id,name,slug) values('${orgB}','Otra empresa','otra');
      insert into public.memberships values('${orgA}','${adminA}','admin'),('${orgB}','${agentB}','agent');`);
    const role = async (name: string, user = "") => db.exec(`reset role;set request.jwt.claim.sub='${user}';set role ${name};`);
    const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const ingest = async (value: ReturnType<typeof fixture>, key = secret, slug = "novogen") =>
      (await db.query<{ result: string }>("select public.ingest_agendalite_booking($1,$2,$3::jsonb,$4) as result", [slug, key, JSON.stringify(value), digest(value)])).rows[0].result;
    const event = fixture();
    await t.test("only an organization administrator can provision a disabled credential", async () => {
      await role("authenticated", agentB);
      await assert.rejects(db.query("select public.configure_agendalite_integration($1,$2,true)", [orgA, createHash("sha256").update(secret).digest("hex")]), /Forbidden/);
      await role("authenticated", adminA);
      await db.query("select public.configure_agendalite_integration($1,$2,false)", [orgA, createHash("sha256").update(secret).digest("hex")]);
      await role("anon");
      await assert.rejects(ingest(event), /unauthorized/);
      await role("authenticated", adminA);
      await db.query("select public.configure_agendalite_integration($1,$2,true)", [orgA, createHash("sha256").update(secret).digest("hex")]);
    });
    await t.test("an invalid credential cannot import or cross organization boundaries", async () => {
      await role("anon");
      await assert.rejects(ingest(event, secret + "wrong"), /unauthorized/);
      await assert.rejects(ingest(event, secret, "otra"), /unauthorized/);
      assert.equal(await ingest(event), "accepted");
      assert.equal(await ingest(event), "duplicate");
      await assert.rejects(ingest({ ...event, contact: { ...event.contact, name: "Conflicto" } }), /integration_conflict/);
    });
    await t.test("rescheduling updates one booking; a delayed notification cannot reverse it", async () => {
      const newer = { ...fixture(), revision: 3, booking: { ...event.booking, start_at: "2026-11-03T13:30:00Z", end_at: "2026-11-03T15:00:00Z" } };
      assert.equal(await ingest(newer), "accepted");
      assert.equal(await ingest({ ...event, event_id: randomUUID(), revision: 2 }), "ignored");
      await assert.rejects(ingest({ ...fixture(), revision: 3 }), /integration_conflict/);
    });
    await t.test("families sharing an email keep distinct reservation contact references", async () => {
      const other = { ...fixture(), booking: { ...event.booking, id: "124" }, contact: { ...event.contact, reference: "booking:124", name: "Otro contacto" } };
      assert.equal(await ingest(other), "accepted");
      await role("authenticated", adminA);
      const rows = (await db.query<{ external_booking_id: string; marketing_consent: boolean | null; revision: number }>("select * from public.commercial_bookings order by external_booking_id")).rows;
      assert.equal(rows.length, 2);assert.equal(rows[0].marketing_consent, null);assert.equal(Number(rows[0].revision), 3);
      assert.equal(Number((await db.query<{ n: number }>("select count(*) as n from public.leads")).rows[0].n), 0);
    });
    await t.test("anonymous callers cannot read bookings or credentials; another tenant sees none", async () => {
      await role("anon");
      await assert.rejects(db.query("select * from public.commercial_bookings"), /permission denied/);
      await assert.rejects(db.query("select * from public.booking_integration_credentials"), /permission denied/);
      await role("authenticated", agentB);
      assert.equal((await db.query("select * from public.commercial_bookings")).rows.length, 0);
      await assert.rejects(db.query("update public.commercial_bookings set status='cancelled'"), /permission denied/);
    });
    await t.test("invalid imports roll back their receipt and booking together", async () => {
      const broken = { ...fixture(), booking: { ...event.booking, id: "125", end_at: event.booking.start_at } };
      await role("anon");
      await assert.rejects(ingest(broken), /check constraint/);
      await role("authenticated", adminA);
      assert.equal((await db.query("select * from public.booking_integration_events where event_id=$1", [broken.event_id])).rows.length, 0);
      assert.equal((await db.query("select * from public.commercial_bookings where external_booking_id='125'")).rows.length, 0);
    });
  } finally { await db.close(); }
});
