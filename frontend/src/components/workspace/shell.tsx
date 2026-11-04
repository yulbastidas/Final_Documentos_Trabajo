'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '../ui/icon';
import { DemoProvider, useDemo } from './demo-provider';
import type { Role } from '../../lib/types';
const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Vista general', icon: 'grid' },
  { href: '/dashboard/documentos', label: 'Documentos', icon: 'file' },
  { href: '/dashboard/usuarios', label: 'Usuarios y roles', icon: 'users' },
  {
    href: '/dashboard/seguridad',
    label: 'Centro de seguridad',
    icon: 'shield',
  },
  { href: '/dashboard/auditoria', label: 'Auditoría', icon: 'activity' },
  { href: '/dashboard/reportes', label: 'Reportes', icon: 'chart' },
  { href: '/dashboard/laboratorios', label: 'Laboratorios', icon: 'lab' },
  { href: '/dashboard/ayuda', label: 'Guía del proyecto', icon: 'help' },
];
function ShellContent({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { role, setRole, reset } = useDemo();
  const mobileNav = useRef<HTMLDetailsElement>(null);
  const active =
    navigation.find((item) => item.href === path)?.label ?? 'SecureDocs';
  function links() {
    return navigation.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className={`nav-link ${path === item.href ? 'active' : ''}`}
        aria-current={path === item.href ? 'page' : undefined}
        onClick={() => mobileNav.current?.removeAttribute('open')}
      >
        <Icon name={item.icon} />
        {item.label}
      </Link>
    ));
  }
  return (
    <div className="workspace">
      <a href="#workspace-main" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          ◈ Secure<span>Docs</span>
        </Link>
        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación del panel">{links()}</nav>
        <div className="sidebar-bottom">
          <div className="avatar">YU</div>
          <div>
            <strong>Yuly Demo</strong>
            <p>Entorno de presentación</p>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="breadcrumb">
            SecureDocs <span>/</span> <strong>{active}</strong>
          </div>
          <Link className="text-link" href="/login" onClick={reset}>
            Salir de la demo ↗
          </Link>
        </header>
        <details className="mobile-nav" ref={mobileNav}>
          <summary>
            <Icon name="menu" />
            Navegación del panel
          </summary>
          <nav aria-label="Navegación móvil">{links()}</nav>
        </details>
        <div className="demo-banner">
          <div>
            <strong>DEMOSTRACIÓN</strong>
            <span>
              Datos ficticios en memoria. Sin autenticación, cifrado ni
              auditoría reales.
            </span>
          </div>
          <label className="role-picker">
            Vista de rol
            <select
              aria-label="Vista de rol"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {['Administrador', 'Colaborador', 'Lector'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <main id="workspace-main" className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>SecureDocs · Proyecto universitario</span>
          <span>Interfaz: Yuly · Integración del servidor pendiente</span>
        </footer>
      </div>
    </div>
  );
}
export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <ShellContent>{children}</ShellContent>
    </DemoProvider>
  );
}
