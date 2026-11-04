'use client';
import Link from 'next/link';
import { useDemo } from './demo-provider';
import { PageHeading, Stat } from '../ui/primitives';
import { Icon } from '../ui/icon';
import { formatBytes, formatDate } from '../../lib/presentation';
export function Overview() {
  const { documents, events } = useDemo();
  return (
    <>
      <PageHeading
        eyebrow="TU ESPACIO DOCUMENTAL"
        title="Todo en un solo lugar."
        description="Explora los flujos de SecureDocs con información de ejemplo."
        action={
          <Link className="button" href="/dashboard/documentos">
            <Icon name="plus" />
            Gestionar documentos
          </Link>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Documentos de ejemplo"
          value={documents.length}
          note="Metadatos de la demostración"
          icon="file"
        />
        <Stat
          label="Volumen representado"
          value={formatBytes(documents.reduce((total, d) => total + d.size, 0))}
          note="No ocupa almacenamiento real"
          icon="chart"
        />
        <Stat
          label="Eventos de ejemplo"
          value={events.length}
          note="Actividad local y datos sintéticos"
          icon="activity"
        />
        <Stat
          label="Integración del servidor"
          value="Pendiente"
          note="La API solo implementa salud"
          icon="shield"
        />
      </div>
      <div className="dashboard-columns">
        <section className="surface">
          <div className="section-heading">
            <h2>Documentos recientes</h2>
            <Link className="text-link" href="/dashboard/documentos">
              Ver todos →
            </Link>
          </div>
          <div className="document-list">
            {documents.slice(0, 4).map((d) => (
              <Link
                className="document-row"
                key={d.id}
                href="/dashboard/documentos"
              >
                <span className="file-icon">
                  <Icon name="file" />
                </span>
                <div className="grow">
                  <strong>{d.title}</strong>
                  <p>
                    {d.category} · {formatBytes(d.size)}
                  </p>
                </div>
                <span className="small muted">{formatDate(d.updatedAt)}</span>
              </Link>
            ))}
          </div>
          {documents.length === 0 && (
            <p className="muted">No hay documentos en esta demostración.</p>
          )}
        </section>
        <section className="surface roadmap-card">
          <p className="eyebrow">PRÓXIMO PASO</p>
          <h2>Una interfaz lista para conectar.</h2>
          <p className="muted">
            Los formularios y estados están preparados. Los controles de
            seguridad dependen de la API y la infraestructura del equipo.
          </p>
          <ul className="check-list">
            <li>
              <Icon name="check" />
              Flujos de identidad y MFA
            </li>
            <li>
              <Icon name="check" />
              Experiencia documental
            </li>
            <li>
              <Icon name="check" />
              Auditoría y reportes visuales
            </li>
          </ul>
          <Link className="text-link" href="/dashboard/ayuda">
            Ver alcance y guía →
          </Link>
        </section>
      </div>
      <section className="surface mt-section">
        <div className="section-heading">
          <h2>Actividad de demostración</h2>
          <Link className="text-link" href="/dashboard/auditoria">
            Explorar eventos →
          </Link>
        </div>
        {events.slice(0, 3).map((e) => (
          <div className="activity-row" key={e.id}>
            <span
              className={`activity-dot ${e.result === 'Denegado' ? 'red' : ''}`}
            />
            <div className="grow">
              <strong>{e.action}</strong>
              <p>
                {e.actor} · {e.resource}
              </p>
            </div>
            <span
              className={`badge ${e.result === 'Denegado' ? 'badge-red' : ''}`}
            >
              {e.result}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
