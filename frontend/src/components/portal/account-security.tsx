'use client';

import { useState, type FormEvent } from 'react';
import { Notice } from '../ui/primitives';
import type { User } from '../../lib/api/portal';
import type { PortalRequest } from './workspace';

export function AccountSecurity({
  user,
  request,
  describe,
}: {
  user: User;
  request: PortalRequest;
  describe: (error: unknown) => string;
}) {
  const [enabled, setEnabled] = useState(user.mfaEnabled);
  const [secret, setSecret] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [mode, setMode] = useState<'confirm' | 'disable' | 'recovery'>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const code = String(fields.get('code'));
    void run(async () => {
      if (mode === 'disable') {
        await request('/auth/mfa/disable', {
          method: 'POST',
          body: JSON.stringify({ code, password: fields.get('password') }),
        });
        setEnabled(false);
      } else {
        const result = await request<{ recoveryCodes: string[] }>(
          '/auth/mfa/' + (mode === 'confirm' ? 'confirm' : 'recovery-codes'),
          { method: 'POST', body: JSON.stringify({ code }) },
        );
        setEnabled(true);
        setCodes(result.recoveryCodes);
      }
      setSecret('');
      setMode(undefined);
    });
  }
  return (
    <section className="surface mt-section">
      <h2>Segundo factor de autenticación</h2>
      <p className="muted">
        {user.email} · MFA {enabled ? 'activo' : 'sin configurar'}
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {codes.length > 0 && (
        <div className="mt-section">
          <Notice>
            Guarda estos códigos en un lugar privado. Cada código se puede usar
            una vez.
          </Notice>
          <ul className="detail-grid">
            {codes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <button className="secondary-button" onClick={() => setCodes([])}>
            Ocultar códigos
          </button>
        </div>
      )}
      {!mode && (
        <div className="button-row">
          {enabled ? (
            <>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setCodes([]);
                  setMode('recovery');
                }}
              >
                Renovar códigos de recuperación
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setCodes([]);
                  setMode('disable');
                }}
              >
                Desactivar MFA
              </button>
            </>
          ) : (
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await request<{ secret: string }>(
                    '/auth/mfa/setup',
                    { method: 'POST' },
                  );
                  setSecret(result.secret);
                  setMode('confirm');
                })
              }
            >
              Configurar MFA
            </button>
          )}
        </div>
      )}
      {mode && (
        <form method="post" className="form-stack" onSubmit={submit}>
          {secret && (
            <Notice>
              Agrega una cuenta TOTP a tu autenticador con esta clave manual (6
              dígitos, período de 30 segundos):{' '}
              <code className="break-all">{secret}</code>
            </Notice>
          )}
          {mode === 'disable' && (
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
          )}
          <label>
            Código de seis dígitos
            <input
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>
          <button className="button" disabled={busy}>
            {mode === 'disable'
              ? 'Confirmar desactivación'
              : mode === 'confirm'
                ? 'Activar MFA'
                : 'Renovar códigos'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setMode(undefined);
              setSecret('');
              setError('');
            }}
          >
            Cancelar
          </button>
        </form>
      )}
    </section>
  );
}
