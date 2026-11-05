import { HttpStatus } from '@nestjs/common';
import { ApiError, Errors } from '../common/api-error';

export const ALLOWED = {
  pdf: { mime: 'application/pdf', declared: ['application/pdf'] },
  txt: { mime: 'text/plain; charset=utf-8', declared: ['text/plain'] },
} as const;
export type AllowedExt = keyof typeof ALLOWED;

const GENERIC_DECLARED = ['', 'application/octet-stream'];

export interface ValidatedFile {
  filename: string;
  ext: AllowedExt;
  mimeType: string;
}

/** Normaliza el nombre: sin rutas, controles ni caracteres reservados. */
export function sanitizeFilename(raw: string): string {
  let name = raw;
  // multer entrega el nombre como latin1; recuperar UTF-8 si es válido.
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  if (!utf8.includes('�')) name = utf8;
  name = name.split(/[\\/]/).pop() ?? '';
  name = name
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(-200);
  return name;
}

function badFile(message: string) {
  return new ApiError(HttpStatus.BAD_REQUEST, 'INVALID_FILE', message);
}

/**
 * Validación en servidor: nombre/extensión, tipo declarado coherente y firma
 * real del contenido. El MIME guardado es el que decide el servidor.
 */
export function validateUpload(
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  },
  maxBytes: number,
): ValidatedFile {
  if (!file || !file.buffer)
    throw badFile('Adjunta un archivo en el campo "file".');
  if (file.size === 0 || file.buffer.length === 0)
    throw badFile('El archivo está vacío.');
  if (file.size > maxBytes || file.buffer.length > maxBytes)
    throw Errors.payloadTooLarge();

  const filename = sanitizeFilename(file.originalname);
  const ext = filename.split('.').pop()?.toLowerCase();
  if (
    !filename ||
    !ext ||
    !(ext in ALLOWED) ||
    filename.length <= ext.length + 1
  )
    throw Errors.unsupportedType('Solo se admiten archivos PDF o TXT.');
  const rule = ALLOWED[ext as AllowedExt];
  const declared = (file.mimetype ?? '').split(';')[0].trim().toLowerCase();
  if (
    !GENERIC_DECLARED.includes(declared) &&
    !(rule.declared as readonly string[]).includes(declared)
  )
    throw Errors.unsupportedType(
      'El tipo declarado no coincide con la extensión.',
    );

  const buf = file.buffer;
  if (ext === 'pdf') {
    const tail = buf
      .subarray(Math.max(0, buf.length - 1024))
      .toString('latin1');
    if (
      buf.subarray(0, 5).toString('latin1') !== '%PDF-' ||
      !tail.includes('%%EOF')
    )
      throw Errors.unsupportedType(
        'El contenido no corresponde a un PDF válido.',
      );
  } else {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      throw Errors.unsupportedType('El TXT debe estar codificado en UTF-8.');
    }
    // Rechazar binarios disfrazados: NUL y controles distintos de \t \n \r \f.
    if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text))
      throw Errors.unsupportedType(
        'El TXT contiene caracteres de control no permitidos.',
      );
  }
  return { filename, ext: ext as AllowedExt, mimeType: rule.mime };
}
