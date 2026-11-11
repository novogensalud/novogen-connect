"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty">
      <h1>No pudimos cargar este espacio.</h1>
      <p>
        Inténtalo nuevamente. Si el problema continúa, contacta con el
        administrador.
      </p>
      <button className="button primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
