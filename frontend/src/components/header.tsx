import Link from 'next/link';
export function Header() {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-7">
      <Link className="text-xl font-bold tracking-tight" href="/">
        ◈ Secure<span className="text-emerald-300">Docs</span>
      </Link>
      <nav
        aria-label="Navegación principal"
        className="flex gap-6 text-sm text-slate-300"
      >
        <Link href="/#arquitectura">Arquitectura</Link>
        <Link href="/portal">Acceso</Link>
      </nav>
    </header>
  );
}
