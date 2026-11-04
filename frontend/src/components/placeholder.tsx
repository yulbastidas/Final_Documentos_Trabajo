import Link from 'next/link';
import { Header } from './header';
export function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-24">
        <p className="eyebrow">RUTA PREPARADA · FASE 0</p>
        <h1 className="mt-5 text-4xl font-bold">{title}</h1>
        <p className="mt-6 text-slate-300">
          {description} Esta pantalla no ofrece funcionalidades ni acceso a
          información real.
        </p>
        <Link className="button mt-8 inline-block" href="/">
          Volver al inicio →
        </Link>
      </main>
    </>
  );
}
