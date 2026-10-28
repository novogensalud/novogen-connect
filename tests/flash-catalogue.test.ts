import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import recovered from "../lib/recovered-services.json";
import { channelSchema, novogenChannels } from "../lib/channels";
import { interactionSchema } from "../lib/automation";

test("recovered catalogue contains three RECOVERY and seven GLOW services without prices", () => {
  assert.equal(recovered.filter((s) => s.subcategory === "RECOVERY").length, 3);
  assert.equal(recovered.filter((s) => s.subcategory === "GLOW").length, 7);
  assert.ok(
    recovered.every(
      (s) =>
        Object.keys(s).sort().join(",") ===
          "description,name,source_id,subcategory" &&
        !/\$|\bCLP\b/.test(s.description),
    ),
  );
});
test("public channels reject credentials, wrong social hosts and invalid URLs", () => {
  assert.equal(channelSchema.safeParse(novogenChannels).success, true);
  for (const patch of [
    { tiktok_url: "not-a-url" },
    { tiktok_url: "https://example.com/tiktok" },
    { website_url: "https://user:pass@example.com/" },
    { agenda_url: "javascript:alert(1)" },
    { instagram_url: "https://www.instagram.com.attacker.example/" },
  ])
    assert.equal(
      channelSchema.safeParse({ ...novogenChannels, ...patch }).success,
      false,
    );
  const payload = {
    slug: "novogen",
    id: "a0000000-0000-4000-8000-000000000001",
    session: "a0000000-0000-4000-8000-000000000002",
    kind: "agenda_click",
    target: "agenda",
    consent: true,
  };
  assert.equal(interactionSchema.safeParse(payload).success, true);
  for (const patch of [
    { target: "whatsapp" },
    { target: "a@example.com" },
    { target: "https://example.com" },
    { kind: "page_view" },
  ])
    assert.equal(
      interactionSchema.safeParse({ ...payload, ...patch }).success,
      false,
    );
});
test("channel and service interaction migration preserves tenant boundaries and legacy events", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    for (const name of [
      "202610270001_connect_core.sql",
      "202610270002_manual_contacts.sql",
      "202610270003_followup_and_interactions.sql",
      "202610270004_flash_catalogue_and_buttons.sql",
      "202610280005_metrics_sources.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    const a = "a0000000-0000-4000-8000-000000000001",
      b = "b0000000-0000-4000-8000-000000000001",
      ua = "a0000000-0000-4000-8000-000000000002",
      ub = "b0000000-0000-4000-8000-000000000002",
      agent = "a0000000-0000-4000-8000-000000000003",
      serviceA = "a0000000-0000-4000-8000-000000000004",
      session = "a0000000-0000-4000-8000-000000000005";
    const role = async (r: string, u = "") =>
      db.exec(`reset role;set request.jwt.claim.sub='${u}';set role ${r};`);
    await db.exec(
      `insert into auth.users values('${ua}'),('${ub}'),('${agent}');insert into public.organizations(id,name,slug,published)values('${a}','Empresa A','empresa-a',true),('${b}','Empresa B','empresa-b',false);insert into public.memberships values('${a}','${ua}','admin'),('${a}','${agent}','agent'),('${b}','${ub}','admin');insert into public.public_channels(organization_id,website_url)values('${a}','https://example.com/'),('${b}','https://private.example.com/');insert into public.services(id,organization_id,name,category,description)values('${serviceA}','${a}','Servicio A','OPTIMIZA','Información comercial');`,
    );
    await t.test(
      "original names and subcategories are seeded once for the pilot",
      async () => {
        const rows = await db.query<{ name: string; subcategory: string }>(
          "select name,subcategory from public.services where name=any($1)",
          [recovered.map((s) => s.name)],
        );
        assert.equal(rows.rows.length, 10);
        assert.ok(
          rows.rows.every((r) =>
            recovered.some(
              (s) => s.name === r.name && s.subcategory === r.subcategory,
            ),
          ),
        );
      },
    );
    await t.test(
      "channel readers see published spaces only; agents and other tenants cannot edit",
      async () => {
        await role("anon");
        const channels = await db.query<{ organization_id: string }>(
          "select organization_id from public.public_channels",
        );
        assert.deepEqual(channels.rows, [{ organization_id: a }]);
        await role("authenticated", ub);
        assert.equal(
          (
            await db.query(
              "update public.public_channels set tiktok_url='https://www.tiktok.com/@example' where organization_id=$1 returning organization_id",
              [a],
            )
          ).rows.length,
          0,
        );
        await role("authenticated", agent);
        assert.equal(
          (
            await db.query(
              "update public.public_channels set tiktok_url='https://www.tiktok.com/@example' where organization_id=$1 returning organization_id",
              [a],
            )
          ).rows.length,
          0,
        );
        await role("authenticated", ua);
        await assert.rejects(
          db.query(
            "update public.public_channels set tiktok_url='https://wrong.example/' where organization_id=$1",
            [a],
          ),
          /channels_social/,
        );
        const updated = await db.query(
          "update public.public_channels set tiktok_url='https://www.tiktok.com/@example' where organization_id=$1 returning organization_id",
          [a],
        );
        assert.equal(updated.rows.length, 1);
      },
    );
    await t.test(
      "new channel events, individual service buttons and old events coexist",
      async () => {
        await role("anon");
        let seq = 0;
        const uuid = () =>
          `c0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        const record = (
          kind: string,
          target: string,
          service: string | null = null,
        ) =>
          db.query("select public.record_interaction($1,$2,$3,$4,$5,$6,$7)", [
            "empresa-a",
            uuid(),
            session,
            kind,
            service,
            null,
            target,
          ]);
        for (const channel of [
          "agenda",
          "instagram",
          "tiktok",
          "whatsapp",
          "email",
          "website",
        ])
          await record(channel + "_click", channel);
        for (const target of [
          "service_info",
          "service_contact",
          "service_close",
        ])
          await record(
            target === "service_info" ? "service_view" : "button_click",
            target,
            serviceA,
          );
        await assert.rejects(
          record("whatsapp_click", "agenda"),
          /Invalid target/,
        );
        await assert.rejects(
          record("service_view", "service_info", null),
          /Missing service/,
        );
        await assert.rejects(
          record("button_click", "email@example.com"),
          /interaction_events_target_check/,
        );
        await db.query("select public.record_interaction($1,$2,$3,$4,$5,$6)", [
          "empresa-a",
          uuid(),
          session,
          "page_view",
          null,
          null,
        ]);
        await role("authenticated", ua);
        const r = await db.query<{ n: number }>(
          "select count(*)::int as n from public.interaction_events",
        );
        assert.equal(r.rows[0].n, 10);
        await role("authenticated", ub);
        assert.equal(
          (await db.query("select * from public.interaction_events")).rows
            .length,
          0,
        );
      },
    );
    await t.test(
      "web source requires configured website and remains separate from FLASH",
      async () => {
        const uuid = () => crypto.randomUUID();
        const record = (
          origin: string | null,
          kind = "page_view",
          target: string | null = null,
          slug = "empresa-a",
          id = uuid(),
        ) =>
          db.query("select public.record_web_interaction($1,$2,$3,$4,$5,$6)", [
            slug,
            id,
            session,
            kind,
            target,
            origin,
          ]);
        await role("anon");
        for (const origin of [
          null,
          "https://attacker.example",
          "http://example.com",
          "https://example.com.evil",
          "https://example.com/path",
        ])
          await assert.rejects(record(origin), /Invalid origin/);
        await assert.rejects(
          record("https://example.com", "button_click", "orientame"),
          /Invalid event/,
        );
        await assert.rejects(
          record("https://example.com", "agenda_click", "whatsapp"),
          /Invalid event/,
        );
        await assert.rejects(
          record("https://private.example.com", "page_view", null, "empresa-b"),
          /Unavailable/,
        );
        const id = uuid();
        await record("https://example.com", "page_view", null, "empresa-a", id);
        await record("https://example.com", "page_view", null, "empresa-a", id);
        await record("https://www.example.com", "agenda_click", "agenda");
        await role("authenticated", ua);
        const counts = await db.query<{ source: string; n: number }>(
          "select source,count(*)::int as n from public.interaction_events group by source order by source",
        );
        assert.deepEqual(counts.rows, [
          { source: "flash", n: 10 },
          { source: "web", n: 2 },
        ]);
        await role("authenticated", ub);
        assert.equal(
          (await db.query("select * from public.interaction_events")).rows
            .length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
