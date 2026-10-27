import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { interactionSchema } from "../lib/automation";

test("metrics payload excludes personal data and requires opt-in", () => {
  const payload = {
    slug: "novogen",
    id: "a0000000-0000-4000-8000-000000000001",
    session: "a0000000-0000-4000-8000-000000000002",
    kind: "page_view",
    consent: true,
  };
  assert.equal(interactionSchema.safeParse(payload).success, true);
  for (const patch of [
    { email: "private@example.com" },
    { consent: false },
    { kind: "sale_validated" },
    { url: "https://example.com/?email=private" },
  ])
    assert.equal(
      interactionSchema.safeParse({ ...payload, ...patch }).success,
      false,
    );
});
test("automation, human handoff, private receipts and web metrics", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    for (const name of [
      "202610270001_connect_core.sql",
      "202610270002_manual_contacts.sql",
      "202610270003_followup_and_interactions.sql",
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
      ua2 = "a0000000-0000-4000-8000-000000000003",
      serviceB = "b0000000-0000-4000-8000-000000000003",
      receipt = "c".repeat(64);
    await db.exec(
      `insert into auth.users values('${ua}'),('${ub}'),('${ua2}');insert into public.organizations(id,name,slug,published)values('${a}','Empresa A','empresa-a',true),('${b}','Empresa B','empresa-b',true);insert into public.memberships values('${a}','${ua}','admin'),('${a}','${ua2}','agent'),('${b}','${ub}','admin');insert into public.services(id,organization_id,name,category,description)values('${serviceB}','${b}','Servicio B','CHECK','Información comercial');`,
    );
    const role = async (r: string, u = "") =>
      db.exec(`reset role;set request.jwt.claim.sub='${u}';set role ${r};`);
    await t.test(
      "independent follow-up service and OPTIMIZA subcategories",
      async () => {
        const result = await db.query<{
          category: string;
          subcategory: string | null;
        }>(
          "select category,subcategory from public.services where name='SEGUIMIENTO'",
        );
        assert.deepEqual(result.rows, [
          { category: "SEGUIMIENTO", subcategory: null },
        ]);
        await assert.rejects(
          db.query(
            "insert into public.services(organization_id,name,category,subcategory,description)values($1,'Invalid','SEGUIMIENTO','SUPLE','Descripción comercial')",
            [a],
          ),
          /services_subcategory_parent/,
        );
      },
    );
    await role("anon");
    await t.test(
      "a human request creates task and notifications atomically",
      async () => {
        await db.query(
          "select public.capture_connect_request($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            "empresa-a",
            "Contacto",
            "a@example.com",
            "",
            null,
            null,
            true,
            "human",
            receipt,
          ],
        );
        await assert.rejects(
          db.query("select * from public.followup_tasks"),
          /permission denied/,
        );
        await role("authenticated", ua);
        const task = await db.query<{ human_required: boolean; state: string }>(
          "select human_required,state from public.followup_tasks",
        );
        assert.deepEqual(task.rows, [
          { human_required: true, state: "pending" },
        ]);
        const n = await db.query<{ kind: string }>(
          "select kind from public.commercial_notifications order by kind",
        );
        assert.deepEqual(
          n.rows.map((x) => x.kind),
          ["human_handoff", "new_request"],
        );
        await role("authenticated", ub);
        assert.equal(
          (await db.query("select * from public.followup_tasks")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.commercial_notifications")).rows
            .length,
          0,
        );
      },
    );
    await t.test(
      "receipts expose only the holder request state and expire",
      async () => {
        await role("anon");
        const r = await db.query<{ stage: string; updated_at: string }>(
          "select * from public.get_contact_status($1,$2)",
          ["empresa-a", receipt],
        );
        assert.equal(r.rows.length, 1);
        assert.deepEqual(Object.keys(r.rows[0]).sort(), [
          "stage",
          "updated_at",
        ]);
        for (const [slug, token] of [
          ["empresa-b", receipt],
          ["empresa-a", "d".repeat(64)],
        ])
          assert.equal(
            (
              await db.query("select * from public.get_contact_status($1,$2)", [
                slug,
                token,
              ])
            ).rows.length,
            0,
          );
        await assert.rejects(
          db.query("select * from public.contact_receipts"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "reminders are idempotent and closing an opportunity cancels follow-up",
      async () => {
        await role("postgres");
        await db.exec(
          "update public.followup_tasks set created_at=now()-interval '2 minutes'",
        );
        await db.exec(
          "update public.followup_tasks set due_at=now()-interval '61 minutes',red_at=now()-interval '1 minute'",
        );
        await db.query(
          "insert into public.commercial_notifications(organization_id,recipient_id,task_id,kind,cycle) select organization_id,$1,id,'reminder',0 from public.followup_tasks",
          [ua],
        );
        await role("authenticated", ua);
        await db.query("select public.sync_reminders($1)", [a]);
        await db.query("select public.sync_reminders($1)", [a]);
        const n = await db.query(
          "select * from public.commercial_notifications where kind='reminder'",
        );
        assert.equal(n.rows.length, 2);
        assert.equal(
          (
            await db.query<{ red: boolean }>(
              "select red_at<=now() as red from public.followup_tasks",
            )
          ).rows[0].red,
          true,
        );
        await assert.rejects(
          db.query("select public.sync_reminders($1)", [b]),
          /Forbidden/,
        );
        await db.exec("update public.opportunities set stage='contacted'");
        const later = await db.query<{ later: boolean }>(
          "select due_at>now()+interval '59 minutes' as later from public.followup_tasks",
        );
        assert.equal(later.rows[0].later, true);
        await db.exec("update public.opportunities set stage='closed_lost'");
        assert.equal(
          (
            await db.query<{ state: string }>(
              "select state from public.followup_tasks",
            )
          ).rows[0].state,
          "cancelled",
        );
      },
    );
    await t.test(
      "event ingestion cannot reference another tenant and is idempotent",
      async () => {
        await role("anon");
        const id = "d0000000-0000-4000-8000-000000000001",
          session = "d0000000-0000-4000-8000-000000000002";
        const record = (service: string | null, kind = "service_view") =>
          db.query("select public.record_interaction($1,$2,$3,$4,$5,$6)", [
            "empresa-a",
            id,
            session,
            kind,
            service,
            null,
          ]);
        await assert.rejects(record(serviceB), /Invalid service/);
        await assert.rejects(
          record(null, "sale_validated"),
          /interaction_events_kind_check/,
        );
        await record(null);
        await record(null);
        await assert.rejects(
          db.query("select * from public.interaction_events"),
          /permission denied/,
        );
        await role("authenticated", ua);
        assert.equal(
          (await db.query("select * from public.interaction_events")).rows
            .length,
          1,
        );
        await role("authenticated", ub);
        assert.equal(
          (await db.query("select * from public.interaction_events")).rows
            .length,
          0,
        );
      },
    );
    await t.test(
      "operators can read only their own notifications",
      async () => {
        await role("postgres");
        const other = await db.query<{ id: string }>(
          "select id from public.commercial_notifications where recipient_id=$1 limit 1",
          [ua2],
        );
        await role("authenticated", ua);
        const update = await db.query(
          "update public.commercial_notifications set read_at=now() where id=$1 returning id",
          [other.rows[0].id],
        );
        assert.equal(update.rows.length, 0);
      },
    );
  } finally {
    await db.close();
  }
});
