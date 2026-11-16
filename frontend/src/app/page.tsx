import Link from 'next/link';
import { DEMO_ENABLED } from '../lib/demo';
import { Header } from '../components/header';
const capabilities = [
  [
    '01',
    'Identidad y acceso',
    'Contraseñas con Argon2id, MFA TOTP, sesiones revocables y permisos por rol verificados en el servidor.',
  ],
  [
    '02',
    'Confidencialidad',
    'Cada documento se cifra con AES-256-GCM y una clave propia; la huella SHA-256 detecta cualquier alteración.',
  ],
  [
    '03',
    'Trazabilidad',
    'Inicios de sesión, cargas, descargas y denegaciones quedan en una auditoría con reportes exportables.',
  ],
];
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="eyebrow">SEGURIDAD DESDE EL DISEÑO</p>
            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Tu información.
              <br />
              <span className="text-emerald-300">Bajo control.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300">
              Una base para gestionar documentos confidenciales con identidad,
              protección y trazabilidad.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link className="button" href="/portal">
                Abrir portal →
              </Link>
              {DEMO_ENABLED && (
                <Link className="secondary-button" href="/dashboard">
                  Explorar demostración →
                </Link>
              )}
              <a
                className="rounded-lg border border-slate-600 px-5 py-3"
                href="#arquitectura"
              >
                Ver arquitectura
              </a>
            </div>
            <p className="mt-6 text-xs text-slate-400">
              PROYECTO ACADÉMICO · USA SOLO DATOS SINTÉTICOS
            </p>
          </div>
          <aside aria-label="Estado del proyecto" className="panel p-8">
            <div className="flex justify-between text-xs text-slate-400">
              <span>SECUREDOCS / SISTEMA</span>
              <span className="text-emerald-300">PORTAL CONECTADO</span>
            </div>
            <div
              aria-hidden="true"
              className="my-10 text-center text-8xl text-emerald-300"
            >
              ◈
            </div>
            <h2 className="text-2xl font-semibold">
              Construido para la confianza
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              Seguridad en cada capa: identidad, cifrado, proxy endurecido y
              análisis automáticos en cada cambio.
            </p>
            <div className="mt-8 border-t border-slate-700 pt-5 text-sm text-slate-300">
              Interfaz / API / Infraestructura
            </div>
          </aside>
        </section>
        <section id="arquitectura" className="mx-auto max-w-6xl px-6 py-16">
          <p className="eyebrow">UNA ARQUITECTURA, TRES FRENTES</p>
          <h2 className="mt-4 text-3xl font-bold">Protección en cada paso</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {capabilities.map(([n, title, description]) => (
              <article key={n} className="panel p-7">
                <span className="font-mono text-sm text-emerald-300">/{n}</span>
                <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl border-t border-slate-800 px-6 py-8 text-sm text-slate-400">
        SecureDocs · Sistemas de Comunicación y Seguridad Informática
        <br />
        Yuly · Jacobo · Jerónimo
      </footer>
    </>
  );
}
