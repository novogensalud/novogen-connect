import { DeviceAlerts } from "@/components/device-alerts";
import { AutomationPanel } from "@/components/automation-panel";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  LayoutDashboard,
  UsersRound,
  Layers3,
  ScanLine,
  Activity,
  ArrowRight,
  Plus,
  ShieldCheck,
  Search,
  LogOut,
  BellRing,
} from "lucide-react";
import { isConfigured, supabase } from "@/lib/supabase";
import { demoOrg, demoServices, demoLeads, demoPoints } from "@/lib/demo";
import {
  type Organization,
  type Service,
  type Lead,
  type Point,
  stages,
  stageLabels,
} from "@/lib/domain";
import {
  addService,
  editService,
  toggleService,
  updateOpportunity,
  addPoint,
  togglePoint,
  signOut,
  createContact,
} from "../actions";
export const dynamic = "force-dynamic";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const demo = !isConfigured();
  let org = demoOrg;
  let orgs: Organization[] = [demoOrg];
  let services: Service[] = demoServices;
  let leads: Lead[] = demoLeads;
  let points: Point[] = demoPoints;
  let eventCount = 0;
  let role = "admin";
  if (!demo) {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect("/login");
    const { data: memberships, error } = await db
      .from("memberships")
      .select("role, organizations(id,name,slug)")
      .eq("user_id", user.id);
    if (error)
      return (
        <main className="empty">
          <h1>No se pudo cargar el espacio</h1>
          <p>
            Comprueba la conexión y que se haya aplicado la migración de
            Supabase.
          </p>
          <Link href="/crm">Reintentar</Link>
        </main>
      );
    orgs = (memberships ?? []).flatMap((m) =>
      m.organizations ? [m.organizations as unknown as Organization] : [],
    );
    if (!orgs.length)
      return (
        <main className="empty">
          <span className="eyebrow">CONNECT / ACCESO</span>
          <h1>Tu cuenta aún no tiene un espacio</h1>
          <p>
            Solicita al administrador que te asigne una organización. No se
            concede acceso por registrarse.
          </p>
          <form action={signOut}>
            <button className="button">Cerrar sesión</button>
          </form>
        </main>
      );
    org = orgs.find((o) => o.id === params.org) ?? orgs[0];
    role =
      memberships?.find(
        (m) => (m.organizations as unknown as Organization)?.id === org.id,
      )?.role ?? "agent";
    const results = await Promise.all([
      db
        .from("services")
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at"),
      db
        .from("leads")
        .select(
          "id,name,email,phone,created_at,service_id,opportunities(id,stage,next_action)",
        )
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("connect_points")
        .select("id,name,code,active")
        .eq("organization_id", org.id)
        .order("created_at"),
      db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("kind", "point_access"),
    ]);
    if (results.some((r) => r.error))
      return (
        <main className="empty">
          <h1>No pudimos cargar tus datos</h1>
          <p>
            Revisa la conexión, las migraciones y tus permisos antes de
            reintentar.
          </p>
          <Link href="/crm">Reintentar</Link>
        </main>
      );
    services = results[0].data ?? [];
    leads = (results[1].data ?? []) as Lead[];
    points = results[2].data ?? [];
    eventCount = results[3].count ?? 0;
  }
  const view = ["overview", "crm", "catalog", "points", "automation"].includes(
    params.view ?? "",
  )
    ? params.view!
    : "overview";
  const href = (v: string) => `/crm?org=${org.id}&view=${v}`;
  const filteredLeads = leads.filter(
    (l) =>
      (!params.q ||
        `${l.name} ${l.email}`
          .toLowerCase()
          .includes(params.q.toLowerCase())) &&
      (!params.stage || l.opportunities.some((o) => o.stage === params.stage)),
  );
  const messages: Record<string, string> = {
    saved: "Cambios guardados.",
    error: "No se pudo guardar. Revisa tu conexión y vuelve a intentar.",
    invalid: "Revisa los campos del formulario.",
    forbidden: "No tienes permiso para realizar esta operación.",
    demo: "La demostración no guarda cambios.",
  };
  const orgInput = <input type="hidden" name="org" value={org.id} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/crm" className="wordmark">
          connect<span>®</span>
          <small>by SOLVEX</small>
        </Link>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <div className="org-card">
          <span className="org-icon">N</span>
          <div>
            <strong>{org.name}</strong>
            <small>
              {demo ? "Instancia piloto · demo" : "Espacio comercial"}
            </small>
          </div>
          <span className="status-dot" />
        </div>
        <nav aria-label="Principal">
          {[
            { id: "overview", label: "Vista general", icon: LayoutDashboard },
            { id: "crm", label: "CRM comercial", icon: UsersRound },
            { id: "catalog", label: "Catálogo", icon: Layers3 },
            { id: "points", label: "Puntos CONNECT", icon: ScanLine },
            {
              id: "automation",
              label: "Seguimiento y métricas",
              icon: BellRing,
            },
          ].map((item) => (
            <Link
              key={item.id}
              href={href(item.id)}
              className={view === item.id ? "nav-item selected" : "nav-item"}
            >
              <item.icon size={19} />
              {item.label}
              {view === item.id && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="pilot-note">
            <ShieldCheck size={20} />
            <strong>Conexiones con propósito</strong>
            <p>Un espacio comercial. Sin información clínica.</p>
          </div>
          <Link className="public-link" href={`/connect/${org.slug}`}>
            Abrir CONNECT FLASH <ArrowUpRight size={16} />
          </Link>
          {!demo && (
            <form action={signOut}>
              <button className="text-button">
                <LogOut size={16} /> Cerrar sesión
              </button>
            </form>
          )}
          <span className="sidebar-foot">SOLVEX TECHNOLOGY · MVP 0.1</span>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>{org.name}</strong>
          </span>
          <div className="topbar-right">
            <span className="mode-badge">
              {demo ? "DEMOSTRACIÓN" : "CONECTADO"}
            </span>
            <span className="avatar">{role === "admin" ? "AD" : "CO"}</span>
          </div>
        </header>
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <span className="eyebrow">TU ECOSISTEMA COMERCIAL</span>
              <h1>
                {view === "overview"
                  ? "Cada conexión cuenta."
                  : view === "crm"
                    ? "CRM comercial"
                    : view === "catalog"
                      ? "Catálogo de servicios"
                      : view === "automation"
                        ? "Seguimiento y métricas"
                        : "Puntos CONNECT"}
              </h1>
              <p>
                {view === "overview"
                  ? "Una mirada clara a las personas, los servicios y las oportunidades."
                  : view === "crm"
                    ? "Acompaña cada oportunidad, desde el primer contacto."
                    : view === "catalog"
                      ? "Una fuente central para todos tus servicios."
                      : view === "automation"
                        ? "Tareas, avisos y uso de CONNECT en un mismo espacio."
                        : "Conecta un lugar físico con tu espacio digital."}
              </p>
            </div>
            <Link className="button primary" href={`/connect/${org.slug}`}>
              Ver experiencia pública <ArrowUpRight size={16} />
            </Link>
          </div>
          {demo && (
            <div className="demo-notice">
              <span className="status-dot" />
              <span>
                <strong>Estás explorando el piloto.</strong> Los contactos son
                ficticios. Conecta Supabase para guardar información real.
              </span>
            </div>
          )}
          {params.notice && messages[params.notice] && (
            <div role="status" className="notice">
              {messages[params.notice]}
            </div>
          )}
          {orgs.length > 1 && (
            <form className="org-switch">
              <label>
                Organización{" "}
                <select name="org" defaultValue={org.id}>
                  {orgs.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button">Cambiar</button>
            </form>
          )}
          <DeviceAlerts
            endpoint={`/api/notifications?org=${org.id}`}
            refreshOnUpdate
            title="Avisos del equipo comercial"
          />
          {view === "automation" && (
            <AutomationPanel
              org={org.id}
              role={role}
              demo={demo}
              leads={leads}
            />
          )}
          {view === "overview" && (
            <>
              <section className="metrics" aria-label="Indicadores">
                <Metric
                  label="CONTACTOS"
                  value={leads.length}
                  note="Últimos 100 contactos"
                  icon={<UsersRound size={19} />}
                />
                <Metric
                  label="OPORTUNIDADES ABIERTAS"
                  value={
                    leads.filter((l) =>
                      l.opportunities.some((o) => o.stage !== "closed_lost"),
                    ).length
                  }
                  note="Seguimiento comercial"
                  icon={<Activity size={19} />}
                />
                <Metric
                  label="SERVICIOS ACTIVOS"
                  value={services.filter((s) => s.active).length}
                  note="En el catálogo público"
                  icon={<Layers3 size={19} />}
                />
                <Metric
                  label="ACCESOS DESDE PUNTOS"
                  value={eventCount}
                  note={
                    demo
                      ? "Sin eventos reales en demo"
                      : "Accesos registrados · no ventas"
                  }
                  icon={<ScanLine size={19} />}
                />
              </section>
              <div className="overview-grid">
                <section className="panel pipeline-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>El pulso de tus oportunidades</h2>
                      <p>Del interés al siguiente paso.</p>
                    </div>
                    <Link href={href("crm")} className="inline-link">
                      Ver CRM <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <div className="pipeline-bars">
                    {stages.slice(0, 4).map((s, i) => {
                      const n = leads.filter((l) =>
                        l.opportunities.some((o) => o.stage === s),
                      ).length;
                      return (
                        <div key={s} className="pipeline-row">
                          <span className="pipeline-number">0{i + 1}</span>
                          <span className="pipeline-label">
                            {stageLabels[s]}
                          </span>
                          <div className="bar-track">
                            <div
                              style={{
                                width: `${Math.max(3, (n / Math.max(leads.length, 1)) * 100)}%`,
                              }}
                              className={`bar bar-${i}`}
                            />
                          </div>
                          <strong>{n}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <div className="panel-foot">
                    <ShieldCheck size={15} /> Una reserva informada no acredita
                    una venta.
                  </div>
                </section>
                <section className="flash-card">
                  <span className="eyebrow">CONNECT FLASH</span>
                  <div className="flash-symbol">
                    <ScanLine size={42} />
                  </div>
                  <h2>
                    Tu próxima conexión
                    <br />
                    empieza aquí.
                  </h2>
                  <p>
                    Servicios, orientación y canales de contacto en una sola
                    experiencia móvil.
                  </p>
                  <Link href={`/connect/${org.slug}`} className="button light">
                    Explorar FLASH <ArrowRight size={17} />
                  </Link>
                  <span className="flash-decoration" />
                </section>
              </div>
            </>
          )}
          {(view === "overview" || view === "crm") && (
            <section className="panel contacts-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "overview"
                      ? "Conexiones recientes"
                      : "Contactos y oportunidades"}
                  </h2>
                  <p>
                    {demo
                      ? "Datos ficticios para explorar el flujo."
                      : "Hasta 100 contactos más recientes de esta organización."}
                  </p>
                </div>
                {view === "crm" ? (
                  <form className="search-form">
                    <input type="hidden" name="org" value={org.id} />
                    <input type="hidden" name="view" value="crm" />
                    <select
                      name="stage"
                      aria-label="Filtrar etapa"
                      defaultValue={params.stage ?? ""}
                    >
                      <option value="">Todas las etapas</option>
                      {stages.map((s) => (
                        <option key={s} value={s}>
                          {stageLabels[s]}
                        </option>
                      ))}
                    </select>
                    <Search size={16} />
                    <input
                      name="q"
                      aria-label="Buscar contacto"
                      placeholder="Buscar contacto"
                      defaultValue={params.q}
                    />
                    <button className="text-button">Buscar</button>
                  </form>
                ) : (
                  <Link className="inline-link" href={href("crm")}>
                    Todos los contactos <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>CONTACTO</th>
                      <th>INTERÉS</th>
                      <th>ETAPA</th>
                      <th>PRÓXIMO PASO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads
                      .slice(0, view === "overview" ? 4 : 100)
                      .map((lead, i) => (
                        <tr key={lead.id}>
                          <td>
                            <div className="person">
                              <span className={`contact-avatar color-${i % 3}`}>
                                {lead.name
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((x) => x[0])
                                  .join("")}
                              </span>
                              <div>
                                <strong>{lead.name}</strong>
                                <small>{lead.email}</small>
                                {lead.phone && <small>{lead.phone}</small>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="service-tag">
                              {services.find((s) => s.id === lead.service_id)
                                ?.name ?? "Orientación"}
                            </span>
                          </td>
                          <td colSpan={2}>
                            {lead.opportunities.map((o) => (
                              <form
                                key={o.id}
                                action={updateOpportunity}
                                className="opportunity-form"
                              >
                                {orgInput}
                                <input type="hidden" name="id" value={o.id} />
                                <label
                                  className="sr-only"
                                  htmlFor={`stage-${o.id}`}
                                >
                                  Etapa de {lead.name}
                                </label>
                                <select
                                  id={`stage-${o.id}`}
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
                                <input
                                  name="next_action"
                                  aria-label={`Próximo paso de ${lead.name}`}
                                  defaultValue={o.next_action ?? ""}
                                  maxLength={240}
                                  placeholder="Próxima acción comercial"
                                  disabled={demo}
                                />
                                {!demo && (
                                  <button className="small-button">
                                    Guardar
                                  </button>
                                )}
                              </form>
                            ))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!filteredLeads.length && (
                  <div className="empty-state">
                    Aún no hay contactos que mostrar. Comparte tu espacio
                    CONNECT para recibir consultas.
                  </div>
                )}
              </div>
            </section>
          )}
          {view === "crm" && (
            <section className="panel form-panel">
              <h2>Nuevo contacto comercial</h2>
              <p>
                Registra un contacto y su primera oportunidad. No incluyas
                información clínica.
              </p>
              <form action={createContact} className="edit-form">
                {orgInput}
                <label>
                  Nombre
                  <input name="name" required minLength={2} maxLength={100} />
                </label>
                <label>
                  Correo electrónico
                  <input name="email" type="email" required maxLength={254} />
                </label>
                <label>
                  Teléfono (opcional)
                  <input name="phone" type="tel" maxLength={30} />
                </label>
                <label>
                  Servicio de interés
                  <select name="service">
                    <option value="">Orientación general</option>
                    {services
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="checkbox-label full">
                  <input type="checkbox" name="consent" required />
                  <span>
                    Confirmo contar con autorización del contacto para registrar
                    estos datos y realizar seguimiento comercial.
                  </span>
                </label>
                <button className="button primary" disabled={demo}>
                  <Plus size={16} />
                  Crear contacto
                </button>
                {demo && (
                  <p className="fine-print">
                    La demostración no guarda contactos.
                  </p>
                )}
              </form>
            </section>
          )}
          {view === "catalog" && (
            <>
              <section className="service-grid">
                {services.map((s) => (
                  <article className="panel service-card" key={s.id}>
                    <span className="eyebrow">
                      {s.category}
                      {s.subcategory ? ` / ${s.subcategory}` : ""}
                    </span>
                    <h2>{s.name}</h2>
                    <p>{s.description}</p>
                    <form action={toggleService}>
                      {orgInput}
                      <input type="hidden" name="id" value={s.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={String(!s.active)}
                      />
                      <span
                        className={`service-tag ${s.active ? "" : "muted"}`}
                      >
                        {s.active ? "Publicado" : "Inactivo"}
                      </span>
                      {role === "admin" && (
                        <button className="text-button" disabled={demo}>
                          {s.active ? "Desactivar" : "Publicar"}
                        </button>
                      )}
                    </form>
                    {role === "admin" && (
                      <details className="service-edit">
                        <summary>Editar información</summary>
                        <form action={editService} className="stack-form">
                          {orgInput}
                          <input type="hidden" name="id" value={s.id} />
                          <label>
                            Nombre
                            <input
                              name="name"
                              defaultValue={s.name}
                              required
                              minLength={2}
                              maxLength={80}
                            />
                          </label>
                          <label>
                            Categoría
                            <select name="category" defaultValue={s.category}>
                              {[
                                "CHECK",
                                "VITA",
                                "BODY",
                                "COMPRENDE",
                                "OPTIMIZA",
                                "SEGUIMIENTO",
                              ].map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Subcategoría (solo OPTIMIZA)
                            <select
                              name="subcategory"
                              defaultValue={s.subcategory ?? ""}
                            >
                              <option value="">Sin subcategoría</option>
                              {["SUPLE", "RECOVERY", "GLOW"].map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Descripción
                            <textarea
                              name="description"
                              defaultValue={s.description}
                              required
                              minLength={5}
                              maxLength={500}
                            />
                          </label>
                          <button className="button primary" disabled={demo}>
                            Guardar
                          </button>
                        </form>
                      </details>
                    )}
                  </article>
                ))}
              </section>
              {role === "admin" && (
                <section className="panel form-panel">
                  <h2>Agregar servicio</h2>
                  <p>
                    No incluyas precios ni beneficios sin validación comercial.
                  </p>
                  <form action={addService} className="edit-form">
                    {orgInput}
                    <label>
                      Nombre
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Categoría
                      <select name="category">
                        {[
                          "CHECK",
                          "VITA",
                          "BODY",
                          "COMPRENDE",
                          "OPTIMIZA",
                          "SEGUIMIENTO",
                        ].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subcategoría (solo OPTIMIZA)
                      <select name="subcategory">
                        <option value="">Sin subcategoría</option>
                        {["SUPLE", "RECOVERY", "GLOW"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className="full">
                      Descripción comercial
                      <textarea
                        name="description"
                        required
                        minLength={5}
                        maxLength={500}
                      />
                    </label>
                    <button disabled={demo} className="button primary">
                      <Plus size={16} />
                      Agregar servicio
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
          {view === "points" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Accesos físicos y digitales</h2>
                    <p>
                      Graba estas rutas en tus etiquetas NFC o úsalas para
                      generar QR. No contienen datos personales.
                    </p>
                  </div>
                </div>
                <div className="point-list">
                  {points.map((p) => (
                    <article key={p.id} className="point-row">
                      <ScanLine size={28} />
                      <div>
                        <strong>{p.name}</strong>
                        <Link href={`/r/${p.code}`} className="point-url">
                          /r/{p.code}
                        </Link>
                      </div>
                      <a
                        className="small-button"
                        href={`/api/qr/${p.code}`}
                        download
                      >
                        Descargar QR
                      </a>
                      <span className="service-tag">
                        {p.active ? "Activo" : "Inactivo"}
                      </span>
                      {role === "admin" && (
                        <form action={togglePoint}>
                          {orgInput}
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={String(!p.active)}
                          />
                          <button className="text-button" disabled={demo}>
                            {p.active ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      )}
                    </article>
                  ))}
                  {!points.length && (
                    <div className="empty-state">
                      Crea tu primer punto para identificar el origen de las
                      consultas.
                    </div>
                  )}
                </div>
              </section>
              {role === "admin" && (
                <section className="panel form-panel">
                  <h2>Nuevo punto</h2>
                  <form action={addPoint} className="edit-form">
                    {orgInput}
                    <label>
                      Nombre del punto
                      <input
                        name="name"
                        placeholder="Ej. Recepción"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <button className="button primary" disabled={demo}>
                      <Plus size={16} />
                      Crear acceso
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
          <footer className="dashboard-footer">
            <span>CONNECT · Una plataforma de SOLVEX</span>
            <span>
              <span className="status-dot" />
              {demo ? "Vista de demostración" : "Acceso por organización"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="metric">
      <div className="metric-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong className="metric-value">{String(value).padStart(2, "0")}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}
