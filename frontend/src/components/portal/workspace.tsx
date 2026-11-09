'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { PageHeading, Notice } from '../ui/primitives';
import { Modal } from '../ui/modal';
import {
  csvCell,
  formatBytes,
  formatDate,
  saveDownload,
} from '../../lib/presentation';
import type {
  DocumentRecord,
  EventRecord,
  Page,
  Summary,
  User,
} from '../../lib/api/portal';
import { AccountSecurity } from './account-security';

export type PortalRequest = <T>(
  path: string,
  options?: RequestInit,
) => Promise<T>;
type Tab = 'documents' | 'users' | 'audit-events' | 'reports' | 'account';
const classifications: Record<string, string> = {
  internal: 'Interno',
  confidential: 'Confidencial',
  restricted: 'Restringido',
};
const roles = {
  admin: 'Administrador',
  editor: 'Colaborador',
  reader: 'Lector',
};
const labels: Record<Tab, string> = {
  documents: 'Documentos',
  users: 'Usuarios',
  'audit-events': 'Auditoría',
  reports: 'Reportes',
  account: 'Mi seguridad',
};
const required: Partial<Record<Tab, string>> = {
  documents: 'documents:read',
  users: 'users:read',
  'audit-events': 'audit:read',
  reports: 'reports:read',
};
type Resource = Page<DocumentRecord> | Page<User> | Page<EventRecord> | Summary;
type Props = {
  user: User;
  request: PortalRequest;
  logout: () => Promise<void>;
  busy: boolean;
  describe: (error: unknown) => string;
};

