/** Phase 2 only: synthetic, in-memory editorial workflow. No persistence or providers. */
export const marketingSections = ["dashboard", "calendar", "create", "publications", "campaigns", "results", "settings"] as const;
export type MarketingSection = typeof marketingSections[number];
export function marketingSection(value?: string): MarketingSection {
  return marketingSections.includes(value as MarketingSection) ? value as MarketingSection : "dashboard";
}
export type ContentState = "draft" | "needs_review" | "changes_requested" | "approved" | "scheduled" | "canceled";
export type SampleContent = {
  id: string; title: string; copy: string; format: "Carrusel 4:5" | "Imagen 1:1" | "Video 9:16";
  channel: "Instagram" | "Facebook"; version: number; state: ContentState;
  approvedVersion: number | null; scheduledAt: string | null; timezone: string | null;
};
export type Simulation = { items: SampleContent[]; paused: boolean; history: string[]; message: string; error: boolean };
export type SimulationAction =
  | { type: "create"; title: string; copy: string; format: SampleContent["format"]; channel: SampleContent["channel"] }
  | { type: "edit"; id: string; copy: string }
  | { type: "review" | "approve" | "reject" | "cancel"; id: string }
  | { type: "schedule"; id: string; instant: string; timezone: string; now: number }
  | { type: "pause" } | { type: "reset" };
export const stateLabels: Record<ContentState, string> = {
  draft: "Borrador", needs_review: "En revisión", changes_requested: "Correcciones solicitadas",
  approved: "Aprobada", scheduled: "Programada · simulación", canceled: "Cancelada",
};
export function initialSimulation(): Simulation {
  return { paused: false, history: [], message: "Datos ficticios. Los cambios se pierden al recargar o cambiar de organización.", error: false,
    items: [{ id: "sample-1", title: "Una consulta informada", copy: "Prepara tus preguntas y consulta fuentes fiables antes de conversar con tu equipo.", format: "Carrusel 4:5", channel: "Instagram", version: 1, state: "draft", approvedVersion: null, scheduledAt: null, timezone: null }] };
}
function result(state: Simulation, message: string, error = false): Simulation {
  return { ...state, message, error, history: error ? state.history : [message, ...state.history].slice(0, 20) };
}
export function simulationReducer(state: Simulation, action: SimulationAction): Simulation {
  if (action.type === "reset") return initialSimulation();
  if (action.type === "pause") return result({ ...state, paused: !state.paused }, state.paused ? "Canal de muestra restablecido." : "Canal de muestra pausado; no se ejecutan publicaciones.");
  if (action.type === "create") {
    const title = action.title.trim(), copy = action.copy.trim();
    if (title.length < 3 || title.length > 100 || copy.length < 10 || copy.length > 2000) return result(state, "Usa un título de 3–100 caracteres y un texto de 10–2000.", true);
    if (state.items.length >= 50) return result(state, "Límite de 50 borradores de muestra. Reinicia la simulación para continuar.", true);
    return result({ ...state, items: [...state.items, { id: `sample-${state.items.length + 1}`, title, copy, format: action.format, channel: action.channel, version: 1, state: "draft", approvedVersion: null, scheduledAt: null, timezone: null }] }, "Borrador ficticio creado. No se guardó en CONNECT.");
  }
  const item = state.items.find(i => i.id === action.id);
  if (!item) return result(state, "La pieza de muestra no existe.", true);
  let next = { ...item }, message = "";
  if (action.type === "edit") {
    if (item.state === "canceled") return result(state, "Una pieza cancelada no se edita. Crea otro borrador.", true);
    const copy = action.copy.trim();
    if (copy.length < 10 || copy.length > 2000) return result(state, "El texto debe tener entre 10 y 2000 caracteres.", true);
    if (copy === item.copy) return result(state, "No hay cambios de texto.", true);
    next = { ...next, copy, version: item.version + 1, state: "draft", approvedVersion: null, scheduledAt: null, timezone: null };
    message = "Nueva versión creada: aprobación y programación anteriores invalidadas.";
  } else if (action.type === "review") {
    if (!["draft", "changes_requested"].includes(item.state)) return result(state, "Solo los borradores y correcciones pueden enviarse a revisión.", true);
    next.state = "needs_review"; message = "Revisión solicitada en la simulación.";
  } else if (action.type === "approve" || action.type === "reject") {
    if (item.state !== "needs_review") return result(state, "La pieza debe estar en revisión.", true);
    next.state = action.type === "approve" ? "approved" : "changes_requested";
    next.approvedVersion = action.type === "approve" ? item.version : null;
    message = action.type === "approve" ? `Aprobación ficticia de la versión ${item.version}. No concede permisos reales.` : "Correcciones solicitadas en la simulación.";
  } else if (action.type === "schedule") {
    if (state.paused) return result(state, "El canal está pausado.", true);
    if (item.state !== "approved" || item.approvedVersion !== item.version) return result(state, "Se necesita aprobación de la versión actual.", true);
    const instant = Date.parse(action.instant);
    if (!Number.isFinite(instant) || instant <= action.now) return result(state, "Selecciona una fecha futura válida.", true);
    try { new Intl.DateTimeFormat("es", { timeZone: action.timezone }).format(instant); } catch { return result(state, "Zona horaria no válida.", true); }
    next = { ...next, state: "scheduled", scheduledAt: new Date(instant).toISOString(), timezone: action.timezone };
    message = "Programación simulada. No se creó ningún trabajo ni publicación externa.";
  } else if (action.type === "cancel") {
    if (item.state === "canceled") return result(state, "La pieza ya está cancelada.", true);
    next = { ...next, state: "canceled", approvedVersion: null, scheduledAt: null, timezone: null }; message = "Pieza de muestra cancelada.";
  }
  return result({ ...state, items: state.items.map(i => i.id === item.id ? next : i) }, message);
}
/** Resolve a wall-clock minute; reject missing/ambiguous DST times rather than silently moving them. */
export function localMinuteToUTC(local: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error("Completa fecha y hora.");
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (year < 2000 || year > 2100 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error("Fecha u hora no válida.");
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); } catch { throw new Error("Zona horaria no válida."); }
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = wall - offset * 60000;
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map(p => [p.type, p.value]));
    if (+parts.year === year && +parts.month === month && +parts.day === day && +parts.hour === hour && +parts.minute === minute) matches.push(candidate);
  }
  if (!matches.length) throw new Error("Esta hora local no existe por el cambio de horario. Elige otra hora.");
  if (matches.length > 1) throw new Error("Esta hora local es ambigua por el cambio de horario. Elige otra hora sin ambigüedad.");
  return new Date(matches[0]).toISOString();
}
