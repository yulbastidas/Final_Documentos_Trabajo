import type { AuditEvent, DocumentItem } from './types';
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeZone: 'America/Bogota',
  }).format(new Date(value));
}
export function csvCell(value: unknown) {
  // Evitar fórmulas al abrir la exportación en Excel/LibreOffice.
  const text = String(value ?? '');
  const neutral = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${neutral.replaceAll('"', '""')}"`;
}
export function reportCsv(documents: DocumentItem[], events: AuditEvent[]) {
  const rows: unknown[][] = [
    ['SECUREDOCS — DEMOSTRACIÓN. NO ES UN REPORTE DE AUDITORÍA REAL.'],
    ['Título', 'Clasificación', 'Propietario', 'Bytes', 'Fecha UTC'],
    ...documents.map((d) => [
      d.title,
      d.category,
      d.owner,
      d.size,
      d.updatedAt,
    ]),
    [],
    ['Eventos sintéticos', 'Recurso', 'Actor', 'Resultado', 'Fecha UTC'],
    ...events.map((e) => [e.action, e.resource, e.actor, e.result, e.at]),
  ];
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
export function saveDownload(
  content: string,
  filename: string,
  type = 'text/plain;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validateFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
): string | null {
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > 10 * 1024 * 1024)
    return 'El límite visual de demostración es 10 MB.';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['pdf', 'txt'].includes(ext))
    return 'Selecciona un archivo PDF o TXT de prueba.';
  const expectedType = ext === 'pdf' ? 'application/pdf' : 'text/plain';
  if (file.type && file.type !== expectedType)
    return 'El tipo de archivo no coincide con los formatos admitidos.';
  return null;
}
