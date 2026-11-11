import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { interactionSchema } from "../lib/automation";

test("catalogue hierarchy keeps preferences distinct from concrete services in PostgreSQL", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    for (const file of (
      await readdir(new URL("../supabase/migrations/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const org = (
      await db.query<{ id: string }>(
        "select id from public.organizations where slug='novogen'",
      )
    ).rows[0].id;
    const rows = (
      await db.query<{
        id: string;
        name: string;
        parent_id: string | null;
        catalog_type: string;
      }>(
        "select id,name,parent_id,catalog_type from public.services where organization_id=$1",
        [org],
      )
    ).rows;
    const named = (n: string) => rows.find((r) => r.name === n)!;
    await db.query(
      "update public.organizations set published=true where id=$1",
      [org],
    );
    const session = "a0000000-0000-4000-8000-000000000001";
    let seq = 10;
    const id = () =>
      `a0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
    await t.test(
      "backfill gives RECOVERY and GLOW to OPTIMIZA; SUPLE stays a service",
      async () => {
        assert.equal(named("RECOVERY").catalog_type, "group");
        assert.equal(named("RECOVERY").parent_id, named("OPTIMIZA").id);
        assert.equal(named("GLOW").parent_id, named("OPTIMIZA").id);
        assert.equal(
          named("RECOVERY · Essential").parent_id,
          named("RECOVERY").id,
        );
        assert.equal(named("SUPLE").catalog_type, "service");
        assert.equal(named("SUPLE").parent_id, named("OPTIMIZA").id);
        assert.equal(named("COMPRENDE").catalog_type, "service");
        assert.equal(named("CHECK").parent_id, named("Evaluación").id);
        const store = await db.query<{ action_url: string }>(
          "select action_url from public.services where id=$1",
          [named("SUPLE").id],
        );
        assert.equal(store.rows[0].action_url, "https://www.novogenstore.cl/");
      },
    );
    await t.test(
      "cycles, individual parents and cross-organization parents are rejected",
      async () => {
        await assert.rejects(
          db.query("update public.services set parent_id=$1 where id=$2", [
            named("RECOVERY").id,
            named("OPTIMIZA").id,
          ]),
          /Catalogue cycle/,
        );
        await assert.rejects(
          db.query("update public.services set parent_id=$1 where id=$2", [
            named("SUPLE").id,
            named("COMPRENDE").id,
          ]),
          /Parent must be a group/,
        );
        await assert.rejects(
          db.query(
            "update public.services set catalog_type='service' where id=$1",
            [named("RECOVERY").id],
          ),
          /group with children/,
        );
        const other = (
          await db.query<{ id: string }>(
            "insert into public.organizations(name,slug)values('Other','other')returning id",
          )
        ).rows[0].id;
        await assert.rejects(
          db.query(
            "insert into public.services(organization_id,name,category,description,parent_id)values($1,'Invalid','CHECK','Description',$2)",
            [other, named("OPTIMIZA").id],
          ),
          /Parent must be a group/,
        );
      },
    );
    await t.test(
      "anonymous metrics and lead capture cannot treat a group as a service",
      async () => {
        await db.exec("set role anon");
        const record = (
          kind: string,
          target: string,
          service: string | null,
          preference: string | null,
        ) =>
          db.query(
            "select public.record_interaction($1,$2,$3,$4,$5,$6,$7,$8)",
            ["novogen", id(), session, kind, service, null, target, preference],
          );
        await record(
          "preference_view",
          "preference_info",
          null,
          named("RECOVERY").id,
        );
        await assert.rejects(
          record("service_view", "service_info", named("RECOVERY").id, null),
          /Invalid service/,
        );
        await assert.rejects(
          record("preference_view", "preference_info", null, named("CHECK").id),
          /Invalid preference/,
        );
        await record(
          "service_view",
          "service_info",
          named("RECOVERY · Essential").id,
          null,
        );
        await assert.rejects(
          db.query("select public.capture_lead($1,$2,$3,$4,$5,$6,$7)", [
            "novogen",
            "Example",
            "example@example.com",
            "",
            named("RECOVERY").id,
            null,
            true,
          ]),
          /individual service/,
        );
        await db.exec("reset role");
        const metrics = await db.query<{
          kind: string;
          service_id: string | null;
          preference_id: string | null;
        }>(
          "select kind,service_id,preference_id from public.interaction_events",
        );
        assert.deepEqual(
          metrics.rows.map((m) => [m.kind, !!m.service_id, !!m.preference_id]),
          [
            ["preference_view", false, true],
            ["service_view", true, false],
          ],
        );
        await db.query("update public.services set active=false where id=$1", [
          named("OPTIMIZA").id,
        ]);
        await db.exec("set role anon");
        await assert.rejects(
          record(
            "service_view",
            "service_info",
            named("RECOVERY · Essential").id,
            null,
          ),
          /Invalid service/,
        );
        await db.exec("reset role");
      },
    );
    await t.test(
      "YouTube has its own validated channel and event",
      async () => {
        await db.exec("set role anon");
        await db.query(
          "select public.record_interaction($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            "novogen",
            id(),
            session,
            "youtube_click",
            null,
            null,
            "youtube",
            null,
          ],
        );
        await assert.rejects(
          db.query(
            "select public.record_interaction($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              "novogen",
              id(),
              session,
              "youtube_click",
              null,
              null,
              "instagram",
              null,
            ],
          ),
          /Invalid target/,
        );
        await db.exec("reset role");
        assert.equal(
          (
            await db.query(
              "select * from public.interaction_events where kind='youtube_click'",
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query<{ youtube_url: string }>(
              "select youtube_url from public.public_channels where organization_id=$1",
              [org],
            )
          ).rows[0].youtube_url,
          "https://www.youtube.com/@novogensalud",
        );
      },
    );
    await t.test("AI access quotas and human handoff require an unguessable contact receipt", async()=>{
      const receipt='c'.repeat(64),consent=id(),request=id();
      await db.exec('reset role');
      const staff=id();await db.query('insert into auth.users(id) values($1)',[staff]);await db.query("insert into public.memberships values($1,$2,'admin')",[org,staff]);
      await db.exec('set role anon');
      await db.query('select public.record_app_consent($1,$2,$3)',['novogen',consent,'review-v1']);
      await assert.rejects(db.query('select * from public.app_consents'),/permission denied/);
      await assert.rejects(db.query('select * from public.ai_request_usage'),/permission denied/);
      const consume=async(token:string,requestId=id())=>(await db.query<{allowed:boolean}>('select public.consume_ai_request($1,$2,$3,$4) as allowed',['novogen',token,consent,requestId])).rows[0].allowed;
      assert.equal(await consume(receipt),false);
      await db.query('select public.capture_connect_request($1,$2,$3,$4,$5,$6,$7,$8,$9)',['novogen','Prueba IA','ia-quota@example.com','',named('CHECK').id,null,true,'information',receipt]);
      assert.equal(await consume(receipt,request),true);assert.equal(await consume(receipt,request),false);
      for(let i=1;i<30;i++)assert.equal(await consume(receipt),true);
      assert.equal(await consume(receipt),false);
      const handoff=async(service:string|null,kind='commercial')=>(await db.query<{ok:boolean}>('select public.request_contact_handoff($1,$2,$3,$4) as ok',['novogen',receipt,service,kind])).rows[0].ok;
      assert.equal(await handoff(named('OPTIMIZA').id),false);
      assert.equal(await handoff(named('COMPRENDE').id),true);
      assert.equal(await handoff(named('COMPRENDE').id),true);
      await db.exec('reset role');
      assert.equal((await db.query('select * from public.commercial_notifications where kind=$1',['human_handoff'])).rows.length,1);
      assert.equal((await db.query<{human_required:boolean}>('select human_required from public.followup_tasks t join public.opportunities o on t.opportunity_id=o.id join public.leads l on l.id=o.lead_id where l.email=$1',['ia-quota@example.com'])).rows[0].human_required,true);
    });
  } finally {
    await db.close();
  }
});
test("metric schema separates preferences from service demand", () => {
  const base = {
    slug: "novogen",
    id: "a0000000-0000-4000-8000-000000000001",
    session: "a0000000-0000-4000-8000-000000000002",
    kind: "preference_view",
    target: "preference_info",
    preference: "a0000000-0000-4000-8000-000000000003",
    consent: true,
  };
  assert.equal(interactionSchema.safeParse(base).success, true);
  assert.equal(
    interactionSchema.safeParse({ ...base, service: base.preference }).success,
    false,
  );
  assert.equal(
    interactionSchema.safeParse({ ...base, preference: null }).success,
    false,
  );
});


