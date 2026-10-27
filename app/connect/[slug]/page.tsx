import { TrackingConsent } from "@/components/tracking-consent";
import { DeviceAlerts } from "@/components/device-alerts";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Heart,
  Tag,
  Globe2,
  Instagram,
  MessageCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { ServiceInfo } from "@/components/service-info";
import { isConfigured, supabase } from "@/lib/supabase";
import { demoOrg, demoServices } from "@/lib/demo";
import type { Organization, Service } from "@/lib/domain";
import { submitLead } from "@/app/actions";
export const dynamic = "force-dynamic";
export default async function Flash({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string; point?: string; service?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const demo = !isConfigured();
  let org: Organization = demoOrg;
  let services: Service[] = demoServices;
  if (demo && slug !== "novogen") notFound();
  if (!demo) {
    const db = await supabase();
    const { data, error } = await db
      .from("organizations")
      .select("id,name,slug")
      .eq("slug", slug)
      .eq("published", true)
      .single();
    if (error) {
      if (error.code === "PGRST116") notFound();
      throw new Error("No se pudo conectar con el espacio comercial");
    }
    if (!data) notFound();
    org = data;
    const result = await db
      .from("services")
      .select("*")
      .eq("organization_id", org.id)
      .eq("active", true)
      .order("created_at");
    if (result.error) throw new Error("No se pudo cargar el catálogo");
    services = result.data ?? [];
  }
  const novogen = slug === "novogen";
  const selected = services.some((s) => s.id === query.service)
    ? query.service
    : "";
  const notices: Record<string, string> = {
    received:
      "Recibimos tu solicitud. El equipo podrá contactarte para orientarte.",
    error:
      "No pudimos recibir tu solicitud. Inténtalo más tarde; si ya enviaste una, evita repetirla.",
    invalid: "Revisa tus datos y acepta el contacto comercial.",
    demo: "Esta es una demostración. No se guardaron ni enviaron tus datos.",
  };
  return (
    <div className="novogen-flash">
      <div className="flash-stars" aria-hidden="true" />
      <main className="connect-experience">
        <header className="connect-brand">
          {novogen ? (
            <img
              src="/brand/novogen-connect.webp"
              alt="NOVOGEN CONNECT"
              width={200}
              height={138}
            />
          ) : (
            <h1>
              {org.name}
              <small>CONNECT</small>
            </h1>
          )}
          <Link href="/crm" className="team-access">
            Acceso equipo <ArrowUpRight size={13} />
          </Link>
        </header>
        {demo && (
          <div className="flash-demo">
            Demostración · No se guardan datos reales
          </div>
        )}
        <section className="connect-welcome">
          <div className="connect-orb" aria-hidden="true">
            <Globe2 size={112} strokeWidth={0.7} />
            <span />
          </div>
          <h1>
            ¿CÓMO PODEMOS
            <br />
            <em>AYUDARTE?</em>
          </h1>
          <nav className="connect-tiles" aria-label="Accesos FLASH">
            <a href="#contacto" className="connect-tile orient">
              <span className="tile-icon">
                <Compass size={40} />
              </span>
              <strong>ORIÉNTAME</strong>
              <span className="tile-arrow">
                <ArrowRight size={19} />
              </span>
            </a>
            <a href="#servicios" className="connect-tile">
              <span className="tile-icon">
                <Heart size={32} />
              </span>
              <strong>SERVICIOS</strong>
            </a>
            <a href="#promos" className="connect-tile">
              <span className="tile-icon">
                <Tag size={32} />
              </span>
              <strong>PROMOS</strong>
            </a>
          </nav>
          {novogen && (
            <>
              <div className="connect-social">
                <a
                  href="https://www.instagram.com/novogen.temuco"
                  aria-label="Instagram de NOVOGEN"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram size={24} />
                </a>
                <a
                  className="whatsapp"
                  data-connect-event="whatsapp_click"
                  href="https://wa.me/56944683094"
                  aria-label="WhatsApp de NOVOGEN"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={25} />
                </a>
                <a
                  href="mailto:novogen.temuco@gmail.com"
                  data-connect-event="email_click"
                  aria-label="Correo de NOVOGEN"
                >
                  @
                </a>
              </div>
              <a
                className="institution-button"
                data-connect-event="website_click"
                href="https://novogensalud.cl/"
                target="_blank"
                rel="noopener noreferrer"
              >
                IR A NOVOGEN <ArrowRight size={22} />
              </a>
            </>
          )}
          <p className="connect-credit">
            Una plataforma de <strong>SOLVEX</strong>
          </p>
        </section>
        <section id="servicios" className="connect-section">
          <span className="eyebrow">
            {novogen
              ? "EXPLORA NOVOGEN CONNECT"
              : `EXPLORA ${org.name} CONNECT`}
          </span>
          <h2>Encuentra tu próximo paso.</h2>
          <p>Conoce el catálogo y solicita información al equipo comercial.</p>
          <div className="connect-services">
            {services.map((s) => (
              <article key={s.id} className="connect-service">
                <span className="eyebrow">
                  {s.category}
                  {s.subcategory ? ` / ${s.subcategory}` : ""}
                </span>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <ServiceInfo
                  service={s}
                  contactHref={`?${new URLSearchParams({ service: s.id, ...(query.point ? { point: query.point } : {}) })}#contacto`}
                />
              </article>
            ))}
          </div>
          {!services.length && (
            <p>
              El catálogo se está preparando. Puedes solicitar orientación al
              equipo.
            </p>
          )}
        </section>
        <section id="promos" className="connect-section connect-promos">
          <Tag size={27} />
          <div>
            <h2>Promociones</h2>
            <p>
              No hay promociones publicadas. Consulta al equipo por las
              alternativas vigentes.
            </p>
          </div>
        </section>
        <section id="contacto" className="connect-section connect-contact">
          <div>
            <span className="eyebrow">EL PRIMER PASO ES CONVERSAR</span>
            <h2>Te ayudamos a conectar.</h2>
            <p>
              Déjanos tus datos y el servicio de tu interés. Esta solicitud
              llega al CRM comercial de {org.name}.
            </p>
            <div className="commercial-note">
              <ShieldCheck size={19} />
              <p>
                No incluyas diagnósticos, síntomas ni antecedentes clínicos. El
                envío no constituye una reserva ni un pago.
              </p>
            </div>
            {novogen && (
              <p className="connect-address">
                <MapPin size={18} /> Trizano 443, Box 6 · Temuco, Chile
              </p>
            )}
          </div>
          <div className="connect-form">
            {query.notice && notices[query.notice] && (
              <div role="status" className="notice">
                {notices[query.notice]}
              </div>
            )}
            <DeviceAlerts
              endpoint={`/api/contact-status?slug=${slug}`}
              title="Actualizaciones de tu solicitud"
            />
            <form action={submitLead} className="stack-form">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="point" value={query.point ?? ""} />
              <div className="honeypot" aria-hidden="true">
                <label>
                  Dejar vacío
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <label>
                Nombre
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                Correo electrónico
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Teléfono <small>(opcional)</small>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  pattern="[+0-9 ()\-]*"
                />
              </label>
              <label>
                ¿Qué te interesa?
                <select name="service" defaultValue={selected} key={selected}>
                  <option value="">Necesito orientación</option>
                  {services.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de consulta
                <select name="request_type">
                  <option value="information">Información comercial</option>
                  <option value="subscription">
                    Suscripciones y seguimiento
                  </option>
                  <option value="human">Quiero hablar con una persona</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="consent" required />
                <span>
                  Autorizo a {org.name} a contactarme sobre esta solicitud. Mis
                  datos se usarán para su seguimiento comercial.
                </span>
              </label>
              <p className="fine-print">
                Puedes solicitar la eliminación de tu contacto a través de los
                canales institucionales.
              </p>
              <button className="institution-button">
                {demo
                  ? "Probar formulario de demostración"
                  : "Solicitar contacto"}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </section>
        <TrackingConsent slug={slug} point={query.point} />
        <footer className="connect-footer">
          <span>CONNECT · SOLVEX</span>
          <Link href="/crm">
            {demo ? "Explorar CRM de demostración" : "Acceso al CRM"}
          </Link>
        </footer>
      </main>
    </div>
  );
}
