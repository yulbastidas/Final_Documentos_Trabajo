'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { checkApiHealth } from '../../lib/api/health';
import { PageHeading, Notice } from '../ui/primitives';
import { Icon, type IconName } from '../ui/icon';
const controls: {
  title: string;
  icon: IconName;
  description: string;
  owner: string;
}[] = [
  {
    title: 'Identidad y MFA',
    icon: 'users',
    description:
      'Formularios listos. Sesión, IAM, desafíos y verificación MFA pendientes del servidor.',
    owner: 'Jacobo · Fase 1',
  },
  {
    title: 'Cifrado e integridad',
    icon: 'lock',
    description:
      'Estados de información preparados. AES-256-GCM, claves y hashing pendientes del servidor.',
    owner: 'Jacobo · Fase 2',
  },
  {
    title: 'Transporte y hardening',
    icon: 'shield',
    description:
      'Cabeceras básicas de frontend configuradas. HTTPS, proxy y políticas finales pendientes de infraestructura.',
    owner: 'Jerónimo · Fase 3',
  },
  {
    title: 'DevSecOps y escaneos',
    icon: 'activity',
    description:
      'Sin resultados de CI o Trivy conectados. Esta pantalla no ejecuta escaneos ni representa un pipeline aprobado.',
    owner: 'Jerónimo · Fase 4',
  },
];
export function SecurityCenter() {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>(
    'idle',
  );
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState('loading');
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await checkApiHealth(controller.signal);
      if (!controller.signal.aborted) setState('ok');
      else setState('error');
    } catch {
      setState('error');
    } finally {
      clearTimeout(timeout);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="PROTECCIÓN Y ESTADO · FASES 1–4"
        title="Centro de seguridad."
        description="Distingue las interfaces disponibles de los controles pendientes de integrar."
      />
      <section className="surface connection-card">
        <div>
          <div className="section-heading">
            <h2>Disponibilidad de la API</h2>
            <span
              className={`badge ${state === 'error' ? 'badge-red' : state === 'ok' ? '' : 'badge-amber'}`}
            >
              {state === 'idle'
                ? 'Sin comprobar'
                : state === 'loading'
                  ? 'Comprobando…'
                  : state === 'ok'
                    ? 'Proceso disponible'
                    : 'No disponible'}
            </span>
          </div>
          <p className="muted">
            Consulta real al único endpoint implementado: GET /api/v1/health. No
            envía credenciales ni comprueba MySQL, autenticación o cifrado.
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={state === 'loading'}
          onClick={check}
        >
          {state === 'loading' ? 'Comprobando…' : 'Comprobar API'}
        </button>
      </section>
      <div aria-live="polite" className="mt-section">
        {state === 'ok' && (
          <Notice kind="success">
            La API responde al contrato de salud. Los controles de seguridad
            siguen pendientes de implementación.
          </Notice>
        )}
        {state === 'error' && (
          <Notice kind="error">
            No fue posible comprobar la API. Revisa que el backend esté iniciado
            y que NEXT_PUBLIC_API_URL y CORS coincidan con el entorno. Puedes
            reintentar.
          </Notice>
        )}
      </div>
      <div className="security-grid">
        {controls.map((control) => (
          <section className="surface" key={control.title}>
            <div className="section-heading">
              <span className="file-icon">
                <Icon name={control.icon} />
              </span>
              <span className="badge badge-amber">Integración pendiente</span>
            </div>
            <h2>{control.title}</h2>
            <p className="muted">{control.description}</p>
            <p className="small ownership">{control.owner}</p>
          </section>
        ))}
      </div>
      <section className="surface mt-section">
        <h2>Estados de experiencia de usuario</h2>
        <p className="muted">
          Previsualiza mensajes que acompañarán las respuestas del servidor.
        </p>
        <div className="button-row">
          <Link className="secondary-button" href="/sesion-expirada">
            Sesión expirada
          </Link>
          <Link className="secondary-button" href="/acceso-denegado">
            Acceso denegado
          </Link>
          <Link className="secondary-button" href="/mfa">
            Segundo factor
          </Link>
        </div>
      </section>
    </>
  );
}
