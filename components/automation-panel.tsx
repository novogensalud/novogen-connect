import Link from "next/link";
import { MetricsDashboard } from "./metrics-dashboard";
import type { MetricEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import {
  notificationLabels,
  type FollowupTask,
  type CommercialNotification,
} from "@/lib/automation";
import type { Lead, Service } from "@/lib/domain";
import {
  saveFollowupSettings,
  updateFollowup,
  readNotification,
} from "@/app/actions";
export async function AutomationPanel({
  org,
  role,
  demo,
  leads,
  services,
  slug,
}: {
  slug: string;
  org: string;
  role: string;
  demo: boolean;
  leads: Lead[];
  services: Service[];
}) {
  let tasks: FollowupTask[] = [];
  let notifications: CommercialNotification[] = [];
  let metrics: MetricEvent[] = [];
  let detailedMetrics = true;
  let sourceReady = true;
  let truncated = false;
  let minutes = 60;
  if (!demo) {
    const db = await supabase();
    const sync = await db.rpc("sync_reminders", { p_org: org });
    if (sync.error)
      return (
        <section className="panel form-panel">
          <h2>Activar seguimiento y métricas</h2>
          <p>
            Las funciones nuevas necesitan la migración 003 en Supabase. Tus
            contactos actuales siguen disponibles.
          </p>
          <a
            className="button primary"
            href="https://github.com/novogensalud/novogen-connect/blob/feature/connect-crm/supabase/migrations/202610270003_followup_and_interactions.sql"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir migración 003
          </a>
          <p className="fine-print">
            Si ya la ejecutaste, revisa el error de conexión o permisos. La
            automatización todavía no está disponible en este espacio.
          </p>
        </section>
      );
    const result = await Promise.all([
      db
        .from("followup_tasks")
        .select("*")
        .eq("organization_id", org)
        .order("due_at")
        .limit(100),
      db
        .from("commercial_notifications")
        .select("id,kind,created_at,read_at")
        .eq("organization_id", org)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
      (async () => {
        const query = (columns: string) =>
          db
            .from("interaction_events")
            .select(columns)
            .eq("organization_id", org)
            .gte(
              "created_at",
              new Date(Date.now() - 31 * 86400000).toISOString(),
            )
            .order("created_at", { ascending: false })
            .limit(1001);
        let result = await query(
          "kind,target,service_id,source,created_at,session_id",
        );
        if (result.error && ["42703", "PGRST204"].includes(result.error.code)) {
          sourceReady = false;
          result = await query("kind,target,service_id,created_at,session_id");
        }
        if (result.error && ["42703", "PGRST204"].includes(result.error.code)) {
          detailedMetrics = false;
          return query("kind,service_id,created_at,session_id");
        }
        return result;
      })(),
      db
        .from("followup_settings")
        .select("reminder_minutes")
        .eq("organization_id", org)
        .maybeSingle(),
    ]);
    if (result.some((r) => r.error))
      return (
        <section className="panel form-panel">
          <h2>No se pudieron cargar las alertas</h2>
          <p>Reintenta y comprueba los permisos de esta organización.</p>
        </section>
      );
    tasks = result[0].data ?? [];
    notifications = result[1].data ?? [];
    const rows = (result[2].data ?? []) as unknown as MetricEvent[];
    truncated = rows.length >= 1000;
    metrics = rows.slice(0, 1000);
    minutes = result[3].data?.reminder_minutes ?? 60;
  }
  const orgInput = <input type="hidden" name="org" value={org} />;
  return (
    <div className="automation-panel">
      <MetricsDashboard
        events={metrics}
        services={services}
        sourceReady={sourceReady}
        detailedMetrics={detailedMetrics}
        loadedAt={new Date().toISOString()}
        truncated={truncated}
        demo={demo}
        slug={slug}
      />
      <section className="panel form-panel">
        <h2>Asistente de seguimiento</h2>
        <p>
          Motor de reglas, sin respuestas clínicas ni mensajes externos
          automáticos.
        </p>
        <div className="automation-rules">
          <p>
            <strong>1. Nueva consulta:</strong> crea tarea y aviso al equipo de
            la organización.
          </p>
          <p>
            <strong>2. Seguimiento:</strong> recuerda tareas pendientes; los
            cambios de etapa programan la próxima revisión.
          </p>
          <p>
            <strong>3. Atención humana:</strong> las solicitudes especiales se
            marcan para que una persona continúe por WhatsApp o correo.
          </p>
        </div>
        {role === "admin" && (
          <form action={saveFollowupSettings} className="edit-form">
            {orgInput}
            <label>
              Recordatorio automático después de
              <select name="reminder_minutes" defaultValue={minutes}>
                {[15, 60, 240, 1440, 2880].map((n) => (
                  <option value={n} key={n}>
                    {n < 60 ? `${n} minutos` : `${n / 60} horas`}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" disabled={demo}>
              Guardar regla
            </button>
          </form>
        )}
        <p className="fine-print">
          Regla inicial: cada 1 hora. Las tareas se marcan en rojo a las 24
          horas sin avance comercial. Cambiarla afecta a las tareas nuevas y a
          las que se reprogramen al cambiar de etapa. El panel revisa cada
          minuto y el programador de Supabase, cuando está activado, genera
          avisos internos aunque la aplicación esté cerrada.
        </p>
      </section>
      <section className="panel form-panel">
        <h2>Notificaciones internas</h2>
        {notifications.map((n) => (
          <div className="notification-row" key={n.id}>
            <span>{notificationLabels[n.kind]}</span>
            <form action={readNotification}>
              {orgInput}
              <input type="hidden" name="id" value={n.id} />
              <button className="small-button">Marcar leída</button>
            </form>
          </div>
        ))}
        {!notifications.length && (
          <p>No hay avisos pendientes{demo ? " en la demostración" : ""}.</p>
        )}
      </section>
      <section className="panel form-panel">
        <h2>Agenda comercial</h2>
        <p>
          Hasta 100 tareas, ordenadas por vencimiento. No contiene controles
          clínicos.
        </p>
        {tasks.map((task) => {
          const lead = leads.find((l) =>
            l.opportunities.some((o) => o.id === task.opportunity_id),
          );
          return (
            <article key={task.id} className="followup-row">
              <div>
                <strong>
                  {lead?.name ?? "Contacto fuera de la vista reciente"}
                </strong>
                <p>
                  {task.human_required
                    ? "Atención humana requerida"
                    : "Seguimiento comercial"}{" "}
                  ·{" "}
                  {new Date(task.due_at).toLocaleString("es-CL", {
                    timeZone: "America/Santiago",
                  })}{" "}
                  (Chile)
                </p>
                <span
                  className={
                    task.state === "pending" &&
                    Date.parse(task.red_at) < Date.now()
                      ? "critical-tag"
                      : task.state === "pending" &&
                          Date.parse(task.due_at) < Date.now()
                        ? "overdue-tag"
                        : "service-tag"
                  }
                >
                  {task.state === "pending"
                    ? Date.parse(task.red_at) < Date.now()
                      ? "24 h sin avance"
                      : Date.parse(task.due_at) < Date.now()
                        ? "Requiere seguimiento"
                        : "Programada"
                    : task.state === "done"
                      ? "Completada"
                      : "Cancelada"}
                </span>
              </div>
              <form action={updateFollowup} className="task-form">
                {orgInput}
                <input type="hidden" name="id" value={task.id} />
                <label>
                  Estado
                  <select name="state" defaultValue={task.state}>
                    <option value="pending">Pendiente</option>
                    <option value="done">Completada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </label>
                <label>
                  Reprogramar
                  <select name="snooze">
                    <option value="0">Mantener fecha</option>
                    <option value={minutes}>Aplicar regla automática</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input name="claim" type="checkbox" />
                  Asignarme la tarea
                </label>
                <button className="small-button">Guardar tarea</button>
              </form>
            </article>
          );
        })}
        {!tasks.length && (
          <p className="empty-state">
            Las nuevas oportunidades generarán sus tareas automáticamente al
            activar la migración.
          </p>
        )}
      </section>
      <Link className="inline-link" href={`/crm?org=${org}&view=crm`}>
        Ir a contactos y oportunidades →
      </Link>
    </div>
  );
}
