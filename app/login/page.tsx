import Link from "next/link";
import { signIn } from "../actions";
import { isConfigured } from "@/lib/supabase";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-page">
      <Link href="/" className="wordmark">
        connect<span>®</span>
        <small>by SOLVEX</small>
      </Link>
      <section className="panel login-card">
        <span className="eyebrow">TU ESPACIO COMERCIAL</span>
        <h1>Qué bueno verte.</h1>
        <p>Ingresa con tu cuenta de organización.</p>
        {error && (
          <div role="alert" className="notice">
            {error === "config"
              ? "Configura Supabase para iniciar sesión."
              : "No se pudo iniciar sesión. Revisa tus credenciales o inténtalo más tarde."}
          </div>
        )}
        <form action={signIn} className="stack-form">
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              maxLength={254}
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              maxLength={128}
            />
          </label>
          <button className="button primary" disabled={!isConfigured()}>
            Ingresar
          </button>
        </form>
        <p className="fine-print">
          Las cuentas y sus permisos son asignados por el administrador. Si
          necesitas recuperar el acceso, contacta con él.
        </p>
        {!isConfigured() && <Link href="/crm">Explorar demostración →</Link>}
      </section>
      <span className="fine-print">SOLVEX · CONNECT</span>
    </main>
  );
}
