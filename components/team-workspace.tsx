"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCheck,
  Mail,
  Search,
  UsersRound,
} from "lucide-react";
import type { Lead, Organization, Service } from "@/lib/domain";
import { stages, stageLabels } from "@/lib/domain";
import type { CommercialNotification, FollowupTask } from "@/lib/automation";
import { commercialWhatsApp } from "@/lib/team";
import { DeviceAlerts } from "./device-alerts";
import { InstallApp } from "./install-app";
import { NotificationInbox } from "./notification-inbox";
import { signOut, updateOpportunity, updateFollowup } from "@/app/actions";
export function TeamWorkspace({
  org,
  orgs,
  leads,
  services,
  tasks,
  notifications,
  userId,
  demo,
  notice,
}: {
  org: Organization;
  orgs: Organization[];
  leads: Lead[];
  services: Service[];
  tasks: FollowupTask[];
  notifications: CommercialNotification[];
  userId: string;
  demo: boolean;
  notice?: string;
}) {
  const [search, setSearch] = useState(""),
    [stage, setStage] = useState(""),
    [assignment, setAssignment] = useState("open"),
    [tab, setTab] = useState("prospects");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/connect-sw.js").catch(() => {});
    return () => clearInterval(timer);
  }, []);
  const inputs = (
    <>
      <input type="hidden" name="org" value={org.id} />
      <input type="hidden" name="return_to" value="equipo" />
    </>
  );
  const matches = (lead: Lead) =>
    `${lead.name} ${lead.email} ${lead.phone}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const taskFor = (id: string) => tasks.find((t) => t.opportunity_id === id);
  const assignmentMatches = (task?: FollowupTask) =>
    assignment === "all" ||
    (assignment === "mine"
      ? task?.assigned_to === userId
      : assignment === "unassigned"
        ? task?.assigned_to == null
        : !task?.assigned_to || task.assigned_to === userId);
  const visible = leads
    .filter(matches)
    .flatMap((lead) =>
      lead.opportunities
        .filter(
          (o) =>
            (!stage || o.stage === stage) && assignmentMatches(taskFor(o.id)),
        )
        .map((opportunity) => ({
          lead,
          opportunity,
          task: taskFor(opportunity.id),
        })),
    )
    .sort(
      (a, b) =>
        (a.task ? Date.parse(a.task.due_at) : Infinity) -
        (b.task ? Date.parse(b.task.due_at) : Infinity),
    );
  const pendingTasks = tasks.filter(assignmentMatches);
  const newCount = leads.filter((l) =>
    l.opportunities.some((o) => o.stage === "new"),
  ).length;
  return (
    <div className="team-app">
      <header className="team-header">
        <Link href={`/equipo?org=${org.id}`} className="wordmark">
          connect<small>EQUIPO COMERCIAL</small>
        </Link>
        <Link className="small-button" href={`/crm?org=${org.id}`}>
          Abrir CRM <ArrowUpRight size={14} />
        </Link>
      </header>
      <main className="team-main">
        <div className="team-intro">
          <span className="eyebrow">{org.name} / TU JORNADA</span>
          <h1>Tu equipo, conectado.</h1>
          <p>Prospectos claros. Próximos pasos a mano.</p>
        </div>
        {demo && (
          <p className="notice">
            Demostración con contactos ficticios. No guarda cambios ni envía
            mensajes.
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice === "saved"
              ? "Cambios guardados."
              : notice === "invalid"
                ? "Revisa los campos."
                : "No se pudo guardar. Revisa tu conexión y permisos."}
          </p>
        )}
        {orgs.length > 1 && (
          <form className="team-org">
            <label>
              Equipo
              <select name="org" defaultValue={org.id}>
                {orgs.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="small-button">Cambiar equipo</button>
          </form>
        )}
        <div className="team-stats">
          <article>
            <UsersRound size={19} />
            <strong>{newCount}</strong>
            <span>Nuevos</span>
          </article>
          <article>
            <CalendarClock size={19} />
            <strong>{pendingTasks.length}</strong>
            <span>Tareas por atender</span>
          </article>
          <article className="team-critical">
            <BriefcaseBusiness size={19} />
            <strong>
              {pendingTasks.filter((t) => Date.parse(t.red_at) < now).length}
            </strong>
            <span>24 h sin avance</span>
          </article>
        </div>
        <DeviceAlerts
          compact
          refreshOnUpdate
          endpoint={`/api/notifications?org=${org.id}`}
          title="Avisos del equipo"
        />
        <NotificationInbox
          items={notifications}
          org={org.id}
          demo={demo}
          team
        />
        <div className="team-tabs" role="group" aria-label="Vista de trabajo">
          <button
            aria-pressed={tab === "prospects"}
            onClick={() => setTab("prospects")}
          >
            <UsersRound size={17} /> Prospectos
          </button>
          <button
            aria-pressed={tab === "tasks"}
            onClick={() => setTab("tasks")}
          >
            <CheckCheck size={17} /> Mis tareas
          </button>
        </div>
        <div className="team-filters">
          <label>
            <span>
              <Search size={14} /> Buscar prospecto
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, correo o teléfono"
            />
          </label>
          <label>
            Asignación
            <select
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
            >
              <option value="open">Mías y sin asignar</option>
              <option value="mine">Solo mías</option>
              <option value="unassigned">Sin asignar</option>
              <option value="all">Todo el equipo</option>
            </select>
          </label>
          <label>
            Etapa
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Todas las etapas</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {stageLabels[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <section
          className="team-prospects"
          aria-label={
            tab === "prospects" ? "Lista de prospectos" : "Lista de tareas"
          }
        >
          {visible
            .filter((row) => tab !== "tasks" || row.task)
            .map(({ lead, opportunity: o, task }) => {
              const red = task && Date.parse(task.red_at) < now,
                overdue = task && Date.parse(task.due_at) < now;
              const whatsapp = commercialWhatsApp(lead.phone);
              return (
                <article
                  className={`team-prospect ${red ? "critical" : ""}`}
                  key={o.id}
                >
                  <div className="team-card-heading">
                    <div>
                      <span className="team-avatar">
                        {lead.name.slice(0, 1)}
                      </span>
                      <h2>{lead.name}</h2>
                    </div>
                    <span
                      className={
                        red
                          ? "critical-tag"
                          : overdue
                            ? "overdue-tag"
                            : "service-tag"
                      }
                    >
                      {red
                        ? "24 h sin avance"
                        : overdue
                          ? "Seguimiento pendiente"
                          : stageLabels[o.stage]}
                    </span>
                  </div>
                  <p className="team-interest">
                    {services.find((s) => s.id === lead.service_id)?.name ??
                      "Orientación comercial"}
                  </p>
                  <div className="team-contact-actions">
                    {whatsapp && !demo && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir WhatsApp <ArrowUpRight size={13} />
                      </a>
                    )}
                    {!demo && (
                      <a href={`mailto:${lead.email}`}>
                        <Mail size={14} /> Correo
                      </a>
                    )}
                    <small>{lead.email}</small>
                  </div>
                  {task && (
                    <p className="team-due">
                      <CalendarClock size={14} />
                      {new Date(task.due_at).toLocaleString("es-CL", {
                        timeZone: "America/Santiago",
                      })}{" "}
                      Chile ·{" "}
                      {task.assigned_to === userId
                        ? "Asignada a mí"
                        : task.assigned_to
                          ? "Asignada a otra persona"
                          : "Sin asignar"}
                      {task.human_required
                        ? " · Atención humana requerida"
                        : ""}
                    </p>
                  )}
                  <form
                    action={updateOpportunity}
                    className="team-opportunity-form"
                  >
                    {inputs}
                    <input type="hidden" name="id" value={o.id} />
                    <label>
                      Etapa
                      <select
                        name="stage"
                        defaultValue={o.stage}
                        disabled={demo}
                      >
                        {stages.map((s) => (
                          <option key={s} value={s}>
                            {stageLabels[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Próxima acción
                      <input
                        name="next_action"
                        defaultValue={o.next_action ?? ""}
                        maxLength={240}
                        placeholder="Define el próximo paso"
                        disabled={demo}
                      />
                    </label>
                    <button className="button primary" disabled={demo}>
                      Guardar prospecto
                    </button>
                  </form>
                  {task && (
                    <form action={updateFollowup} className="team-task-actions">
                      {inputs}
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="snooze" value="0" />
                      <label className="checkbox-label">
                        <input name="claim" type="checkbox" disabled={demo} />{" "}
                        Asignarme
                      </label>
                      <select
                        name="state"
                        aria-label={`Estado de tarea de ${lead.name}`}
                        defaultValue="pending"
                        disabled={demo}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="done">Completada</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                      <button className="small-button" disabled={demo}>
                        Guardar tarea
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
        </section>
        {!visible.filter((row) => tab !== "tasks" || row.task).length && (
          <p className="team-empty">
            No hay {tab === "tasks" ? "tareas" : "prospectos"} que coincidan con
            estos filtros.
          </p>
        )}
        <p className="fine-print">
          Vista de los últimos 100 contactos y hasta 100 tareas pendientes. Las
          cifras corresponden a esta vista; no son ventas confirmadas. Requiere
          conexión para consultar y guardar.
        </p>
        <section className="team-install">
          <h2>Lleva CONNECT en tu inicio</h2>
          <p>
            Instala esta vista como aplicación para acceder a tu jornada
            comercial.
          </p>
          <InstallApp />
        </section>
        {!demo && (
          <form action={signOut}>
            <button className="small-button">Cerrar sesión</button>
          </form>
        )}
      </main>
      <nav className="team-bottom-nav" aria-label="Navegación del equipo">
        <Link href={`/equipo?org=${org.id}`}>
          <UsersRound size={18} /> Prospectos
        </Link>
        <Link href={`/crm?org=${org.id}&view=automation`}>
          <CalendarClock size={18} /> Seguimiento
        </Link>
        <Link href={`/crm?org=${org.id}`}>
          <BriefcaseBusiness size={18} /> CRM
        </Link>
      </nav>
    </div>
  );
}
