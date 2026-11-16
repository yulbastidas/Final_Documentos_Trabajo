import Link from 'next/link';
import { DEMO_ENABLED } from '../../lib/demo';
import { Header } from '../../components/header';
export default function Page() {
  return (
    <>
      <Header />
      <main className="state-page">
        <p className="eyebrow">VISTA PREVIA · ESTADO 401</p>
        <h1>Es momento de volver a identificarte.</h1>
        <p>
          Este es el estado visual previsto para una sesión expirada. La
          demostración no crea sesiones reales ni mide su caducidad.
        </p>
        <div className="button-row">
          <Link className="button" href="/login">
            Volver al acceso
          </Link>
          <Link
            className="secondary-button"
            href={DEMO_ENABLED ? '/dashboard' : '/portal'}
          >
            {DEMO_ENABLED ? 'Explorar demostración' : 'Ir al portal'}
          </Link>
        </div>
      </main>
    </>
  );
}
