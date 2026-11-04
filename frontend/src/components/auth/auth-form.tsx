'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Header } from '../header';
import { Notice } from '../ui/primitives';
import { Icon } from '../ui/icon';
type Mode = 'login' | 'register' | 'mfa';
const content = {
  login: {
    title: 'Bienvenida de nuevo.',
    description: 'Tu espacio de trabajo comienza con tu identidad.',
    submit: 'Revisar formulario',
  },
  register: {
    title: 'Tu identidad, primero.',
    description: 'Prepara tu solicitud de acceso a SecureDocs.',
    submit: 'Revisar solicitud',
  },
  mfa: {
    title: 'Un paso más de protección.',
    description: 'Vista previa de la verificación con un segundo factor.',
    submit: 'Revisar formato del código',
  },
};
export function AuthForm({ mode }: { mode: Mode }) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    if (mode === 'mfa') {
      if (!/^\d{6}$/.test(String(data.get('code')))) {
        setError('Escribe un código de seis dígitos.');
        return;
      }
      form.reset();
      setMessage(
        'Formato válido. No se verificó ningún segundo factor: falta integrar el desafío MFA del servidor.',
      );
      return;
    }
    if (mode === 'register') {
      const password = String(data.get('password'));
      if (String(data.get('displayName')).trim().length < 2) {
        setError('Escribe al menos dos caracteres para el nombre.');
        return;
      }
      if (password.length < 12) {
        setError(
          'Usa al menos 12 caracteres para esta vista previa. La política final debe acordarse con Jacobo.',
        );
        return;
      }
      if (password !== data.get('confirmPassword')) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }
    form.reset();
    setShowPassword(false);
    setMessage(
      mode === 'register'
        ? 'Formulario revisado localmente. No se creó ninguna cuenta ni se enviaron datos.'
        : 'Formulario revisado localmente. No se inició ninguna sesión ni se enviaron credenciales.',
    );
  }
  const text = content[mode];
  return (
    <>
      <Header />
      <main className="auth-layout">
        <section className="auth-story">
          <p className="eyebrow">IDENTIDAD · ACCESO · CONFIANZA</p>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
          <div className="auth-security">
            <Icon name="shield" size={32} />
            <div>
              <strong>Seguridad compartida</strong>
              <p>
                Tu interfaz acompaña al servidor. La identidad y los permisos se
                validarán en la API.
              </p>
            </div>
          </div>
          <Link className="text-link" href="/dashboard">
            Explorar con datos de demostración →
          </Link>
        </section>
        <section
          className="surface auth-card"
          aria-label={
            mode === 'register'
              ? 'Formulario de registro'
              : mode === 'mfa'
                ? 'Formulario MFA'
                : 'Formulario de acceso'
          }
        >
          <div className="auth-card-top">
            <span className="file-icon">
              <Icon name="lock" />
            </span>
            <span className="badge badge-amber">VISTA PREVIA</span>
          </div>
          <h2>
            {mode === 'login'
              ? 'Acceder a SecureDocs'
              : mode === 'register'
                ? 'Solicitar una cuenta'
                : 'Verificar código MFA'}
          </h2>
          <p className="muted small">
            Usa datos ficticios. Este formulario no está conectado al backend.
          </p>
          <form onSubmit={submit} className="form-stack">
            {mode === 'register' && (
              <label>
                Nombre completo
                <input
                  name="displayName"
                  autoComplete="off"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Nombre de ejemplo"
                />
              </label>
            )}
            {mode !== 'mfa' ? (
              <>
                <label>
                  Correo electrónico
                  <input
                    name="email"
                    type="email"
                    autoComplete="off"
                    required
                    maxLength={254}
                    placeholder="nombre@example.test"
                  />
                </label>
                <label>
                  Contraseña de prueba
                  <div className="password-field">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      maxLength={128}
                      autoComplete="off"
                      placeholder={
                        mode === 'register'
                          ? 'Mínimo 12 caracteres'
                          : 'Usa una contraseña ficticia'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </label>
                {mode === 'register' && (
                  <>
                    <label>
                      Confirmar contraseña
                      <input
                        name="confirmPassword"
                        type="password"
                        required
                        maxLength={128}
                        autoComplete="off"
                      />
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" required />
                      Entiendo que esta es una demostración sin creación de
                      cuentas.
                    </label>
                  </>
                )}
              </>
            ) : (
              <label>
                Código de seis dígitos
                <input
                  className="otp-input"
                  name="code"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  maxLength={6}
                  placeholder="000000"
                  aria-describedby="mfa-help"
                />
                <span id="mfa-help" className="muted small">
                  No uses códigos reales de tu aplicación autenticadora.
                </span>
              </label>
            )}
            {error && <Notice kind="error">{error}</Notice>}
            {message && <Notice>{message}</Notice>}
            <button className="button" type="submit">
              {text.submit}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="auth-links">
            {mode === 'login' ? (
              <>
                <Link href="/registro">Solicitar una cuenta</Link>
                <Link href="/mfa">Ver pantalla MFA</Link>
              </>
            ) : (
              <Link href="/login">Volver al acceso</Link>
            )}
          </div>
          {message && (
            <Link className="secondary-button block-link" href="/dashboard">
              Abrir demostración sin autenticación →
            </Link>
          )}
        </section>
      </main>
    </>
  );
}
