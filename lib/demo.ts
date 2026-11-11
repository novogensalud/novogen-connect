import recoveredServices from "./recovered-services.json";
import type { Organization, Service, Lead, Point } from "./domain";
export const demoOrg: Organization = {
  id: "demo",
  name: "NOVOGEN",
  slug: "novogen",
};
export const demoServices: Service[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "CHECK",
    category: "CHECK",
    description:
      "Conoce nuestros servicios CHECK y solicita orientación comercial.",
    active: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "VITA",
    category: "VITA",
    description:
      "Descubre los servicios VITA y encuentra información para tu próxima visita.",
    active: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "BODY",
    category: "BODY",
    description:
      "Explora BODY y conversa con nuestro equipo sobre las alternativas disponibles.",
    active: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "COMPRENDE",
    category: "COMPRENDE",
    description: "Solicita información comercial sobre COMPRENDE.",
    active: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    name: "OPTIMIZA",
    category: "OPTIMIZA",
    description:
      "Conoce SUPLE, RECOVERY y GLOW. Nuestro equipo puede orientarte.",
    active: true,
  },
  ...(["SUPLE", "RECOVERY", "GLOW"] as const).map((name, i) => ({
    id: `10000000-0000-4000-8000-00000000000${i + 6}`,
    name,
    category: "OPTIMIZA",
    subcategory: name,
    description: `Solicita información comercial sobre ${name}.`,
    active: true,
  })),
  {
    id: "10000000-0000-4000-8000-000000000009",
    name: "SEGUIMIENTO",
    category: "SEGUIMIENTO",
    description:
      "Información comercial sobre seguimiento y suscripciones. Sin registro de información clínica.",
    active: true,
  },
  ...recoveredServices.map((s, i) => ({
    id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name: s.name,
    category: "OPTIMIZA",
    subcategory: s.subcategory,
    description: s.description,
    active: true,
  })),
];
// Mirror the explicit NOVOGEN hierarchy in demonstrations.
const evaluationId = "10000000-0000-4000-8000-000000000099";
const named = (name: string) => demoServices.find((s) => s.name === name)!.id;
for (const s of demoServices) {
  s.catalog_type = ["OPTIMIZA", "RECOVERY", "GLOW"].includes(s.name)
    ? "group"
    : "service";
  s.parent_id = ["CHECK", "BODY", "VITA"].includes(s.name)
    ? evaluationId
    : ["SUPLE", "RECOVERY", "GLOW"].includes(s.name)
      ? named("OPTIMIZA")
      : s.subcategory === "RECOVERY"
        ? named("RECOVERY")
        : s.subcategory === "GLOW"
          ? named("GLOW")
          : null;
  if (s.name === "SUPLE") {
    s.description =
      "Educación sobre productos por todos los canales y acceso a NOVOGEN Store.";
    s.action_url = "https://www.novogenstore.cl/";
    s.action_label = "Ver productos";
  }
}
demoServices.unshift({
  id: evaluationId,
  name: "Evaluación",
  category: "CHECK",
  description: "Conoce tu estado de salud de forma integral.",
  active: true,
  catalog_type: "group",
  parent_id: null,
});

export const demoLeads: Lead[] = [
  {
    id: "demo-1",
    name: "Contacto de ejemplo A",
    email: "contacto.a@example.com",
    phone: "",
    created_at: "2026-10-27T12:00:00Z",
    service_id: named("CHECK"),
    opportunities: [
      { id: "opp-1", stage: "new", next_action: "Primer contacto" },
    ],
  },
  {
    id: "demo-2",
    name: "Contacto de ejemplo B",
    email: "contacto.b@example.com",
    phone: "",
    created_at: "2026-10-26T12:00:00Z",
    service_id: named("BODY"),
    opportunities: [
      {
        id: "opp-2",
        stage: "contacted",
        next_action: "Enviar información comercial",
      },
    ],
  },
  {
    id: "demo-3",
    name: "Contacto de ejemplo C",
    email: "contacto.c@example.com",
    phone: "",
    created_at: "2026-10-25T12:00:00Z",
    service_id: named("COMPRENDE"),
    opportunities: [
      {
        id: "opp-3",
        stage: "qualified",
        next_action: "Coordinar siguiente contacto",
      },
    ],
  },
];
export const demoPoints: Point[] = [
  {
    id: "point-demo",
    code: "demo-recepcion",
    name: "Recepción · ejemplo",
    active: true,
  },
];
