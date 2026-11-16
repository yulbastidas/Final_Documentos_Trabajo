import Link from 'next/link';
import { DEMO_ENABLED } from '../../lib/demo';
import { Header } from '../../components/header';
export default function Page() {
  return (
    <>
      <Header />
      <main className="state-page">
        <p className="eyebrow">VISTA PREVIA · ESTADO 403</p>
        <h1>Este acceso requiere autorización.</h1>
        <p>
          Esta pantalla representa el mensaje que acompañará una denegación del
          servidor. No se ha evaluado ningún permiso real en esta demostración.
        </p>
        <div className="button-row">
          <Link
            className="button"
            href={DEMO_ENABLED ? '/dashboard' : '/portal'}
          >
            {DEMO_ENABLED ? 'Volver a la demo' : 'Ir al portal'}
          </Link>
          <Link className="secondary-button" href="/login">
            Ir al acceso
          </Link>
        </div>
      </main>
    </>
  );
}
