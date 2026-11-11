import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration and tenant isolation with PostgreSQL RLS", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610270001_connect_core.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610270002_manual_contacts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const orgA = "a0000000-0000-4000-8000-000000000001";
    const orgB = "b0000000-0000-4000-8000-000000000001";
    const userA = "a0000000-0000-4000-8000-000000000002";
    const userB = "b0000000-0000-4000-8000-000000000002";
    const serviceB = "b0000000-0000-4000-8000-000000000003";
    const pointB = "b0000000-0000-4000-8000-000000000004";
    const codeA = "a".repeat(32);
    const codeB = "b".repeat(32);
    await db.exec(`insert into auth.users values('${userA}'),('${userB}');
 insert into public.organizations(id,name,slug,published) values('${orgA}','Empresa A','empresa-a',true),('${orgB}','Empresa B','empresa-b',false);
 insert into public.memberships values('${orgA}','${userA}','admin'),('${orgB}','${userB}','agent');
 insert into public.services(id,organization_id,name,category,description) values('${serviceB}','${orgB}','Servicio B','CHECK','Descripción comercial B');
 insert into public.connect_points(organization_id,name,code) values('${orgA}','Recepción A','${codeA}');
 insert into public.connect_points(id,organization_id,name,code) values('${pointB}','${orgB}','Recepción B','${codeB}');`);
    const asRole = async (role: string, uid = "") => {
      await db.exec(
        `reset role; set request.jwt.claim.sub='${uid}'; set role ${role};`,
      );
    };
    const count = async (table: string) =>
      Number(
        (
          await db.query<{ n: number }>(
            `select count(*) as n from public.${table}`,
          )
        ).rows[0].n,
      );
    await t.test(
      "anonymous visitors cannot read contacts, points or private organizations",
      async () => {
        await asRole("anon");
        assert.equal(await count("organizations"), 1);
        await assert.rejects(
          db.query("select * from public.leads"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select * from public.connect_points"),
          /permission denied/,
        );
        assert.equal(
          (
            await db.query<{ slug: string | null }>(
              "select public.resolve_point($1) as slug",
              [codeB],
            )
          ).rows[0].slug,
          null,
        );
      },
    );
    await t.test(
      "public submission requires consent and rejects another tenant service",
      async () => {
        await assert.rejects(
          db.query("select public.capture_lead($1,$2,$3,$4,$5,$6,$7)", [
            "empresa-a",
            "Persona",
            "one@example.com",
            "",
            null,
            null,
            false,
          ]),
          /Consent required/,
        );
        await assert.rejects(
          db.query("select public.capture_lead($1,$2,$3,$4,$5,$6,$7)", [
            "empresa-a",
            "Persona",
            "one@example.com",
            "",
            serviceB,
            null,
            true,
          ]),
          /Invalid service/,
        );
      },
    );
    await t.test(
      "point resolution and capture create distinct events and one opportunity",
      async () => {
        const result = await db.query<{ slug: string }>(
          "select public.resolve_point($1) as slug",
          [codeA],
        );
        assert.equal(result.rows[0].slug, "empresa-a");
        await db.query("select public.capture_lead($1,$2,$3,$4,$5,$6,$7)", [
          "empresa-a",
          "Persona",
          "one@example.com",
          "",
          null,
          codeA,
          true,
        ]);
        await assert.rejects(
          db.query("select public.capture_lead($1,$2,$3,$4,$5,$6,$7)", [
            "empresa-a",
            "Persona",
            "ONE@example.com",
            "",
            null,
            codeA,
            true,
          ]),
          /already received/,
        );
        await asRole("authenticated", userA);
        assert.equal(await count("leads"), 1);
        assert.equal(await count("opportunities"), 1);
        const events = await db.query<{ kind: string }>(
          "select kind from public.events order by kind",
        );
        assert.deepEqual(
          events.rows.map((x) => x.kind),
          ["lead_submitted", "point_access"],
        );
      },
    );
    await t.test(
      "organization members cannot read or update another organization",
      async () => {
        const result = await db.query(
          "update public.connect_points set active=false where id=$1 returning id",
          [pointB],
        );
        assert.equal(result.rows.length, 0);
        await asRole("authenticated", userB);
        assert.equal(await count("leads"), 0);
        assert.equal(await count("opportunities"), 0);
        assert.equal(await count("events"), 0);
        await assert.rejects(
          db.query("insert into public.memberships values($1,$2,'admin')", [
            orgA,
            userB,
          ]),
          /permission denied/,
        );
      },
    );
    await t.test(
      "agents cannot edit catalog; admins cannot move records between tenants",
      async () => {
        const result = await db.query(
          "update public.services set active=false where id=$1 returning id",
          [serviceB],
        );
        assert.equal(result.rows.length, 0);
        await asRole("authenticated", userA);
        await assert.rejects(
          db.query("update public.connect_points set organization_id=$1", [
            orgB,
          ]),
          /permission denied/,
        );
      },
    );
    await t.test(
      "commercial changes are audited and audit history cannot be forged",
      async () => {
        await db.exec(
          "update public.opportunities set stage='contacted',next_action='Enviar información comercial'",
        );
        const audit = await db.query<{ entity: string; operation: string }>(
          "select entity,operation from public.audit_logs where operation='UPDATE'",
        );
        assert.ok(audit.rows.some((x) => x.entity === "opportunities"));
        await assert.rejects(
          db.exec("delete from public.audit_logs"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "manual CRM capture is scoped to members and creates an audited opportunity",
      async () => {
        await asRole("anon");
        await assert.rejects(
          db.query(
            "select public.create_commercial_contact($1,$2,$3,$4,$5,$6)",
            [orgA, "Manual", "manual@example.com", "", null, true],
          ),
          /permission denied/,
        );
        await asRole("authenticated", userB);
        await assert.rejects(
          db.query(
            "select public.create_commercial_contact($1,$2,$3,$4,$5,$6)",
            [orgA, "Manual", "manual@example.com", "", null, true],
          ),
          /Forbidden/,
        );
        await asRole("authenticated", userA);
        await assert.rejects(
          db.query(
            "select public.create_commercial_contact($1,$2,$3,$4,$5,$6)",
            [orgA, "Manual", "manual@example.com", "", serviceB, true],
          ),
          /Invalid service/,
        );
        await assert.rejects(
          db.query(
            "select public.create_commercial_contact($1,$2,$3,$4,$5,$6)",
            [orgA, "Manual", "manual@example.com", "", null, false],
          ),
          /Consent required/,
        );
        await db.query(
          "select public.create_commercial_contact($1,$2,$3,$4,$5,$6)",
          [orgA, "Manual", "manual@example.com", "", null, true],
        );
        assert.equal(await count("leads"), 2);
        assert.equal(await count("opportunities"), 2);
        assert.equal(await count("events"), 2);
        await asRole("authenticated", userB);
        assert.equal(await count("leads"), 0);
      },
    );
  } finally {
    await db.close();
  }
});
