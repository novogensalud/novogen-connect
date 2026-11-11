"use client";

import { useReducer, useState } from "react";
import { initialSimulation, localMinuteToUTC, marketingSection, marketingSections, simulationReducer, stateLabels, type SampleContent } from "@/lib/marketing-ai/simulation";
import styles from "./marketing-workspace.module.css";

const labels = { dashboard: "Dashboard", calendar: "Calendario", create: "Crear", publications: "Publicaciones", campaigns: "Campañas", results: "Resultados", settings: "Configuración" };
export function MarketingWorkspace({ organizationName, initialSection }: { organizationName: string; initialSection?: string }) {
  const [state, dispatch] = useReducer(simulationReducer, undefined, initialSimulation);
  const [section, setSection] = useState(marketingSection(initialSection));
  const [selected, setSelected] = useState("sample-1");
  const [title, setTitle] = useState(""); const [copy, setCopy] = useState("");
  const [format, setFormat] = useState<SampleContent["format"]>("Carrusel 4:5");
  const [channel, setChannel] = useState<SampleContent["channel"]>("Instagram");
  const [editCopy, setEditCopy] = useState("");
  const [localTime, setLocalTime] = useState(""); const [zone, setZone] = useState("America/Santiago");
  const [scheduleError, setScheduleError] = useState(""); const [calendarMode, setCalendarMode] = useState<"list" | "month" | "week">("list");
  const [month, setMonth] = useState("2026-11");
  const item = state.items.find(i => i.id === selected) ?? state.items[0];
  const scheduled = state.items.filter(i => i.state === "scheduled");
  const calendarKey = (instant: string) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const visibleScheduled = scheduled.filter(i => calendarMode === "list" || calendarKey(i.scheduledAt!).startsWith(month));
  const [year, monthNumber] = /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : [2026, 11];
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const startGap = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  function openPiece(id: string) { setSelected(id); setEditCopy(""); setScheduleError(""); setSection("publications"); }
  const displayDate = (instant: string, timezone: string) => new Intl.DateTimeFormat("es-CL", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(instant));
  function schedule() {
    setScheduleError("");
    try { dispatch({ type: "schedule", id: item.id, instant: localMinuteToUTC(localTime, zone), timezone: zone, now: Date.now() }); }
    catch (e) { setScheduleError(e instanceof Error ? e.message : "No se pudo interpretar la fecha."); }
  }
  return <section className={styles.workspace} aria-label="Marketing AI de demostración">
    <div className={styles.banner}><strong>SIMULACIÓN · {organizationName}</strong><span>Datos ficticios en memoria. Recargar reinicia los cambios. Sin publicaciones, IA ni cuentas externas.</span></div>
    <nav className={styles.tabs} aria-label="Secciones Marketing AI">{marketingSections.map(s => <button type="button" key={s} aria-pressed={section === s} onClick={() => setSection(s)}>{labels[s]}</button>)}</nav>
    <div className={styles.heading}><h2>{labels[section]}</h2><span>{state.paused ? "Canal de muestra pausado" : "Modo de prueba"}</span></div>
    {section === "dashboard" && <>
      <div className={styles.metrics}>{[["Borradores", state.items.filter(i => i.state === "draft").length], ["En revisión", state.items.filter(i => i.state === "needs_review").length], ["Programadas · muestra", scheduled.length]].map(([label, count]) => <article key={label}><span>{label}</span><strong>{count}</strong></article>)}</div>
      <h3>Piezas de muestra</h3><div className={styles.rows}>{state.items.map(i => <div key={i.id}><span><strong>{i.title}</strong><small>{i.channel} · {i.format} · v{i.version}</small></span><span>{stateLabels[i.state]}</span><button type="button" onClick={() => openPiece(i.id)}>Abrir pieza</button></div>)}</div>
      <h3>Resultado comercial</h3><p>Leads, reservas, inversión y ROAS: sin fuente conectada. No se representan como cero ni se usan contactos reales.</p>
    </>}
    {section === "create" && <form onSubmit={e => { e.preventDefault(); dispatch({ type: "create", title, copy, format, channel }); }}>
      <div className={styles.form}><label>Título de la pieza<input required minLength={3} maxLength={100} value={title} onChange={e => setTitle(e.target.value)} /></label><label>Objetivo<input value="Educación · muestra" readOnly /></label>
        <label>Formato<select value={format} onChange={e => setFormat(e.target.value as SampleContent["format"])}><option>Carrusel 4:5</option><option>Imagen 1:1</option><option>Video 9:16</option></select></label>
        <label>Canal de muestra<select value={channel} onChange={e => setChannel(e.target.value as SampleContent["channel"])}><option>Instagram</option><option>Facebook</option></select></label>
        <label className={styles.full}>Texto editorial<textarea required minLength={10} maxLength={2000} rows={4} value={copy} onChange={e => setCopy(e.target.value)} /></label>
      </div><div className={styles.actions}><button type="submit">Crear borrador de muestra</button><button type="button" disabled>Generar con ARM · no conectado</button><button type="button" disabled>Solicitar a Multimedia · no conectado</button></div>
      <p className={styles.note}>No ingreses información personal, clínica ni confidencial. Los activos y derechos se referenciarán desde Multimedia en otra fase.</p>
    </form>}
    {section === "publications" && <>
      <label className={styles.picker}>Pieza<select value={item.id} onChange={e => { setSelected(e.target.value); setEditCopy(""); setScheduleError(""); }}>{state.items.map(i => <option value={i.id} key={i.id}>{i.title}</option>)}</select></label>
      <div className={styles.review}><article className={styles.preview}><small>{item.channel} · {item.format} · composición pendiente de Multimedia</small><h3>{item.title}</h3><p>{item.copy}</p><span>Versión {item.version} · {stateLabels[item.state]}</span></article>
        <div><h3>Revisión simulada</h3><p>Estas acciones prueban el flujo; no acreditan revisión sanitaria ni conceden permisos reales.</p><div className={styles.actions}>
          <button type="button" disabled={!["draft", "changes_requested"].includes(item.state)} onClick={() => dispatch({ type: "review", id: item.id })}>Solicitar revisión</button>
          <button type="button" disabled={item.state !== "needs_review"} onClick={() => dispatch({ type: "approve", id: item.id })}>Simular aprobación</button>
          <button type="button" disabled={item.state !== "needs_review"} onClick={() => dispatch({ type: "reject", id: item.id })}>Solicitar correcciones</button>
        </div><label>Nuevo texto<textarea rows={3} maxLength={2000} placeholder="Escribe una corrección de al menos 10 caracteres" value={editCopy} onChange={e => setEditCopy(e.target.value)} /></label><button type="button" disabled={item.state === "canceled"} onClick={() => dispatch({ type: "edit", id: item.id, copy: editCopy })}>Guardar nueva versión</button>
        <p className={styles.note}>Cambiar el texto invalida la aprobación y programación de esa versión.</p></div></div>
      <h3>Programación de muestra</h3><div className={styles.form}><label>Fecha y hora local<input type="datetime-local" value={localTime} onChange={e => setLocalTime(e.target.value)} /></label><label>Zona horaria<select value={zone} onChange={e => setZone(e.target.value)}><option>America/Santiago</option><option>UTC</option><option>America/New_York</option></select></label></div>
      <div className={styles.actions}><button type="button" disabled={state.paused || item.state !== "approved" || item.approvedVersion !== item.version} onClick={schedule}>Simular programación</button><button type="button" disabled={item.state === "canceled"} onClick={() => dispatch({ type: "cancel", id: item.id })}>Cancelar pieza de muestra</button><button type="button" disabled>Publicar · no disponible en esta fase</button></div>
      {scheduleError && <p role="alert">{scheduleError}</p>}{item.scheduledAt && <p>Programada: {displayDate(item.scheduledAt, item.timezone!)} · {item.timezone} · UTC {item.scheduledAt}</p>}
    </>}
    {section === "calendar" && <>
      <div className={styles.actions}><button type="button" aria-pressed={calendarMode === "list"} onClick={() => setCalendarMode("list")}>Lista</button><button type="button" aria-pressed={calendarMode === "month"} onClick={() => setCalendarMode("month")}>Mes</button><button type="button" aria-pressed={calendarMode === "week"} onClick={() => setCalendarMode("week")}>Semana inicial del mes</button></div>
      {calendarMode !== "list" && <label className={styles.picker}>Mes del calendario<input type="month" value={month} min="2000-01" max="2100-12" onChange={e => setMonth(e.target.value || "2026-11")} /></label>}
      <p className={styles.note}>Horarios en America/Santiago. Solo incluye piezas programadas de esta simulación; no es la agenda de reservas.</p>
      {calendarMode !== "list" && <div className={styles.calendar} aria-label="Calendario editorial de muestra">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <strong key={d}>{d}</strong>)}{Array.from({ length: startGap }, (_,i) => <div key={`gap-${i}`} />)}{Array.from({ length: calendarMode === "week" ? 7 - startGap : dayCount }, (_,i) => { const day = i + 1, key = `${month}-${String(day).padStart(2,"0")}`; return <div key={key}><span>{day}</span>{visibleScheduled.filter(p => calendarKey(p.scheduledAt!) === key).map(p => <button type="button" key={p.id} onClick={() => openPiece(p.id)} aria-label={`Abrir ${p.title} del ${key}`}>{p.title}</button>)}</div>; })}</div>}
      <div className={styles.rows}>{visibleScheduled.filter(i => calendarMode !== "week" || Number(calendarKey(i.scheduledAt!).slice(-2)) <= 7 - startGap).sort((a,b) => a.scheduledAt!.localeCompare(b.scheduledAt!)).map(i => <div key={i.id}><span><strong>{i.title}</strong><small>{displayDate(i.scheduledAt!, "America/Santiago")}</small></span><span>{i.channel}</span><button type="button" onClick={() => openPiece(i.id)}>Ver programación</button></div>)}</div>
      {!visibleScheduled.length && <p>No hay piezas programadas en este periodo. Abre una pieza, solicita revisión, simula su aprobación y elige una fecha futura.</p>}
    </>}
    {section === "campaigns" && <><h3>Educación de marca · campaña ficticia</h3><div className={styles.rows}><div><span>Tipo</span><strong>Orgánica</strong></div><div><span>Piezas en esta sesión</span><strong>{state.items.length}</strong></div><div><span>Presupuesto de anuncios</span><strong>Sin autorización de gasto</strong></div></div><button type="button" disabled>Crear campaña pagada · fase posterior</button></>}
    {section === "results" && <><h3>Fuentes y calidad de datos</h3><div className={styles.rows}>{[["Impresiones e interacciones", "Canales no conectados"], ["Leads atribuibles", "DATA pendiente"], ["Reservas y asistencia", "Fuentes pendientes · no equivalen a un clic"], ["Ingresos, devoluciones e inversión", "FINANCE pendiente"], ["CPL, CAC, ROAS y margen", "No calculable · datos insuficientes"]].map(([name, status]) => <div key={name}><span>{name}</span><strong>{status}</strong></div>)}</div><p>Sin fecha de actualización ni ventana de atribución aprobada. Las cifras comerciales no se inventan a partir de esta simulación.</p><button type="button" disabled>Exportar · no disponible</button></>}
    {section === "settings" && <><div className={styles.rows}>{[["Alcance", "Simulación por organización"], ["Publicación", "Deshabilitada"], ["Aprobaciones reales", "Pendientes de roles y políticas"], ["Producción y biblioteca", "Multimedia · sin duplicar activos"], ["IA", "ARM / Gemini · sin conectar"]].map(([name,value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div><div className={styles.actions}><button type="button" aria-pressed={state.paused} onClick={() => dispatch({ type: "pause" })}>{state.paused ? "Restablecer canal de muestra" : "Pausar canal de muestra"}</button><button type="button" onClick={() => { dispatch({ type: "reset" }); setSelected("sample-1"); setEditCopy(""); setScheduleError(""); }}>Reiniciar datos ficticios</button><button type="button" disabled>Conectar cuenta · no disponible</button></div><h3>Historial de esta sesión</h3><ol>{state.history.map((entry, index) => <li key={index}>{entry}</li>)}</ol>{!state.history.length && <p>Aún no hay acciones de muestra.</p>}</>}
    <p className={styles.feedback} role={state.error ? "alert" : "status"}>{state.message}</p>
  </section>;
}
