import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedWebOrigin,
  chileDay,
  filterMetrics,
  summarizeMetrics,
  type MetricEvent,
} from "../lib/analytics";
test("FLASH outbound clicks never become web visits; channel-scoped sessions do not claim unique people", () => {
  const now = Date.parse("2026-10-28T14:00:00Z");
  const events: MetricEvent[] = [
    {
      kind: "page_view",
      session_id: "same",
      created_at: "2026-10-28T12:00:00Z",
    },
    {
      kind: "website_click",
      target: "website",
      source: "flash",
      session_id: "same",
      created_at: "2026-10-28T12:01:00Z",
    },
    {
      kind: "page_view",
      source: "web",
      session_id: "same",
      created_at: "2026-10-28T12:02:00Z",
    },
    {
      kind: "agenda_click",
      target: "agenda",
      source: "web",
      session_id: "same",
      created_at: "2026-10-28T12:03:00Z",
    },
    { kind: "page_view", source: "web", created_at: "2026-09-01T12:03:00Z" },
  ];
  assert.deepEqual(summarizeMetrics(filterMetrics(events, "flash", 7, now)), {
    visits: 1,
    sessions: 1,
    clicks: 1,
    agenda: 0,
  });
  assert.deepEqual(summarizeMetrics(filterMetrics(events, "web", 7, now)), {
    visits: 1,
    sessions: 1,
    clicks: 1,
    agenda: 1,
  });
  assert.equal(
    summarizeMetrics(filterMetrics(events, "all", 7, now)).sessions,
    2,
  );
});
test("periods include Chilean calendar days at local midnight", () => {
  assert.equal(chileDay("2026-10-28T02:59:00Z"), "2026-10-27");
  const events: MetricEvent[] = [
    "2026-10-22T02:59:59Z",
    "2026-10-22T03:00:00Z",
    "2026-10-29T03:00:00Z",
  ].map((created_at) => ({ kind: "page_view", created_at }));
  assert.equal(
    filterMetrics(events, "all", 7, Date.parse("2026-10-28T15:00:00Z")).length,
    1,
  );
});
test("web collector only accepts HTTPS configured host and its www variant", () => {
  assert.equal(
    allowedWebOrigin("https://www.novogensalud.cl", "https://novogensalud.cl/"),
    true,
  );
  for (const origin of [
    "https://novogensalud.cl.evil",
    "https://evil.cl",
    "null",
    "http://novogensalud.cl",
    "https://novogensalud.cl/path",
    "https://user@novogensalud.cl",
    "https://novogensalud.cl:444",
  ])
    assert.equal(allowedWebOrigin(origin, "https://novogensalud.cl/"), false);
});
