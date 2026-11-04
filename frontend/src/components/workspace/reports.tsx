'use client';
import { useState } from 'react';
import { useDemo } from './demo-provider';
import { PageHeading, Stat, Notice } from '../ui/primitives';
import { Icon } from '../ui/icon';
import { formatBytes, reportCsv, saveDownload } from '../../lib/presentation';
export function Reports() {
  const { documents, events, role } = useDemo();
  const [category, setCategory] = useState('Todas');
  const [message, setMessage] = useState('');
  const data = documents.filter(
    (d) => category === 'Todas' || category === d.category,
  );
  const total = data.reduce((n, d) => n + d.size, 0);
  const canExport = role === 'Administrador';
  return (
    <>
      <PageHeading
        eyebrow="REPORTES E INTEGRACIÓN · FASE 6"
        title="Información para decidir."
        description="Resumen de los datos de demostración, con exportación local."
        action={
          <div className="button-row no-print">
            <button
              className="secondary-button"
              disabled={!canExport}
              onClick={() => window.print()}
            >
              Imprimir muestra
            </button>
            <button
              className="button"
              disabled={!canExport}
              onClick={() => {
                saveDownload(
                  reportCsv(data, events),
                  'securedocs-reporte-DEMO.csv',
                  'text/csv;charset=utf-8',
                );
                setMessage(
                  'Reporte sintético exportado como CSV. No contiene evidencia de auditoría real.',
                );
              }}
            >
              <Icon name="download" />
              Exportar CSV demo
            </button>
          </div>
        }
      />
      <Notice>
        REPORTE DE DEMOSTRACIÓN. Información sintética y temporal; no representa
        documentos almacenados ni controles verificados.
      </Notice>
      {message && <Notice kind="success">{message}</Notice>}
      {!canExport && (
        <p className="muted small mt-section">
          La exportación está disponible solo en la vista de Administrador. Es
          una restricción visual, no una política del servidor.
        </p>
      )}
      <section className="surface mt-section no-print">
        <label className="filter-field">
          <span>Clasificación del reporte documental</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {['Todas', 'Interno', 'Confidencial', 'Restringido'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </section>
      <div className="stats-grid mt-section">
        <Stat
          label="Documentos en el filtro"
          value={data.length}
          note={`Clasificación: ${category}`}
          icon="file"
        />
        <Stat
          label="Volumen representado"
          value={formatBytes(total)}
          note="Sin almacenamiento real"
          icon="chart"
        />
        <Stat
          label="Eventos sintéticos"
          value={events.length}
          note="Todos los eventos de la demo"
          icon="activity"
        />
        <Stat
          label="Resultados denegados"
          value={events.filter((e) => e.result === 'Denegado').length}
          note="Ejemplos, no detecciones reales"
          icon="shield"
        />
      </div>
      <section className="surface mt-section">
        <h2>Distribución documental</h2>
        <p className="muted small">Conteos sobre el filtro seleccionado.</p>
        <div className="chart-bars">
          {['Interno', 'Confidencial', 'Restringido'].map((c) => {
            const count = data.filter((d) => d.category === c).length;
            return (
              <div className="bar-row" key={c}>
                <div>
                  <span>{c}</span>
                  <strong>{count}</strong>
                </div>
                <meter
                  min={0}
                  max={Math.max(data.length, 1)}
                  value={count}
                  aria-label={`${c}: ${count} documentos`}
                />
              </div>
            );
          })}
        </div>
      </section>
      <section className="surface mt-section">
        <h2>Alcance del informe</h2>
        <p className="muted">
          El CSV incluye metadatos del filtro y todos los eventos de ejemplo. No
          exporta contraseñas, claves ni archivos originales. Los valores que
          podrían interpretarse como fórmulas se neutralizan para su apertura en
          hojas de cálculo.
        </p>
        <p className="muted">
          Para la presentación final, reemplazar estas muestras por reportes
          autorizados del backend y documentar las pruebas de integración del
          equipo.
        </p>
      </section>
    </>
  );
}