export function PortalWorkspace({
  user,
  request,
  logout,
  busy,
  describe,
}: Props) {
  const [tab, setTab] = useState<Tab>('documents');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    data?: Resource;
    error?: string;
  }>();
  const [actionError, setActionError] = useState('');
  const [working, setWorking] = useState(false);
  const [remove, setRemove] = useState<DocumentRecord | null>(null);
  const [upload, setUpload] = useState(false);
  const [addUser, setAddUser] = useState(false);
  const allowed = (permission?: string) =>
    !permission || user.permissions.includes(permission);
  const active = allowed(required[tab]) ? tab : 'account';
  const query = new URLSearchParams({ page: String(page), pageSize: '10' });
  if (filter && active !== 'reports')
    query.set(active === 'audit-events' ? 'outcome' : 'search', filter);
  const path =
    active === 'reports'
      ? '/reports/summary?days=' + (filter || '7')
      : '/' + active + '?' + query;
  const key = path + '#' + version;
  const data = loaded?.key === key ? loaded.data : undefined;
  const error = loaded?.key === key ? loaded.error : undefined;
  useEffect(() => {
    if (active === 'account') return;
    const controller = new AbortController();
    request<Resource>(path, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((result) => {
        if (!controller.signal.aborted) setLoaded({ key, data: result });
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setLoaded({ key, error: describe(failure) });
      });
    return () => controller.abort();
  }, [active, key, path, request, describe]);
  function navigate(next: Tab) {
    setTab(next);
    setPage(1);
    setFilter('');
    setActionError('');
    setUpload(false);
    setAddUser(false);
  }
  async function action(operation: () => Promise<void>, refresh = true) {
    setWorking(true);
    setActionError('');
    try {
      await operation();
      if (refresh) setVersion((value) => value + 1);
    } catch (failure) {
      setActionError(describe(failure));
    } finally {
      setWorking(false);
    }
  }
  function sendForm(
    event: FormEvent<HTMLFormElement>,
    type: 'document' | 'user',
  ) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void action(async () => {
      if (type === 'document') {
        await request('/documents', { method: 'POST', body: fields });
        setUpload(false);
      } else {
        await request('/users', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(fields)),
        });
        setAddUser(false);
      }
      setPage(1);
    });
  }
  const result = data && 'items' in data ? data : undefined;
  const summary = data && 'documents' in data ? data : undefined;
  return (
    <>
      <PageHeading
        eyebrow="SECUREDOCS · CONECTADO"
        title={labels[active]}
        description={user.displayName + ' · ' + roles[user.role]}
        action={
          <button
            className="secondary-button"
            disabled={busy || working}
            onClick={() => void logout()}
          >
            Cerrar sesión
          </button>
        }
      />
      <nav className="button-row" aria-label="Módulos del portal">
        {(Object.keys(labels) as Tab[])
          .filter((item) => allowed(required[item]))
          .map((item) => (
            <button
              key={item}
              className={item === active ? 'button' : 'secondary-button'}
              aria-pressed={item === active}
              disabled={working}
              onClick={() => navigate(item)}
            >
              {labels[item]}
            </button>
          ))}
      </nav>
      {active === 'account' ? (
        <AccountSecurity user={user} request={request} describe={describe} />
      ) : (
        <section className="surface mt-section">
          {active === 'documents' && allowed('documents:create') && (
            <button
              className="button"
              disabled={working}
              onClick={() => {
                setActionError('');
                setUpload(true);
              }}
            >
              Cargar documento
            </button>
          )}
          {active === 'users' && allowed('users:manage') && (
            <button
              className="button"
              disabled={working}
              onClick={() => {
                setActionError('');
                setAddUser(true);
              }}
            >
              Crear usuario
            </button>
          )}
          <form
            className="button-row"
            key={active}
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setFilter(
                String(
                  new FormData(event.currentTarget).get('filter') ?? '',
                ).trim(),
              );
            }}
          >
            {active === 'audit-events' ? (
              <label>
                Resultado{' '}
                <select name="filter">
                  <option value="">Todos</option>
                  <option value="success">Permitido</option>
                  <option value="denied">Denegado</option>
                  <option value="failure">Fallido</option>
                </select>
              </label>
            ) : active === 'reports' ? (
              <label>
                Últimos días{' '}
                <input
                  name="filter"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={7}
                  required
                />
              </label>
            ) : (
              <label>
                Buscar <input name="filter" maxLength={100} />
              </label>
            )}
            <button className="secondary-button">Aplicar</button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setVersion((value) => value + 1)}
            >
              Actualizar
            </button>
          </form>
          {actionError && !upload && !addUser && !remove && (
            <Notice kind="error">{actionError}</Notice>
          )}
          {error ? (
            <Notice kind="error">{error}</Notice>
          ) : !data ? (
            <Notice>Cargando datos…</Notice>
          ) : null}
          {result?.items.length === 0 && (
            <p className="muted mt-section">
              No hay registros para este filtro.
            </p>
          )}
          {active === 'documents' &&
            (result?.items as DocumentRecord[] | undefined)?.map((doc) => (
              <article className="document-row flex-wrap" key={doc.id}>
                <div className="grow">
                  <strong>{doc.title}</strong>
                  <p>
                    {doc.filename} · {classifications[doc.classification]} ·{' '}
                    {formatBytes(doc.size)} · {doc.owner.displayName}
                  </p>
                  <details>
                    <summary>Huella SHA-256</summary>
                    <code className="break-all">{doc.sha256}</code>
                  </details>
                </div>
                <div className="button-row">
                  {allowed('documents:favorite') && (
                    <button
                      className="secondary-button"
                      disabled={working}
                      onClick={() =>
                        void action(async () => {
                          await request('/documents/' + doc.id + '/favorite', {
                            method: doc.favorite ? 'DELETE' : 'PUT',
                          });
                        })
                      }
                    >
                      {doc.favorite ? 'Quitar favorito' : 'Marcar favorito'}
                    </button>
                  )}
                  {doc.permissions.canDownload && (
                    <button
                      className="secondary-button"
                      disabled={working}
                      onClick={() =>
                        void action(async () => {
                          const blob = await request<Blob>(
                            '/documents/' + doc.id + '/download',
                          );
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = doc.filename;
                          link.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }, false)
                      }
                    >
                      Descargar
                    </button>
                  )}
                  {doc.permissions.canDelete && (
                    <button
                      className="danger-link"
                      disabled={working}
                      onClick={() => {
                        setActionError('');
                        setRemove(doc);
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            ))}
          {active === 'users' &&
            (result?.items as User[] | undefined)?.map((item) => (
              <article className="document-row flex-wrap" key={item.id}>
                <div className="grow">
                  <strong>{item.displayName}</strong>
                  <p>
                    {item.email} · {roles[item.role]} · MFA{' '}
                    {item.mfaEnabled ? 'activo' : 'pendiente'} ·{' '}
                    {item.status === 'active' ? 'Activo' : 'Deshabilitado'}
                  </p>
                </div>
                {allowed('users:manage') && item.id !== user.id && (
                  <form
                    className="button-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const body = JSON.stringify(
                        Object.fromEntries(new FormData(event.currentTarget)),
                      );
                      void action(async () => {
                        await request('/users/' + item.id, {
                          method: 'PATCH',
                          body,
                        });
                      });
                    }}
                  >
                    <label>
                      Rol{' '}
                      <select name="role" defaultValue={item.role}>
                        {Object.entries(roles).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Estado{' '}
                      <select name="status" defaultValue={item.status}>
                        <option value="active">Activo</option>
                        <option value="disabled">Deshabilitado</option>
                      </select>
                    </label>
                    <button className="secondary-button" disabled={working}>
                      Guardar
                    </button>
                  </form>
                )}
              </article>
            ))}
          {active === 'audit-events' &&
            (result?.items as EventRecord[] | undefined)?.map((event) => (
              <article className="activity-row" key={event.id}>
                <div className="grow">
                  <strong>{event.action}</strong>
                  <p>
                    {event.actor?.email ?? 'Sistema'} ·{' '}
                    {formatDate(event.occurredAt)}
                  </p>
                </div>
                <span className="badge">{event.outcome}</span>
              </article>
            ))}
          {summary && (
            <>
              <h2 className="mt-section">Resumen del servidor</h2>
              <p>
                Período desde {formatDate(summary.periodStart)} · Generado{' '}
                {formatDate(summary.generatedAt)}
              </p>
              <dl className="detail-grid">
                <div>
                  <dt>Documentos</dt>
                  <dd>
                    {summary.documents.total} ·{' '}
                    {formatBytes(summary.documents.totalBytes)}
                  </dd>
                </div>
                <div>
                  <dt>Usuarios con MFA</dt>
                  <dd>
                    {summary.users.mfaEnabled} / {summary.users.total}
                  </dd>
                </div>
                <div>
                  <dt>Accesos fallidos</dt>
                  <dd>{summary.events.failedLogins}</dd>
                </div>
                <div>
                  <dt>Fallos de integridad</dt>
                  <dd>{summary.events.integrityFailures}</dd>
                </div>
              </dl>
              <button
                className="secondary-button"
                onClick={() => {
                  const rows = [
                    ['Período desde', summary.periodStart],
                    ['Generado', summary.generatedAt],
                    ['Documentos', summary.documents.total],
                    ['Bytes', summary.documents.totalBytes],
                    ['Usuarios', summary.users.total],
                    ['MFA activo', summary.users.mfaEnabled],
                    ['Fallos de acceso', summary.events.failedLogins],
                    ['Fallos de integridad', summary.events.integrityFailures],
                    ...Object.entries(summary.documents.byClassification),
                    ...Object.entries(summary.events.byOutcome),
                  ];
                  saveDownload(
                    '\ufeff' +
                      rows
                        .map((row) => row.map(csvCell).join(','))
                        .join('\r\n'),
                    'securedocs-resumen.csv',
                    'text/csv;charset=utf-8',
                  );
                }}
              >
                Exportar resumen CSV
              </button>
            </>
          )}
          {result && (
            <div className="pagination">
              <span>
                {result.total} registros · Página {result.page}
              </span>
              <div>
                <button
                  className="secondary-button"
                  disabled={page <= 1 || working}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <button
                  className="secondary-button"
                  disabled={page * result.pageSize >= result.total || working}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      {upload && (
        <Modal
          title="Cargar documento"
          onClose={() => {
            if (!working) setUpload(false);
          }}
        >
          <form
            className="form-stack"
            onSubmit={(event) => sendForm(event, 'document')}
            method="post"
          >
            <label>
              Título
              <input name="title" required maxLength={120} />
            </label>
            <label>
              Clasificación
              <select name="classification">
                {Object.entries(classifications).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Archivo PDF o TXT
              <input
                name="file"
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                required
              />
            </label>
            {actionError && <Notice kind="error">{actionError}</Notice>}
            <button className="button" disabled={working}>
              {working ? 'Enviando…' : 'Cargar'}
            </button>
          </form>
        </Modal>
      )}
      {addUser && (
        <Modal
          title="Crear usuario"
          onClose={() => {
            if (!working) setAddUser(false);
          }}
        >
          <form
            className="form-stack"
            onSubmit={(event) => sendForm(event, 'user')}
            method="post"
          >
            <label>
              Nombre
              <input name="displayName" required minLength={2} maxLength={80} />
            </label>
            <label>
              Correo
              <input name="email" type="email" required maxLength={254} />
            </label>
            <label>
              Contraseña temporal
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <label>
              Rol
              <select name="role" defaultValue="reader">
                {Object.entries(roles).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {actionError && <Notice kind="error">{actionError}</Notice>}
            <button className="button" disabled={working}>
              Crear
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title="Eliminar documento"
          onClose={() => {
            if (!working) setRemove(null);
          }}
        >
          <p>Confirma la eliminación de {remove.title}.</p>
          {actionError && <Notice kind="error">{actionError}</Notice>}
          <button
            className="danger-button block-link"
            disabled={working}
            onClick={() =>
              void action(async () => {
                await request('/documents/' + remove.id, { method: 'DELETE' });
                setRemove(null);
                if (result?.items.length === 1 && page > 1) setPage(page - 1);
              })
            }
          >
            Confirmar eliminación
          </button>
        </Modal>
      )}
    </>
  );
}
