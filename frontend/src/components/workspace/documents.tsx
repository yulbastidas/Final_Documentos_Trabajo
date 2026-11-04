'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { useDemo } from './demo-provider';
import { EmptyState, Notice, PageHeading } from '../ui/primitives';
import { Modal } from '../ui/modal';
import { Icon } from '../ui/icon';
import {
  formatBytes,
  formatDate,
  saveDownload,
  validateFile,
} from '../../lib/presentation';
import type { Classification, DocumentItem } from '../../lib/types';
const pageSize = 5;
export function Documents() {
  const { documents, role, addDocument, removeDocument, toggleFavorite } =
    useDemo();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [favorites, setFavorites] = useState(false);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'upload' | 'detail' | 'delete' | null>(
    null,
  );
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [message, setMessage] = useState('');
  const filtered = useMemo(
    () =>
      documents
        .filter(
          (d) =>
            (d.title + ' ' + d.filename + ' ' + d.owner)
              .toLocaleLowerCase('es')
              .includes(query.trim().toLocaleLowerCase('es')) &&
            (category === 'Todas' || d.category === category) &&
            (!favorites || d.favorite),
        )
        .sort((a, b) =>
          sort === 'name'
            ? a.title.localeCompare(b.title, 'es')
            : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [documents, query, category, favorites, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  function chooseFile(next: File | undefined) {
    if (!next) return;
    const error = validateFile(next);
    setFileError(error ?? '');
    setFile(error ? null : next);
  }
  function openUpload() {
    setFile(null);
    setFileError('');
    setModal('upload');
  }
  function closeModal() {
    setModal(null);
    setFile(null);
    setFileError('');
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title')).trim();
    if (!file) {
      setFileError('Selecciona un archivo de prueba válido.');
      return;
    }
    if (!title) {
      setFileError('Escribe un título para el documento.');
      return;
    }
    addDocument(title, file, data.get('category') as Classification);
    setFile(null);
    setModal(null);
    setMessage(
      'Metadatos añadidos a la demo. El archivo no se leyó, cifró ni envió.',
    );
    setQuery('');
    setCategory('Todas');
    setFavorites(false);
    setPage(1);
  }
  function resetFilters() {
    setQuery('');
    setCategory('Todas');
    setFavorites(false);
    setPage(1);
  }
  return (
    <>
      <PageHeading
        eyebrow="GESTIÓN DOCUMENTAL · FASE 2"
        title="Tus documentos."
        description="Organiza, encuentra y explora información de ejemplo."
        action={
          <button
            className="button"
            onClick={openUpload}
            disabled={role === 'Lector'}
          >
            <Icon name="plus" />
            Añadir documento demo
          </button>
        }
      />
      <Notice>
        Las etiquetas de clasificación son ilustrativas. No hay cifrado,
        almacenamiento ni verificación de integridad reales. Usa solo archivos
        de prueba.
      </Notice>
      {role === 'Lector' && (
        <p className="small muted mt-section">
          Vista de lector: añadir y eliminar están deshabilitados visualmente.
          El servidor deberá aplicar los permisos reales.
        </p>
      )}
      {message && <Notice kind="success">{message}</Notice>}
      <section className="surface mt-section">
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" />
            <input
              aria-label="Buscar documentos"
              placeholder="Buscar por nombre o propietario…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>Clasificación</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              {['Todas', 'Interno', 'Confidencial', 'Restringido'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Orden</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Más recientes</option>
              <option value="name">Nombre A–Z</option>
            </select>
          </label>
        </div>
        <div className="list-meta">
          <span>{filtered.length} documentos · Solo metadatos</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={favorites}
              onChange={(event) => {
                setFavorites(event.target.checked);
                setPage(1);
              }}
            />
            Solo favoritos
          </label>
        </div>
        {visible.length ? (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Lista de documentos desplazable"
            >
              <table>
                <caption className="sr-only">
                  Documentos de demostración
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Clasificación</th>
                    <th scope="col">Propietario</th>
                    <th scope="col">Actualización</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="table-file">
                          <span className="file-icon">
                            <Icon name="file" />
                          </span>
                          <div>
                            <button
                              className="table-title"
                              onClick={() => {
                                setSelected(d);
                                setModal('detail');
                              }}
                            >
                              {d.title}
                            </button>
                            <p>
                              {d.filename} · {formatBytes(d.size)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${d.category === 'Restringido' ? 'badge-amber' : ''}`}
                        >
                          {d.category}
                        </span>
                      </td>
                      <td>{d.owner}</td>
                      <td>{formatDate(d.updatedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className={`icon-button ${d.favorite ? 'favorite' : ''}`}
                            aria-label={`${d.favorite ? 'Quitar de' : 'Añadir a'} favoritos: ${d.title}`}
                            aria-pressed={d.favorite}
                            onClick={() => toggleFavorite(d.id)}
                          >
                            {d.favorite ? '★' : '☆'}
                          </button>
                          <button
                            className="text-link"
                            onClick={() => {
                              setSelected(d);
                              setModal('detail');
                            }}
                          >
                            Detalles
                          </button>
                          <button
                            className="danger-link"
                            disabled={role !== 'Administrador'}
                            onClick={() => {
                              setSelected(d);
                              setModal('delete');
                            }}
                            aria-label={`Eliminar ${d.title}`}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Página {currentPage} de {pages}
              </span>
              <div>
                <button
                  className="secondary-button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </button>
                <button
                  className="secondary-button"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No encontramos documentos"
            description="Prueba con otros filtros o añade metadatos de un archivo de prueba."
            action={
              <button className="secondary-button" onClick={resetFilters}>
                Limpiar filtros
              </button>
            }
          />
        )}
      </section>
      {modal === 'upload' && (
        <Modal title="Añadir documento de demostración" onClose={closeModal}>
          <p className="muted small">
            Se guardarán solo nombre, tamaño y clasificación en memoria. El
            contenido del archivo no se lee ni se envía.
          </p>
          <form className="form-stack" onSubmit={submit}>
            <label>
              Título del documento
              <input
                name="title"
                required
                maxLength={100}
                placeholder="Ej. Acta de ejemplo"
              />
            </label>
            <label>
              Clasificación
              <select name="category">
                {['Interno', 'Confidencial', 'Restringido'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label
              className="dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                chooseFile(event.dataTransfer.files[0]);
              }}
            >
              <Icon name="file" size={30} />
              <strong>
                {file
                  ? file.name
                  : 'Selecciona o arrastra un archivo de prueba'}
              </strong>
              <span>PDF o TXT · Máximo 10 MB (límite de interfaz)</span>
              <input
                aria-label="Archivo de prueba"
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
            </label>
            {fileError && <Notice kind="error">{fileError}</Notice>}
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={closeModal}
              >
                Cancelar
              </button>
              <button className="button" type="submit">
                Añadir metadatos
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'detail' && selected && (
        <Modal title={selected.title} onClose={() => setModal(null)}>
          <dl className="detail-grid">
            <div>
              <dt>Archivo</dt>
              <dd>{selected.filename}</dd>
            </div>
            <div>
              <dt>Tamaño representado</dt>
              <dd>{formatBytes(selected.size)}</dd>
            </div>
            <div>
              <dt>Clasificación</dt>
              <dd>{selected.category}</dd>
            </div>
            <div>
              <dt>Propietario</dt>
              <dd>{selected.owner}</dd>
            </div>
            <div>
              <dt>Algoritmo previsto</dt>
              <dd>AES-256-GCM · Pendiente del servidor</dd>
            </div>
            <div>
              <dt>Hash e integridad</dt>
              <dd>No disponibles: sin archivo almacenado</dd>
            </div>
          </dl>
          <Notice>
            No se puede previsualizar ni descargar el original: esta demo solo
            contiene metadatos.
          </Notice>
          <button
            className="secondary-button block-link"
            onClick={() => {
              saveDownload(
                'SecureDocs — MUESTRA SINTÉTICA\nEste texto no es el documento original ni un archivo cifrado.\n',
                'securedocs-muestra-demo.txt',
              );
              setMessage(
                'Se descargó un texto de muestra, no el documento original.',
              );
            }}
          >
            <Icon name="download" />
            Descargar texto de muestra
          </button>
        </Modal>
      )}
      {modal === 'delete' && selected && (
        <Modal
          title="Eliminar registro de demostración"
          onClose={() => setModal(null)}
        >
          <p>
            ¿Eliminar los metadatos de <strong>{selected.title}</strong>?
          </p>
          <p className="muted small">
            Solo afecta a esta demo. No elimina archivos de tu computador ni del
            servidor.
          </p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button
              className="danger-button"
              onClick={() => {
                removeDocument(selected.id);
                setModal(null);
                setMessage('Registro de demostración eliminado.');
              }}
            >
              Confirmar eliminación
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
