import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { demoOrg } from "@/lib/demo";
import { configureTeamSeat, expandTeamPlan } from "@/app/actions";
export const dynamic = "force-dynamic";
type Seat = {
  seat_number: number;
  display_name: string;
  email: string;
  role: string;
  user_id: string | null;
};
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const params = await searchParams,
    demo = !isConfigured();
  let org = demoOrg.id,
    capacity = 5,
    ready = demo;
  let seats: Seat[] = Array.from({ length: 5 }, (_, i) => ({
    seat_number: i + 1,
    display_name: i === 0 ? "Administrador" : `Comercial ${i}`,
    email: "",
    role: i === 0 ? "admin" : "agent",
    user_id: null,
  }));
  if (!demo) {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect("/login");
    let q = db
      .from("memberships")
      .select("organization_id,role")
      .eq("user_id", user.id)
      .eq("role", "admin");
    if (params.org) q = q.eq("organization_id", params.org);
    const { data: member, error } = await q.limit(1).maybeSingle();
    if (error || !member)
      return (
        <main className="empty">
          <h1>Acceso exclusivo para administradores</h1>
          <Link href="/crm">Volver al CRM</Link>
        </main>
      );
    org = member.organization_id;
    const initialized = await db.rpc("ensure_team_plan", { p_org: org });
    ready = !initialized.error;
    if (ready) {
      const [p, s] = await Promise.all([
        db
          .from("team_plans")
          .select("seat_limit")
          .eq("organization_id", org)
          .single(),
        db
          .from("team_seats")
          .select("seat_number,display_name,email,role,user_id")
          .eq("organization_id", org)
          .order("seat_number"),
      ]);
      if (p.error || s.error)
        return (
          <main className="empty">
            <h1>No se pudieron cargar los cupos</h1>
            <Link href={`/crm/accesos?org=${org}`}>Reintentar</Link>
          </main>
        );
      capacity = p.data.seat_limit;
      seats = s.data;
    }
  }
  const disabled = demo || !ready;
  return (
    <main className="access-page">
      <header>
        <span className="eyebrow">CONNECT / ADMINISTRACIÓN</span>
        <h1>Tu equipo, a tu medida.</h1>
        <p>
          Cinco cupos iniciales: un administrador y cuatro comerciales. Puedes
          ampliarlos cuando lo necesites.
        </p>
        <Link className="inline-link" href={`/crm?org=${org}`}>
          ← Volver al CRM
        </Link>
      </header>
      {demo && (
        <p className="notice">Demostración. Los cambios no se guardan.</p>
      )}
      {!ready && (
        <p className="notice">
          Activa la{" "}
          <a
            href="https://github.com/novogensalud/novogen-connect/blob/feature/connect-crm/supabase/migrations/202610280006_team_seats.sql"
            target="_blank"
            rel="noopener noreferrer"
          >
            migración 006
          </a>{" "}
          para guardar y ampliar los cupos. No repitas las migraciones
          anteriores.
        </p>
      )}
      {params.notice && (
        <p role="status" className="notice">
          {params.notice === "saved"
            ? "Configuración guardada."
            : "No se pudo guardar. Revisa nombres, correos únicos y que exista un administrador."}
        </p>
      )}
      <section className="access-summary">
        <article>
          <strong>{capacity}</strong>
          <span>Cupos configurados</span>
        </article>
        <article>
          <strong>{ready ? seats.filter((s) => s.user_id).length : "—"}</strong>
          <span>Cuentas vinculadas</span>
        </article>
        <article>
          <strong>
            {ready ? seats.filter((s) => !s.user_id).length : "—"}
          </strong>
          <span>Cupos sin cuenta vinculada</span>
        </article>
      </section>
      <div className="notice">
        Reservar un cupo no crea un buzón de correo ni una cuenta de ingreso.
        Las cuentas nuevas deberán crearse o invitarse y recibir su membresía
        antes de poder entrar. Las cuentas vinculadas se conservan.
      </div>
      <section className="access-seats" aria-label="Cupos del equipo">
        {seats.map((s) => (
          <article className="panel" key={s.seat_number}>
            <div className="access-seat-heading">
              <h2>Cupo {s.seat_number}</h2>
              <span className="service-tag">
                {s.user_id ? "Cuenta vinculada" : s.email ? "Reservado" : "Por configurar"}
              </span>
            </div>
            <form action={configureTeamSeat} className="stack-form">
              <input type="hidden" name="org" value={org} />
              <input type="hidden" name="seat" value={s.seat_number} />
              <label>
                Nombre
                <input
                  name="display_name"
                  defaultValue={s.display_name}
                  minLength={2}
                  maxLength={100}
                  required
                  disabled={disabled}
                />
              </label>
              <label>
                Correo previsto
                <input
                  name="email"
                  type="email"
                  defaultValue={s.email}
                  maxLength={254}
                  readOnly={!!s.user_id}
                  disabled={disabled}
                  placeholder="Completar cuando esté definido"
                />
              </label>
              <label>
                Rol
                <select
                  name="role"
                  defaultValue={s.role}
                  disabled={disabled || !!s.user_id}
                >
                  <option value="admin">Administrador</option>
                  <option value="agent">Comercial</option>
                </select>
                {s.user_id && (
                  <input type="hidden" name="role" value={s.role} />
                )}
              </label>
              <button className="button primary" disabled={disabled}>
                Guardar cupo {s.seat_number}
              </button>
            </form>
          </article>
        ))}
      </section>
      <section className="panel form-panel">
        <h2>Ampliar el equipo</h2>
        <p>
          La ampliación configura espacio en CONNECT; no contrata correos ni
          servicios externos.
        </p>
        <form action={expandTeamPlan} className="edit-form">
          <input type="hidden" name="org" value={org} />
          <label>
            Total de cupos
            <input
              type="number"
              name="seat_limit"
              min={capacity}
              max={100}
              defaultValue={capacity}
              required
              disabled={disabled}
            />
          </label>
          <button className="button primary" disabled={disabled}>
            Ampliar cupos
          </button>
        </form>
      </section>
    </main>
  );
}
