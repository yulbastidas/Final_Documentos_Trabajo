'use client';
import { useState } from 'react';
import { useDemo } from './demo-provider';
import { PageHeading, EmptyState, Notice } from '../ui/primitives';
import { formatDate } from '../../lib/presentation';
export function Audit() {
  const { events } = useDemo();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('Todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const invalid = !!(from && to && from > to);
  const filtered = events.filter(
    (e) =>
      !invalid &&
      (e.action + ' ' + e.resource + ' ' + e.actor)
        .toLocaleLowerCase('es')
        .includes(query.toLocaleLowerCase('es')) &&
      (result === 'Todos' || result === e.result) &&
      (!from || e.at.slice(0, 10) >= from) &&
      (!to || e.at.slice(0, 10) <= to),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  return (
    <>
      <PageHeading
        eyebrow="TRAZABILIDAD · FASE 6"
        title="Cada acción, en contexto."
        description="Explora eventos sintéticos y acciones locales de la demostración."
      />
      <Notice>
        Este registro no es una auditoría de seguridad: vive en memoria, se
        reinicia al recargar y no acredita actividad real del servidor.
      </Notice>
      <section className="surface mt-section">
        <div className="toolbar audit-toolbar">
          <label className="filter-field grow">
            <span>Buscar evento, persona o recurso</span>
            <input
              value={query}
              placeholder="Buscar actividad…"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>Resultado</span>
            <select
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setPage(1);
              }}
            >
              {['Todos', 'Permitido', 'Denegado'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Desde (UTC)</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>Hasta (UTC)</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {invalid && (
          <Notice kind="error">
            La fecha inicial debe ser anterior o igual a la fecha final.
          </Notice>
        )}
        {filtered.length ? (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Eventos de demostración"
            >
              <table>
                <caption className="sr-only">
                  Eventos sintéticos de auditoría
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Evento</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Recurso</th>
                    <th scope="col">Fecha (Bogotá)</th>
                    <th scope="col">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((current - 1) * 10, current * 10).map((e) => (
                    <tr key={e.id}>
                      <td>{e.action}</td>
                      <td>{e.actor}</td>
                      <td>{e.resource}</td>
                      <td>{formatDate(e.at)}</td>
                      <td>
                        <span
                          className={`badge ${e.result === 'Denegado' ? 'badge-red' : ''}`}
                        >
                          {e.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {filtered.length} eventos · Página {current} de {pages}
              </span>
              <div>
                <button
                  className="secondary-button"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  Anterior
                </button>
                <button
                  className="secondary-button"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No hay eventos para estos filtros"
            description="Ajusta el texto, el resultado o el intervalo de fechas."
            action={
              <button
                className="secondary-button"
                onClick={() => {
                  setQuery('');
                  setResult('Todos');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
              >
                Limpiar filtros
              </button>
            }
          />
        )}
      </section>
    </>
  );
}
