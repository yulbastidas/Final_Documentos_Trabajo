'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Header } from '../header';
import { Notice, PageHeading } from '../ui/primitives';
import {
  api,
  ApiError,
  type Challenge,
  type Session,
} from '../../lib/api/portal';
import { PortalWorkspace, type PortalRequest } from './workspace';

export function Portal() {
  const [session, setSession] = useState<Session | null>(null);
  const current = useRef<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [registration, setRegistration] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function update(next: Session | null) {
    current.current = next;
    setSession(next);
  }
  function describe(error: unknown) {
    return error instanceof ApiError
      ? error.message +
          (error.requestId ? ' Referencia: ' + error.requestId : '')
      : 'No se pudo contactar con la API. Comprueba que el entorno esté iniciado.';
  }
  useEffect(() => {
    const controller = new AbortController();
    api<Session>('/auth/session', {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then((next) => {
        if (!controller.signal.aborted) update(next);
      })
      .catch((failure: unknown) => {
        if (
          !controller.signal.aborted &&
          !(failure instanceof ApiError && failure.status === 401)
        )
          setError(describe(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const request: PortalRequest = async (path, options) => {
    const active = current.current;
    const write = Boolean(options?.method && options.method !== 'GET');
    try {
      try {
        return await api(path, options, write ? active?.csrfToken : undefined);
      } catch (failure) {
        if (!(
          failure instanceof ApiError &&
          failure.code === 'CSRF_INVALID' &&
          write &&
          active
        ))
          throw failure;
        const refreshed = await api<Session>('/auth/session');
        if (
          current.current?.user.id !== active.user.id ||
          refreshed.user.id !== active.user.id
        )
          throw failure;
        update(refreshed);
        return await api(path, options, refreshed.csrfToken);
      }
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        ['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(failure.code)
      ) {
        update(null);
        setNotice('Vuelve a iniciar sesión para continuar.');
      }
      throw failure;
    }
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get('email') ?? '').trim();
    const password = String(fields.get('password') ?? '');
    const code = String(fields.get('code') ?? '').trim();
    if (registration && password !== fields.get('confirm')) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setPending(true);
    setError('');
    setNotice('');
    try {
      if (challenge) {
        if (Date.parse(challenge.expiresAt) <= Date.now()) {
          setChallenge(null);
          setError('El desafío expiró. Inicia sesión de nuevo.');
          return;
        }
        update(
          await api<Session>('/auth/mfa/verify', {
            method: 'POST',
            body: JSON.stringify({
              challengeId: challenge.challengeId,
              ...(recovery ? { recoveryCode: code } : { code }),
            }),
          }),
        );
        setChallenge(null);
      } else if (registration) {
        await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            displayName: String(fields.get('displayName')).trim(),
          }),
        });
        setRegistration(false);
        setNotice('Cuenta creada. Ya puedes iniciar sesión.');
      } else {
        const result = await api<Session | Challenge>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (result.status === 'mfa_required') setChallenge(result);
        else update(result);
      }
      form.reset();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    setError('');
    setPending(true);
    try {
      await request('/auth/logout', { method: 'POST' });
      update(null);
      setNotice('Sesión cerrada.');
    } catch (failure) {
      setError(describe(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Header />
      <main className="workspace-main">
        {loading ? (
          <Notice>Comprobando sesión…</Notice>
        ) : session ? (
          <>
            {error && <Notice kind="error">{error}</Notice>}
            <PortalWorkspace
              user={session.user}
              request={request}
              logout={logout}
              busy={pending}
              describe={describe}
            />
          </>
        ) : (
          <>
            <PageHeading
              eyebrow="SECUREDOCS · PORTAL"
              title={
                challenge
                  ? 'Segundo factor'
                  : registration
                    ? 'Crear cuenta'
                    : 'Iniciar sesión'
              }
              description="Accede al entorno documental conectado al servidor."
            />
            <section className="surface mx-auto max-w-lg">
              {notice && <Notice>{notice}</Notice>}
              {error && <Notice kind="error">{error}</Notice>}
              <form
                method="post"
                className="form-stack"
                onSubmit={submit}
                key={challenge ? 'mfa' : registration ? 'register' : 'login'}
              >
                {challenge ? (
                  <>
                    <label>
                      {recovery
                        ? 'Código de recuperación'
                        : 'Código de seis dígitos'}
                      <input
                        name="code"
                        autoComplete="one-time-code"
                        required
                        maxLength={recovery ? 11 : 6}
                        inputMode={recovery ? 'text' : 'numeric'}
                        pattern={
                          recovery
                            ? '[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}'
                            : '[0-9]{6}'
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="text-link"
                      disabled={pending}
                      onClick={() => {
                        setRecovery(!recovery);
                        setError('');
                      }}
                    >
                      {' '}
                      {recovery
                        ? 'Usar código de la aplicación'
                        : 'Usar código de recuperación'}
                    </button>
                  </>
                ) : (
                  <>
                    {registration && (
                      <label>
                        Nombre completo
                        <input
                          name="displayName"
                          autoComplete="name"
                          required
                          minLength={2}
                          maxLength={80}
                        />
                      </label>
                    )}
                    <label>
                      Correo electrónico
                      <input
                        type="email"
                        name="email"
                        autoComplete="username"
                        required
                        maxLength={254}
                      />
                    </label>
                    <label>
                      Contraseña
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={registration ? 12 : 1}
                        maxLength={128}
                        autoComplete={
                          registration ? 'new-password' : 'current-password'
                        }
                      />
                    </label>
                    {registration && (
                      <label>
                        Confirmar contraseña
                        <input
                          type="password"
                          name="confirm"
                          required
                          autoComplete="new-password"
                        />
                      </label>
                    )}
                  </>
                )}
                <button className="button" disabled={pending}>
                  {pending
                    ? 'Procesando…'
                    : challenge
                      ? 'Verificar'
                      : registration
                        ? 'Registrar'
                        : 'Entrar'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={pending}
                  onClick={() => {
                    if (challenge) {
                      setChallenge(null);
                      setRecovery(false);
                    } else setRegistration(!registration);
                    setError('');
                    setNotice('');
                  }}
                >
                  {challenge || registration
                    ? 'Volver al acceso'
                    : 'Crear cuenta'}
                </button>
              </form>
              <Link className="text-link block-link" href="/dashboard">
                Ver demostración separada →
              </Link>
            </section>
          </>
        )}
      </main>
    </>
  );
}
