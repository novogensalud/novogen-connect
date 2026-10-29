import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { OrientationSourceManager } from "@/components/orientame-source-manager";
import type { StoredOrientationSource } from "@/lib/orientame-sources";
export const dynamic = "force-dynamic";
export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const params = await searchParams,
    demo = !isConfigured();
  let org = "demo",
    ready = demo,
    sources: StoredOrientationSource[] = [];
  if (!demo) {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect("/login");
    let q = db
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "admin");
    if (params.org) q = q.eq("organization_id", params.org);
    const { data: m, error } = await q.limit(1).maybeSingle();
    if (error || !m)
      return (
        <main className="empty">
          <h1>Solo los administradores gestionan las fuentes</h1>
          <Link href="/crm">Volver al CRM</Link>
        </main>
      );
    org = m.organization_id;
    const result = await db
      .from("orientame_sources")
      .select("key,title,type,url,content,status,updated_at")
      .eq("organization_id", org)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (result.error) {
      if (!["42P01", "PGRST205"].includes(result.error.code))
        return (
          <main className="empty">
            <h1>No se pudieron cargar las fuentes</h1>
            <Link href={`/crm/orientame?org=${org}`}>Reintentar</Link>
          </main>
        );
      ready = false;
    } else sources = (result.data ?? []) as StoredOrientationSource[];
  }
  return (
    <main className="sources-page">
      <header>
        <span className="eyebrow">CONNECT / BASE DE CONOCIMIENTO</span>
        <h1>Fuentes de ORIÉNTAME</h1>
        <p>
          Documentos y enlaces organizados para preparar las respuestas de
          orientación.
        </p>
        <Link className="inline-link" href={`/crm?org=${org}`}>
          ← Volver al CRM
        </Link>
      </header>
      <div className="notice">
        Esta biblioteca gestiona referencias. Revisar una fuente no activa
        respuestas automáticas ni publica su contenido en FLASH. Los enlaces se
        guardan como referencia; no se descarga su contenido automáticamente.
      </div>
      {demo && (
        <p className="notice">
          Demostración sin fuentes ficticias. La descarga de plantilla está
          disponible; guardar requiere conexión.
        </p>
      )}
      {!ready && (
        <p className="notice">
          Para activar la biblioteca ejecuta una vez la{" "}
          <a
            href="https://github.com/novogensalud/novogen-connect/blob/feature/connect-crm/supabase/migrations/202610290007_orientame_sources.sql"
            target="_blank"
            rel="noopener noreferrer"
          >
            migración 007
          </a>
          . No repitas las anteriores.
        </p>
      )}
      {params.notice && (
        <p role="status" className="notice">
          {params.notice === "saved"
            ? "Fuentes guardadas. Revisa su contenido antes de marcarlas como revisadas."
            : params.notice === "reviewed"
              ? "Estado actualizado."
              : "No se pudo guardar. Revisa el archivo, los campos y el límite de la biblioteca."}
        </p>
      )}
      <OrientationSourceManager
        org={org}
        sources={sources}
        disabled={demo || !ready}
      />
    </main>
  );
}
