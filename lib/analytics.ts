const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export type MetricEvent = {
  kind: string;
  target?: string | null;
  service_id?: string | null;
  source?: "flash" | "web";
  created_at: string;
  session_id?: string;
};
export type MetricSource = "all" | "flash" | "web";
export function filterMetrics(
  events: MetricEvent[],
  source: MetricSource,
  days: number,
  now: number,
) {
  const start = new Date(now);
  // Calendar boundaries use the same Chilean dates shown in the chart.
  const lastDay = dayFormatter.format(start);
  const first = new Date(`${lastDay}T12:00:00Z`);
  first.setUTCDate(first.getUTCDate() - days + 1);
  const firstDay = first.toISOString().slice(0, 10);
  return events.filter((e) => {
    const day = chileDay(e.created_at);
    return (
      day >= firstDay &&
      day <= lastDay &&
      (source === "all" || (e.source ?? "flash") === source)
    );
  });
}
export function chileDay(date: string) {
  return dayFormatter.format(new Date(date));
}
export function summarizeMetrics(events: MetricEvent[]) {
  return {
    visits: events.filter((e) => e.kind === "page_view").length,
    sessions: new Set(
      events
        .filter((e) => e.session_id)
        .map((e) => `${e.source ?? "flash"}:${e.session_id}`),
    ).size,
    clicks: events.filter(
      (e) => e.kind.endsWith("_click") || e.kind === "service_view",
    ).length,
    agenda: events.filter((e) => e.kind === "agenda_click").length,
  };
}
export function allowedWebOrigin(origin: string, website: string) {
  try {
    const a = new URL(origin),
      b = new URL(website);
    return (
      a.protocol === "https:" &&
      b.protocol === "https:" &&
      !a.username &&
      !a.password &&
      a.origin === origin &&
      a.port === b.port &&
      a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "")
    );
  } catch {
    return false;
  }
}
