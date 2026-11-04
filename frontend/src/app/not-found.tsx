import Link from 'next/link';
import { Header } from '../components/header';
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="state-page">
        <p className="eyebrow">ERROR 404</p>
        <h1>No encontramos esta página.</h1>
        <p>Revisa la dirección o vuelve al inicio de SecureDocs.</p>
        <div className="button-row">
          <Link className="button" href="/">
            Volver al inicio
          </Link>
        </div>
      </main>
    </>
  );
}
