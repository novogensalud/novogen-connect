import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  interactionKinds,
  interactionLabels,
  notificationLabels,
  targetLabels,
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
}: {
  org: string;
  role: string;
  demo: boolean;
  leads: Lead[];
  services: Service[];
}) {
  let tasks: FollowupTask[] = [];
  let notifications: CommercialNotification[] = [];
  let metrics: {
    kind: string;
    target?: string | null;
    service_id?: string | null;
  }[] = [];
  let detailedMetrics = true;
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
              new Date(Date.now() - 7 * 86400000).toISOString(),
            )
            .order("created_at", { ascending: false })
            .limit(1000);
        const result = await query("kind,target,service_id");
        if (result.error && ["42703", "PGRST204"].includes(result.error.code)) {
          detailedMetrics = false;
          return query("kind,service_id");
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
    metrics = (result[2].data ?? []) as unknown as typeof metrics;
    minutes = result[3].data?.reminder_minutes ?? 60;
  }
  const orgInput = <input type="hidden" name="org" value={org} />;
  return (
    <div className="automation-panel">
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
      <section className="panel form-panel">
        <h2>Interacción web · últimos 7 días</h2>
        <p>
          Hasta 1.000 eventos consentidos recientes. Las métricas no acreditan
          personas únicas, mensajes recibidos ni ventas.
        </p>
        <div className="analytics-grid">
          {interactionKinds.map((kind) => (
            <article key={kind}>
              <strong>{metrics.filter((m) => m.kind === kind).length}</strong>
              <span>{interactionLabels[kind]}</span>
            </article>
          ))}
        </div>
        {!detailedMetrics && (
          <div className="notice">
            Ejecuta la migración 004 para distinguir todos los botones, agenda,
            Instagram y TikTok.
          </div>
        )}
        <div className="table-scroll button-metrics-table">
          <table>
            <caption>Accesos por botón de CONNECT FLASH</caption>
            <thead>
              <tr>
                <th>BOTÓN</th>
                <th>CLICS</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(targetLabels).map(([target, label]) => (
                <tr key={target}>
                  <td>{label}</td>
                  <td>{metrics.filter((m) => m.target === target).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-scroll button-metrics-table">
          <table>
            <caption>Interacción con cada servicio</caption>
            <thead>
              <tr>
                <th>SERVICIO</th>
                <th>FICHA</th>
                <th>ORIENTACIÓN</th>
                <th>AGENDA</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>
                    {
                      metrics.filter(
                        (m) =>
                          m.service_id === service.id &&
                          m.kind === "service_view",
                      ).length
                    }
                  </td>
                  <td>
                    {
                      metrics.filter(
                        (m) =>
                          m.service_id === service.id &&
                          m.target === "service_contact",
                      ).length
                    }
                  </td>
                  <td>
                    {
                      metrics.filter(
                        (m) =>
                          m.service_id === service.id &&
                          m.kind === "agenda_click",
                      ).length
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine-print">
          Sin PostHog: medición propia de CONNECT. WhatsApp y correo registran
          el clic de salida; falta conectar sus proveedores para medir
          conversaciones o entregas.
        </p>
      </section>
      <Link className="inline-link" href={`/crm?org=${org}&view=crm`}>
        Ir a contactos y oportunidades →
      </Link>
    </div>
  );
}
