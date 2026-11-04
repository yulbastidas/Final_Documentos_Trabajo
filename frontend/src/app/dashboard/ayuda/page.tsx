import Link from 'next/link';
import { PageHeading, Notice } from '../../../components/ui/primitives';
const phases = [
  [
    '1',
    'Identidad e IAM',
    'Formularios de acceso, registro y MFA; usuarios y vistas de rol.',
    'Autenticación, sesiones, MFA y permisos de servidor: Jacobo.',
  ],
  [
    '2',
    'Gestión documental',
    'Búsqueda, filtros, favoritos, metadatos, detalles y eliminación en memoria.',
    'Almacenamiento, AES-256-GCM, hashing y permisos por documento: Jacobo.',
  ],
  [
    '3',
    'Experiencia y desarrollo seguro',
    'Validación de entradas, salida de texto segura, estados de error y cabeceras básicas.',
    'HTTPS, proxy y hardening: Jerónimo; validación y consultas: Jacobo.',
  ],
  [
    '4',
    'DevSecOps y pruebas',
    'Pruebas automatizadas de interfaces y guía de entrega.',
    'GitHub Actions, Trivy, imágenes y pentesting: Jerónimo.',
  ],
  [
    '5',
    'Laboratorios',
    'Vistas del plan de evidencias y lista de preparación para la presentación.',
    'Topologías, ejecución aislada y evidencias: Jerónimo.',
  ],
  [
    '6',
    'Auditoría y presentación',
    'Filtros de actividad sintética, reporte CSV, impresión y manual.',
    'Eventos reales, reportes autorizados e integración: todo el equipo.',
  ],
];
export default function Help() {
  return (
    <>
      <PageHeading
        eyebrow="GUÍA Y PRESENTACIÓN"
        title="Un proyecto, tres responsables."
        description="Recorrido del frontend y puntos pendientes de integración."
      />
      <Notice>
        Las interfaces de Yuly abarcan las fases previstas. La aceptación de
        cada fase del sistema requiere la implementación y las pruebas conjuntas
        del equipo.
      </Notice>
      <section className="surface mt-section">
        <h2>Recorrido sugerido</h2>
        <ol className="guide-steps">
          <li>Explora los formularios de acceso y MFA con datos ficticios.</li>
          <li>
            Abre Documentos: busca, filtra y añade metadatos de un archivo de
            prueba.
          </li>
          <li>
            Cambia la vista de rol para revisar las acciones de cada perfil.
          </li>
          <li>
            Consulta los eventos sintéticos y exporta un reporte de
            demostración.
          </li>
          <li>
            Revisa el centro de seguridad y el plan de evidencias de
            laboratorios.
          </li>
        </ol>
        <div className="button-row">
          <Link className="secondary-button" href="/login">
            Acceso
          </Link>
          <Link className="secondary-button" href="/dashboard/documentos">
            Documentos
          </Link>
          <Link className="secondary-button" href="/dashboard/reportes">
            Reportes
          </Link>
        </div>
      </section>
      <div className="phase-list mt-section">
        {phases.map(([number, title, ui, pending]) => (
          <section key={number} className="surface phase-card">
            <span className="phase-number">0{number}</span>
            <div>
              <h2>{title}</h2>
              <p>{ui}</p>
              <p className="muted small">Pendiente de integración: {pending}</p>
            </div>
          </section>
        ))}
      </div>
      <section className="surface mt-section">
        <h2>Preguntas frecuentes</h2>
        <details className="faq">
          <summary>¿Puedo usar documentos o contraseñas reales?</summary>
          <p>
            No. Usa información ficticia. Esta demostración no tiene seguridad
            de servidor ni almacenamiento documental.
          </p>
        </details>
        <details className="faq">
          <summary>¿Por qué se pierden mis cambios al recargar?</summary>
          <p>
            La demostración usa estado en memoria. No escribe en localStorage,
            no crea sesiones ni guarda archivos.
          </p>
        </details>
        <details className="faq">
          <summary>¿El selector de rol concede permisos?</summary>
          <p>
            No. Solo permite revisar la interfaz. La API deberá autenticar y
            autorizar cada operación de forma independiente.
          </p>
        </details>
        <details className="faq">
          <summary>¿Qué falta antes de conectar al backend?</summary>
          <p>
            Acordar los contratos propuestos en docs/api.md, sesión, CSRF, MFA,
            formatos, límites y errores; después implementar y probar el
            adaptador junto a Jacobo.
          </p>
        </details>
      </section>
    </>
  );
}
