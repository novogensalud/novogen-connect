import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  parseSourceFile,
  sourceBundleSchema,
  sourceTemplate,
} from "../lib/orientame-sources";
test("portable sources validate files, duplicate keys and HTTPS references without fetching links", () => {
  assert.equal(
    parseSourceFile(JSON.stringify(sourceTemplate), "fuentes.json").sources
      .length,
    1,
  );
  const doc = parseSourceFile(
    "Información comercial validada.",
    "Orientación.md",
  );
  assert.equal(doc.sources[0].key, "orientacion");
  assert.equal(doc.sources[0].type, "text");
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://u:p@example.com",
  ])
    assert.equal(
      sourceBundleSchema.safeParse({
        version: 1,
        sources: [{ key: "link", title: "Enlace", type: "url", url }],
      }).success,
      false,
    );
  assert.equal(
    sourceBundleSchema.safeParse({
      version: 1,
      sources: [
        {
          key: "link",
          title: "Enlace",
          type: "url",
          url: "https://example.com?x=1",
        },
      ],
    }).success,
    true,
  );
  assert.throws(
    () => parseSourceFile("a".repeat(2 * 1024 * 1024 + 1), "largo.txt"),
    /2 MB/,
  );
  assert.throws(
    () => parseSourceFile("%PDF", "fuente.pdf"),
    /JSON, TXT o Markdown/,
  );
  assert.equal(
    sourceBundleSchema.safeParse({
      version: 1,
      sources: [sourceTemplate.sources[0], sourceTemplate.sources[0]],
    }).success,
    false,
  );
});
test("source imports are atomic, tenant isolated, reviewable and exportable without publishing", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    for (const name of [
      "202610270001_connect_core.sql",
      "202610290007_orientame_sources.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    const org = "a0000000-0000-4000-8000-000000000001",
      other = "b0000000-0000-4000-8000-000000000001",
      admin = "a0000000-0000-4000-8000-000000000002",
      agent = "a0000000-0000-4000-8000-000000000003",
      foreign = "b0000000-0000-4000-8000-000000000002";
    await db.exec(
      `insert into auth.users values('${admin}'),('${agent}'),('${foreign}');insert into public.organizations(id,name,slug)values('${org}','Org A','org-a'),('${other}','Org B','org-b');insert into public.memberships values('${org}','${admin}','admin'),('${org}','${agent}','agent'),('${other}','${foreign}','admin');`,
    );
    const role = async (id: string, r = "authenticated") =>
      db.exec(`reset role;set request.jwt.claim.sub='${id}';set role ${r}`);
    const load = (rows: unknown[], o = org) =>
      db.query("select public.import_orientame_sources($1,$2::jsonb)", [
        o,
        JSON.stringify(rows),
      ]);
    await role(admin);
    await load([
      {
        key: "doc",
        title: "Documento",
        type: "text",
        content: "Contenido comercial validado.",
        status: "approved",
      },
      {
        key: "link",
        title: "Agenda oficial",
        type: "url",
        url: "https://example.com?x=1",
      },
    ]);
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from public.orientame_sources where key=$1",
          ["doc"],
        )
      ).rows[0].status,
      "draft",
    );
    await db.query("select public.review_orientame_source($1,$2,$3)", [
      org,
      "doc",
      "approved",
    ]);
    await assert.rejects(
      load([
        {
          key: "doc",
          title: "Cambio",
          type: "text",
          content: "Otro contenido",
        },
        { key: "bad", title: "Inválido", type: "text", content: "x" },
      ]),
    );
    assert.equal(
      (
        await db.query<{ title: string }>(
          "select title from public.orientame_sources where key=$1",
          ["doc"],
        )
      ).rows[0].title,
      "Documento",
    );
    const exported = await db.query(
      "select key,title,type,url,content,status from public.orientame_sources order by key",
    );
    const bundle = parseSourceFile(
      JSON.stringify({ version: 1, sources: exported.rows }),
      "respaldo.json",
    );
    await load(bundle.sources);
    assert.equal(
      (await db.query("select * from public.orientame_sources")).rows.length,
      2,
    );
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from public.orientame_sources where key=$1",
          ["doc"],
        )
      ).rows[0].status,
      "draft",
    );
    await assert.rejects(
      load([bundle.sources[0], bundle.sources[0]]),
      /Duplicate/,
    );
    await assert.rejects(
      load(
        [
          {
            key: "foreign",
            title: "Ajena",
            type: "text",
            content: "Referencia",
          },
        ],
        other,
      ),
      /Forbidden/,
    );
    await role(agent);
    assert.equal(
      (await db.query("select * from public.orientame_sources")).rows.length,
      0,
    );
    await assert.rejects(load(bundle.sources), /Forbidden/);
    await role(foreign);
    assert.equal(
      (await db.query("select * from public.orientame_sources")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.review_orientame_source($1,$2,$3)", [
        org,
        "doc",
        "approved",
      ]),
      /Forbidden/,
    );
    await role("", "anon");
    await assert.rejects(
      db.query("select * from public.orientame_sources"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
