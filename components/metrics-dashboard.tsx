"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Globe2,
  MousePointer2,
  RefreshCw,
  ScanLine,
  UsersRound,
} from "lucide-react";
import {
  chileDay,
  filterMetrics,
  summarizeMetrics,
  type MetricEvent,
  type MetricSource,
} from "@/lib/analytics";
import { targetLabels } from "@/lib/automation";
import type { Service } from "@/lib/domain";
export function MetricsDashboard({
  events,
  services,
  sourceReady,
  detailedMetrics,
  loadedAt,
  truncated,
  demo,
  slug,
}: {
  events: MetricEvent[];
  services: Service[];
  sourceReady: boolean;
  detailedMetrics: boolean;
  loadedAt: string;
  truncated: boolean;
  demo: boolean;
  slug: string;
}) {
  const [source, setSource] = useState<MetricSource>("all");
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [auto, setAuto] = useState(true);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        startTransition(() => router.refresh());
    }, 60000);
    return () => clearInterval(timer);
  }, [auto, router]);
  const now = Date.parse(loadedAt);
  const filtered = useMemo(
    () => filterMetrics(events, source, days, now),
    [events, source, days, now],
  );
  const totals = summarizeMetrics(filtered);
  const rows = [
    { key: "flash" as const, label: "CONNECT FLASH", icon: ScanLine },
    { key: "web" as const, label: "Sitio web", icon: Globe2 },
  ].map((s) => ({
    ...s,
    ...summarizeMetrics(filterMetrics(events, s.key, days, now)),
  }));
  const dayKeys = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${chileDay(loadedAt)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days + i + 1);
    return d.toISOString().slice(0, 10);
  });
  const dailyCounts = new Map<string, { flash: number; web: number }>();
  for (const event of filtered) {
    const day = chileDay(event.created_at),
      count = dailyCounts.get(day) ?? { flash: 0, web: 0 };
    count[event.source ?? "flash"]++;
    dailyCounts.set(day, count);
  }
  const activity = dayKeys.map((day) => ({
    day,
    ...(dailyCounts.get(day) ?? { flash: 0, web: 0 }),
  }));
  const max = Math.max(1, ...activity.flatMap((d) => [d.flash, d.web]));
  const targets = Object.entries(targetLabels)
    .map(([key, label]) => ({
      key,
      label,
      count: filtered.filter((e) => e.target === key).length,
    }))
    .sort((a, b) => b.count - a.count);
  const maxTarget = Math.max(1, ...targets.map((t) => t.count));
  return (
    <section className="metrics-dashboard" aria-label="Dashboard de métricas">
      <header className="metrics-header">
        <div>
          <span className="metrics-eyebrow">
            <Activity size={14} /> CONNECT ANALYTICS
          </span>
          <h2>Dos canales. Una visión clara.</h2>
          <p>
            Descubre dónde comienza cada interacción y qué despierta interés.
          </p>
        </div>
        <button
          className="metrics-refresh"
          onClick={() => startTransition(() => router.refresh())}
          disabled={pending}
        >
          <RefreshCw size={16} className={pending ? "spin" : ""} />
          {pending ? "Actualizando…" : "Actualizar"}
        </button>
      </header>
      <div className="metrics-toolbar">
        <div
          className="metrics-tabs"
          role="group"
          aria-label="Origen de métricas"
        >
          {(
            [
              { key: "all", label: "Todos los canales" },
              { key: "flash", label: "CONNECT FLASH" },
              { key: "web", label: "Sitio web" },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              aria-pressed={source === s.key}
              onClick={() => setSource(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="metrics-period">
          <CalendarDays size={15} />
          <span>Período</span>
          <select
            aria-label="Período de métricas"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
          </select>
        </label>
      </div>
      <div className="metrics-status">
        <span>
          <i className={auto ? "status-dot" : "status-dot paused"} />
          {auto ? "Actualización cada minuto" : "Actualización pausada"} ·{" "}
          {new Date(loadedAt).toLocaleTimeString("es-CL", {
            timeZone: "America/Santiago",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          Chile
        </span>
        <label>
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />{" "}
          Automática
        </label>
      </div>
      {demo && (
        <p className="notice">
          Demostración de interfaz. No se muestran interacciones ficticias.
        </p>
      )}
      {!sourceReady && (
        <p className="notice">
          FLASH está identificado por su colector original. Ejecuta la{" "}
          <a
            href="https://github.com/novogensalud/novogen-connect/blob/feature/connect-crm/supabase/migrations/202610280005_metrics_sources.sql"
            target="_blank"
            rel="noopener noreferrer"
          >
            migración 005
          </a>{" "}
          para habilitar el origen web independiente.
        </p>
      )}
      {!detailedMetrics && (
        <p className="notice">
          La migración 004 habilita el detalle de botones y servicios.
        </p>
      )}
      {truncated && (
        <p className="notice">
          Vista parcial: se muestran las 1.000 interacciones más recientes de
          los últimos 30 días. Los filtros y totales se aplican a esa muestra.
        </p>
      )}
      <div className="metrics-kpis">
        {[
          {
            label: "Visitas",
            value: totals.visits,
            icon: Globe2,
            note: "Cargas de página consentidas",
          },
          {
            label: "Sesiones",
            value: totals.sessions,
            icon: UsersRound,
            note: "Sesiones de navegador por canal",
          },
          {
            label: "Interacciones de clic",
            value: totals.clicks,
            icon: MousePointer2,
            note: "Botones, enlaces y fichas",
          },
          {
            label: "Accesos a agenda",
            value: totals.agenda,
            icon: CalendarDays,
            note: "Clics · no reservas confirmadas",
          },
        ].map((k) => (
          <article key={k.label}>
            <div>
              <span>{k.label}</span>
              <k.icon size={18} />
            </div>
            <strong>{k.value.toLocaleString("es-CL")}</strong>
            <small>{k.note}</small>
          </article>
        ))}
      </div>
      <div className="metrics-main-grid">
        <article className="metrics-card activity-card">
          <div className="metrics-card-title">
            <div>
              <h3>Actividad por día</h3>
              <p>Visitas y clics · horario de Chile</p>
            </div>
            <div className="metrics-legend">
              <span>
                <i /> FLASH
              </span>
              <span>
                <i /> Web
              </span>
            </div>
          </div>
          <div
            className="metrics-chart"
            role="img"
            aria-label={`Actividad diaria: ${filtered.length} eventos en ${days} días`}
          >
            {activity.map((d, i) => (
              <div className="metrics-day" key={d.day}>
                <div className="metrics-bars">
                  <span
                    title={`${d.day} · FLASH: ${d.flash}`}
                    style={{ height: `${(d.flash / max) * 100}%` }}
                  />
                  <span
                    title={`${d.day} · Web: ${d.web}`}
                    style={{ height: `${(d.web / max) * 100}%` }}
                  />
                </div>
                <small>
                  {days <= 14 || i % 5 === 0 || i === days - 1
                    ? d.day.slice(8)
                    : ""}
                </small>
              </div>
            ))}
            {!filtered.length && (
              <div className="metrics-chart-empty">
                <Activity size={23} />
                <strong>Aún no hay actividad en este período</strong>
                <span>
                  Las interacciones aparecerán al recibir eventos consentidos.
                </span>
              </div>
            )}
          </div>
          <details className="metrics-chart-data">
            <summary>Ver datos diarios</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha Chile</th>
                    <th>FLASH</th>
                    <th>Web</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td>{d.flash}</td>
                      <td>{d.web}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
        <article className="metrics-card">
          <div className="metrics-card-title">
            <div>
              <h3>Origen de la actividad</h3>
              <p>Comparación del período · ambos canales</p>
            </div>
            <ArrowUpRight size={19} />
          </div>
          <div className="metrics-source-list">
            {rows.map((row) => (
              <button
                className={`metrics-source ${row.key}`}
                key={row.key}
                onClick={() => setSource(row.key)}
                aria-label={`Ver métricas de ${row.label}`}
              >
                <span className="metrics-source-icon">
                  <row.icon size={21} />
                </span>
                <div>
                  <strong>{row.label}</strong>
                  <small>
                    {row.key === "web" &&
                    !events.some((e) => e.source === "web")
                      ? "Sin eventos web recibidos en 30 días"
                      : `${row.visits} visitas · ${row.clicks} clics`}
                  </small>
                </div>
                <b>{row.visits + row.clicks}</b>
              </button>
            ))}
          </div>
          <p className="metrics-explainer">
            Un clic de FLASH hacia la página institucional pertenece a FLASH. La
            visita en WordPress se registra aparte, cuando su seguimiento está
            instalado y autorizado.
          </p>
        </article>
      </div>
      <div className="metrics-detail-grid">
        <article className="metrics-card">
          <div className="metrics-card-title">
            <div>
              <h3>Botones y destinos</h3>
              <p>
                {source === "all"
                  ? "Todos los canales"
                  : source === "flash"
                    ? "CONNECT FLASH"
                    : "Sitio web"}{" "}
                · {days} días
              </p>
            </div>
            <MousePointer2 size={18} />
          </div>
          <div className="metrics-targets">
            {targets.map((t) => (
              <div className="metrics-target" key={t.key}>
                <div>
                  <span>{t.label}</span>
                  <b>{t.count}</b>
                </div>
                <div className="metrics-track">
                  <span style={{ width: `${(t.count / maxTarget) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="metrics-card">
          <div className="metrics-card-title">
            <div>
              <h3>Interés por servicio</h3>
              <p>Fichas y acciones desde CONNECT FLASH</p>
            </div>
          </div>
          <label className="metrics-search">
            Buscar servicio
            <input
              placeholder="RECOVERY, GLOW…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {source === "web" ? (
            <p className="empty-state">
              La web mide visitas y accesos a canales. Las fichas de servicios
              corresponden a FLASH.
            </p>
          ) : (
            <div className="table-scroll metrics-service-table">
              <table>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Ficha</th>
                    <th>Orientación</th>
                    <th>Agenda</th>
                  </tr>
                </thead>
                <tbody>
                  {services
                    .filter((s) =>
                      s.name
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase()),
                    )
                    .map((s) => {
                      const ev = filtered.filter(
                        (e) =>
                          e.service_id === s.id &&
                          (e.source ?? "flash") === "flash",
                      );
                      return (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>
                            {ev.filter((e) => e.kind === "service_view").length}
                          </td>
                          <td>
                            {
                              ev.filter((e) => e.target === "service_contact")
                                .length
                            }
                          </td>
                          <td>
                            {ev.filter((e) => e.kind === "agenda_click").length}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
      <details className="metrics-integration metrics-card">
        <summary>
          <Globe2 size={18} /> Conectar el seguimiento de WordPress
        </summary>
        <p>
          Instala el script en el sitio institucional y vincula el
          consentimiento de tu gestor de cookies. No registra nada hasta recibir
          autorización explícita.
        </p>
        <code>{`<script defer src="https://novogen-connect-pruebas-novogen1.vercel.app/web-tracker.js" data-slug="${slug}"></script>`}</code>
        <p>
          Al aceptar métricas:{" "}
          <code>window.CONNECTMetrics?.setConsent(true)</code>. Al revocarlas:{" "}
          <code>window.CONNECTMetrics?.setConsent(false)</code>. El script debe
          haber cargado antes de comunicar el consentimiento.
        </p>
        <p>
          Marca el botón de reserva con{" "}
          <code>data-connect-target="agenda"</code>. WhatsApp, Instagram, TikTok
          y correo se reconocen por el enlace. El dominio autorizado se toma de
          Catálogo → Canales → Sitio web.
        </p>
        <p className="fine-print">
          La versión de pruebas está protegida por Vercel. La medición externa
          requiere un despliegue público aprobado; no desactives la protección
          del CRM para instalar este script.
        </p>
      </details>
      <p className="metrics-footnote">
        Medición propia de CONNECT, con consentimiento. Sesiones no equivalen a
        personas únicas. WhatsApp, correo y agenda cuentan clics, no
        conversaciones, entregas ni reservas confirmadas.
      </p>
    </section>
  );
}
