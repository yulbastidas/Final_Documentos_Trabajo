'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty-state" role="alert">
      <p className="eyebrow">NO SE PUDO MOSTRAR EL PANEL</p>
      <h1>Inténtalo de nuevo.</h1>
      <p className="muted">
        No se envió ni guardó información de esta demostración. Puedes
        reintentar o volver al inicio.
      </p>
      <button className="button" onClick={reset}>
        Reintentar
      </button>
      <a className="text-link" href="/">
        Volver al inicio
      </a>
    </section>
  );
}
