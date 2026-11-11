import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("verified XP and reviewed redemptions remain isolated and idempotent", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
  `);
  for (const file of ["202610270001_connect_core.sql", "202610310011_connect_loyalty.sql"])
    await db.exec(await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"));

  const org = (await db.query<{ id: string }>("select id from public.organizations where slug='novogen'")).rows[0].id;
  const other = randomUUID(), admin = randomUUID(), stranger = randomUUID();
  const subject = randomUUID(), second = randomUUID(), request = randomUUID(), reward = randomUUID();
  await db.exec(`
    insert into auth.users values ('${admin}'),('${stranger}');
    insert into public.organizations(id,name,slug) values ('${other}','Otra organización','otra');
    insert into public.memberships values ('${org}','${admin}','admin'),('${other}','${stranger}','admin');
    insert into public.connect_xp_rules values ('${org}','mission.completed',30);
    insert into public.connect_xp_levels values ('${org}',0,'Inicial'),('${org}',60,'Avance');
    insert into public.connect_rewards values ('${org}','${reward}','Recompensa sintética',100,true);
  `);
  const role = (name: string, user = "") => db.exec(`reset role; set request.jwt.claim.sub='${user}'; set role ${name};`);
  const at = (await db.query<{ at: Date }>("select now() as at")).rows[0].at;
  const award = (ref: string, who = subject, when = at) => db.query<{ record_connect_xp: number }>(
    "select public.record_connect_xp($1,'mission.completed',$2,$3,$4)", [org, ref, who, when.toISOString()]);
  const redeem = (who = subject) => db.query("select public.request_connect_redemption($1,$2,$3,$4)", [org, request, who, reward]);
  const rank = () => db.query<{ subject_id: string; quarter_xp: number; rolling_xp: number; level_label: string }>(
    "select * from public.connect_xp_ranking($1)", [org]);
  const review = (state: string) => db.query("select public.review_connect_redemption($1,$2,$3)", [org, request, state]);
  const operation = randomUUID(), delivery = randomUUID();
  const debit = (cost = 100, id = operation) => db.query(
    "select public.confirm_connect_redemption_debit($1,$2,$3,$4,$5)", [org, request, subject, cost, id]);
  const complete = (id = delivery) => db.query("select public.complete_connect_redemption($1,$2,$3)", [org, request, id]);

  await role("anon");
  await assert.rejects(award("a"), /permission denied/);
  await assert.rejects(redeem(), /permission denied/);
  await role("service_role");
  await assert.rejects(db.query("select public.record_connect_xp($1,'game.verified','guest',$2,$3)", [org, subject, at.toISOString()]), /xp_rule_not_configured/);
  assert.equal((await award("a")).rows[0].record_connect_xp, 30);
  assert.equal((await award("a")).rows[0].record_connect_xp, 30);
  await assert.rejects(award("a", second), /xp_event_conflict/);
  await award("b", second);
  await award("past-quarter", subject, new Date(at.valueOf() - 100 * 86400000));
  await award("expired", subject, new Date(at.valueOf() - 400 * 86400000));
  await redeem();
  await redeem();
  await assert.rejects(redeem(second), /redemption_conflict/);
  await assert.rejects(debit(), /redemption_not_approved/);
  await assert.rejects(complete(), /finance_debit_required/);

  await role("authenticated", stranger);
  await assert.rejects(rank(), /forbidden/);
  assert.equal((await db.query("select * from public.connect_redemptions")).rows.length, 0);
  await role("authenticated", admin);
  const ranking = (await rank()).rows;
  assert.equal(ranking.length, 2);
  assert.equal(Number(ranking.find(row => row.subject_id === subject)?.quarter_xp), 30);
  assert.equal(Number(ranking.find(row => row.subject_id === subject)?.rolling_xp), 60);
  assert.equal(ranking.find(row => row.subject_id === subject)?.level_label, "Avance");
  assert.deepEqual((await db.query("select state,cost_points from public.connect_redemptions")).rows, [{ state: "pending", cost_points: 100 }]);
  await assert.rejects(review("approved"), /forbidden/);
  await db.exec(`reset role; insert into public.connect_redemption_reviewers values ('${org}','${admin}');`);
  await role("authenticated", admin);
  await review("approved");
  await review("approved");
  await assert.rejects(review("rejected"), /redemption_already_reviewed/);
  assert.deepEqual((await db.query("select state,reviewed_by from public.connect_redemptions")).rows, [{ state: "approved", reviewed_by: admin }]);
  await assert.rejects(debit(), /permission denied/);
  await role("service_role");
  await assert.rejects(complete(), /finance_debit_required/);
  await assert.rejects(debit(99), /finance_confirmation_conflict/);
  await debit();
  await debit();
  await assert.rejects(debit(100, randomUUID()), /finance_confirmation_conflict/);
  await complete();
  await complete();
  await assert.rejects(complete(randomUUID()), /delivery_confirmation_conflict/);
  await role("authenticated", admin);
  assert.deepEqual((await db.query("select state,finance_operation_id,delivery_reference from public.connect_redemptions")).rows,
    [{ state: "completed", finance_operation_id: operation, delivery_reference: delivery }]);
});
