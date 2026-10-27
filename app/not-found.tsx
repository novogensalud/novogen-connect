import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty">
      <span className="eyebrow">CONNECT</span>
      <h1>Este espacio no está disponible.</h1>
      <p>Comprueba el enlace o consulta con la organización.</p>
      <Link href="/" className="button primary">
        Ir al inicio
      </Link>
    </main>
  );
}
