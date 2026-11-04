'use client';
import { useState } from 'react';
import { useDemo } from './demo-provider';
import { PageHeading, Notice } from '../ui/primitives';
import { Modal } from '../ui/modal';
import type { DemoUser, Role } from '../../lib/types';
export function Users() {
  const { users, role, changeUserRole } = useDemo();
  const [target, setTarget] = useState<DemoUser | null>(null);
  const [nextRole, setNextRole] = useState<Role>('Lector');
  const [message, setMessage] = useState('');
  return (
    <>
      <PageHeading
        eyebrow="IDENTIDAD Y ACCESO · FASE 1"
        title="Personas y permisos."
        description="Una vista de los roles que organizarán el acceso al sistema."
      />
      <Notice>
        Los usuarios y sus estados MFA son ficticios. Cambiar un rol aquí solo
        modifica la representación visual.
      </Notice>
      {message && <Notice kind="success">{message}</Notice>}
      <section className="surface mt-section">
        <div className="section-heading">
          <h2>Equipo de demostración</h2>
          <span className="badge">{users.length} perfiles sintéticos</span>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Usuarios de demostración"
        >
          <table>
            <caption className="sr-only">Perfiles y roles ficticios</caption>
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Rol</th>
                <th scope="col">MFA de ejemplo</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <p className="muted small">{user.email}</p>
                  </td>
                  <td>
                    <span className="badge">{user.role}</span>
                  </td>
                  <td>
                    <span className={`badge ${user.mfa ? '' : 'badge-amber'}`}>
                      {user.mfa
                        ? 'Habilitado (ficticio)'
                        : 'Pendiente (ficticio)'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="secondary-button"
                      disabled={role !== 'Administrador'}
                      onClick={() => {
                        setTarget(user);
                        setNextRole(user.role);
                      }}
                    >
                      Editar rol demo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {role !== 'Administrador' && (
          <p className="small muted">
            Solo la vista de Administrador puede editar roles en esta
            demostración.
          </p>
        )}
      </section>
      <section className="surface mt-section">
        <h2>Matriz visual de capacidades</h2>
        <div className="permission-grid">
          {[
            [
              'Administrador',
              'Consultar, añadir y eliminar registros; editar roles visuales.',
            ],
            [
              'Colaborador',
              'Consultar y añadir metadatos. Sin eliminación ni edición de roles.',
            ],
            [
              'Lector',
              'Consulta y favoritos. Sin cambios en documentos o usuarios.',
            ],
          ].map(([name, description]) => (
            <article key={name}>
              <h3>{name}</h3>
              <p className="muted">{description}</p>
            </article>
          ))}
        </div>
        <p className="small muted">
          Propuesta de UX, pendiente de acordar con IAM del servidor. Ocultar
          botones no autoriza ni protege recursos.
        </p>
      </section>
      {target && (
        <Modal
          title={`Rol visual de ${target.name}`}
          onClose={() => setTarget(null)}
        >
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              changeUserRole(target.id, nextRole);
              setTarget(null);
              setMessage('Rol actualizado solo en la demostración.');
            }}
          >
            <label>
              Nuevo rol
              <select
                value={nextRole}
                onChange={(event) => setNextRole(event.target.value as Role)}
              >
                {['Administrador', 'Colaborador', 'Lector'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setTarget(null)}
              >
                Cancelar
              </button>
              <button className="button">Guardar cambio visual</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
