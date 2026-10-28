import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("five configurable seats preserve existing access, isolate admins and never provision accounts", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    for (const file of [
      "202610270001_connect_core.sql",
      "202610280006_team_seats.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const org = "a0000000-0000-4000-8000-000000000001",
      other = "b0000000-0000-4000-8000-000000000001",
      admin = "a0000000-0000-4000-8000-000000000002",
      agent = "a0000000-0000-4000-8000-000000000003",
      foreign = "b0000000-0000-4000-8000-000000000002";
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.test'),('${agent}','agent@example.test'),('${foreign}','other@example.test');insert into public.organizations(id,name,slug)values('${org}','Org A','org-a'),('${other}','Org B','org-b');insert into public.memberships values('${org}','${admin}','admin'),('${org}','${agent}','agent'),('${other}','${foreign}','admin');`,
    );
    const role = async (id: string, r = "authenticated") =>
      db.exec(`reset role;set request.jwt.claim.sub='${id}';set role ${r}`);
    await role(admin);
    await db.query("select public.ensure_team_plan($1)", [org]);
    await db.query("select public.ensure_team_plan($1)", [org]);
    const initial = await db.query<{
      seat_number: number;
      role: string;
      user_id: string | null;
    }>(
      "select seat_number,role,user_id from public.team_seats order by seat_number",
    );
    assert.equal(initial.rows.length, 5);
    assert.equal(initial.rows[0].role, "admin");
    assert.equal(initial.rows[0].user_id, admin);
    assert.equal(initial.rows.filter((r) => r.user_id).length, 2);
    const save = (
      seat: number,
      name: string,
      email: string,
      r: string,
      o = org,
    ) =>
      db.query("select public.configure_team_seat($1,$2,$3,$4,$5)", [
        o,
        seat,
        name,
        email,
        r,
      ]);
    await save(3, "Futuro comercial", "future@example.test", "agent");
    await assert.rejects(
      save(4, "Duplicado", "FUTURE@example.test", "agent"),
      /team_reserved_email/,
    );
    await assert.rejects(
      save(1, "Administrador", "admin@example.test", "agent"),
      /read only/,
    );
    await assert.rejects(
      save(2, "Cambio correo", "new@example.test", "agent"),
      /read only/,
    );
    await assert.rejects(
      save(6, "Fuera de cupos", "", "agent"),
      /Invalid seat/,
    );
    await save(4, "Admin previsto", "", "admin");
    await save(4, "Comercial previsto", "", "agent");
    await db.query("select public.expand_team_plan($1,$2)", [org, 8]);
    assert.equal(
      (await db.query("select * from public.team_seats")).rows.length,
      8,
    );
    await assert.rejects(
      db.query("select public.expand_team_plan($1,$2)", [org, 5]),
      /Invalid capacity/,
    );
    await assert.rejects(
      db.query("select public.expand_team_plan($1,$2)", [org, 101]),
      /Invalid capacity/,
    );
    await role(agent);
    assert.equal(
      (await db.query("select * from public.team_seats")).rows.length,
      0,
    );
    await assert.rejects(save(3, "Intruso", "", "admin"), /Forbidden/);
    await assert.rejects(
      db.query("select public.expand_team_plan($1,$2)", [org, 10]),
      /Forbidden/,
    );
    await role(foreign);
    assert.equal(
      (await db.query("select * from public.team_plans")).rows.length,
      0,
    );
    await assert.rejects(save(3, "Ajeno", "", "admin"), /Forbidden/);
    await role("", "anon");
    await assert.rejects(
      db.query("select * from public.team_seats"),
      /permission denied/,
    );
    await db.exec("reset role");
    assert.equal((await db.query("select * from auth.users")).rows.length, 3);
    const memberships = await db.query<{ user_id: string; role: string }>(
      "select user_id,role from public.memberships where organization_id=$1 order by user_id",
      [org],
    );
    assert.deepEqual(memberships.rows, [
      { user_id: admin, role: "admin" },
      { user_id: agent, role: "agent" },
    ]);
    assert.ok(
      (await db.query("select * from public.audit_logs")).rows.length >= 4,
    );
  } finally {
    await db.close();
  }
});
