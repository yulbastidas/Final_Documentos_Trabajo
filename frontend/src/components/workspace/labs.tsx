'use client';
import { useState } from 'react';
import { PageHeading, Notice } from '../ui/primitives';
import { Icon } from '../ui/icon';
const labs = [
  [
    'VLAN',
    'Segmentación de la red',
    'Topología, inventario y evidencia de aislamiento.',
  ],
  [
    'WPA2',
    'Acceso inalámbrico',
    'Configuración del laboratorio propio y registro de observaciones.',
  ],
  [
    'Wireshark',
    'Análisis del tráfico',
    'Capturas sintéticas o saneadas y explicación de protocolos.',
  ],
  [
    'MITM',
    'Confidencialidad en tránsito',
    'Comparación conceptual de controles en una red aislada autorizada.',
  ],
  [
    'Disponibilidad',
    'Continuidad del servicio',
    'Recursos limitados, métricas y plan de recuperación del laboratorio.',
  ],
];
export function Labs() {
  const [selected, setSelected] = useState(labs[0][0]);
  const [checks, setChecks] = useState<string[]>([]);
  return (
    <>
      <PageHeading
        eyebrow="LABORATORIOS DE RED · FASE 5"
        title="Aprender en un entorno aislado."
        description="Guía de evidencias para acompañar la presentación de Jerónimo."
      />
      <Notice>
        Esta sección organiza una propuesta de presentación. No ejecuta
        herramientas, ataques, capturas ni pruebas sobre redes.
      </Notice>
      <div className="lab-grid mt-section">
        {labs.map(([name, title, description]) => (
          <button
            key={name}
            className={`surface lab-card ${selected === name ? 'selected' : ''}`}
            aria-pressed={selected === name}
            onClick={() => setSelected(name)}
          >
            <Icon name="lab" />
            <span className="eyebrow">{name}</span>
            <strong>{title}</strong>
            <span className="muted">{description}</span>
          </button>
        ))}
      </div>
      <section className="surface mt-section">
        <div className="section-heading">
          <h2>Plan de evidencia: {selected}</h2>
          <span className="badge badge-amber">Sin ejecución</span>
        </div>
        <p className="muted">
          Lista de preparación local para la exposición. Marcar casillas no
          acredita que el laboratorio se haya realizado.
        </p>
        <div className="lab-checks">
          {[
            'Alcance y autorización documentados',
            'Red aislada y equipos de prueba identificados',
            'Datos sintéticos y límites de recursos definidos',
            'Evidencias saneadas y resultados documentados',
            'Limpieza y recuperación planificadas',
          ].map((item) => {
            const key = selected + item;
            return (
              <label key={key} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={checks.includes(key)}
                  onChange={(event) =>
                    setChecks((prev) =>
                      event.target.checked
                        ? [...prev, key]
                        : prev.filter((v) => v !== key),
                    )
                  }
                />
                {item}
              </label>
            );
          })}
        </div>
        <p className="small muted">
          Responsable: Jerónimo. Los resultados reales deben documentarse en
          infra/labs/ y revisarse en equipo.
        </p>
      </section>
    </>
  );
}
