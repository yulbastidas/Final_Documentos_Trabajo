import { sanitizeDetails } from '../../src/audit/audit.service';
import { passwordPolicyError } from '../../src/auth/password';
import {
  canDeleteDocument,
  canReadDocument,
  hasPermission,
} from '../../src/authz/permissions';
import {
  sanitizeFilename,
  validateUpload,
} from '../../src/documents/file-validation';

const MAX = 1024 * 1024;
const file = (
  originalname: string,
  content: Buffer | string,
  mimetype = '',
) => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return { originalname, mimetype, size: buffer.length, buffer };
};
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('validación de archivos', () => {
  it('acepta PDF y TXT válidos y fija el MIME del servidor', () => {
    expect(
      validateUpload(file('a.pdf', pdf, 'application/pdf'), MAX),
    ).toMatchObject({ ext: 'pdf', mimeType: 'application/pdf' });
    expect(
      validateUpload(file('nota.TXT', 'hola\nmundo\t✓', 'text/plain'), MAX)
        .mimeType,
    ).toBe('text/plain; charset=utf-8');
    expect(
      validateUpload(file('a.pdf', pdf, 'application/octet-stream'), MAX).ext,
    ).toBe('pdf');
  });

  it.each([
    ['vacío', file('a.txt', ''), 400],
    ['extensión no permitida', file('a.exe', 'MZ'), 415],
    ['sin nombre base', file('.pdf', pdf), 415],
    ['doble extensión ejecutable', file('a.pdf.exe', pdf), 415],
    ['PDF falso (texto con extensión pdf)', file('a.pdf', 'no soy pdf'), 415],
    ['PDF sin %%EOF', file('a.pdf', '%PDF-1.4 truncado'), 415],
    ['MIME declarado incoherente', file('a.pdf', pdf, 'text/html'), 415],
    [
      'TXT binario con NUL',
      file('a.txt', Buffer.from([0x68, 0x00, 0x69])),
      415,
    ],
    ['TXT no UTF-8', file('a.txt', Buffer.from([0xff, 0xfe, 0xfd])), 415],
    [
      'ejecutable renombrado a txt',
      file('a.txt', Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])),
      415,
    ],
    ['tamaño excedido', file('a.txt', 'x'.repeat(MAX + 1)), 413],
  ])('rechaza %s', (_, f, status) => {
    try {
      validateUpload(f, MAX);
      throw new Error('debió fallar');
    } catch (e) {
      expect((e as { getStatus: () => number }).getStatus()).toBe(status);
    }
  });

  it('sanea nombres con rutas y caracteres de control', () => {
    expect(sanitizeFilename('../../etc/passwd.txt')).toBe('passwd.txt');
    expect(sanitizeFilename('C:\\x\\<script>.txt')).toBe('script.txt');
    expect(sanitizeFilename('a\u0000b\r\n.txt')).toBe('ab.txt');
    expect(
      sanitizeFilename(Buffer.from('café.txt', 'utf8').toString('latin1')),
    ).toBe('café.txt');
  });
});

describe('política de contraseñas', () => {
  it('aplica longitud, comunes, correo y variedad', () => {
    expect(passwordPolicyError('corta', 'a@example.test')).toMatch(/12/);
    expect(passwordPolicyError('x'.repeat(129), 'a@example.test')).toMatch(
      /128/,
    );
    expect(passwordPolicyError('Password1234', 'a@example.test')).toMatch(
      /común/,
    );
    expect(
      passwordPolicyError('marialopez-2026!', 'marialopez@example.test'),
    ).toMatch(/correo/);
    expect(passwordPolicyError('aaaaaaaaaaaaaaab', 'a@example.test')).toMatch(
      /variedad/,
    );
    expect(
      passwordPolicyError('Prueba-Sintetica-2026', 'ana@example.test'),
    ).toBeNull();
  });
});

describe('autorización', () => {
  const reader = { userId: 'r', role: 'reader' as const };
  const editor = { userId: 'e', role: 'editor' as const };
  const admin = { userId: 'a', role: 'admin' as const };
  it('denegación por defecto de permisos', () => {
    expect(hasPermission('reader', 'documents:create')).toBe(false);
    expect(hasPermission('reader', 'users:manage')).toBe(false);
    expect(hasPermission('editor', 'audit:read')).toBe(false);
    expect(hasPermission('admin', 'audit:read')).toBe(true);
    expect(hasPermission('nadie' as never, 'documents:read')).toBe(false);
  });
  it('lectura por clasificación y propiedad', () => {
    const doc = (
      classification: 'internal' | 'confidential' | 'restricted',
      ownerId = 'x',
    ) => ({ ownerId, classification });
    expect(canReadDocument(reader, doc('internal'))).toBe(true);
    expect(canReadDocument(reader, doc('confidential'))).toBe(false);
    expect(canReadDocument(editor, doc('confidential'))).toBe(true);
    expect(canReadDocument(editor, doc('restricted'))).toBe(false);
    expect(canReadDocument(editor, doc('restricted', 'e'))).toBe(true);
    expect(canReadDocument(admin, doc('restricted'))).toBe(true);
  });
  it('borrado: admin cualquiera, editor solo propios, lector nunca', () => {
    expect(canDeleteDocument(admin, { ownerId: 'x' })).toBe(true);
    expect(canDeleteDocument(editor, { ownerId: 'e' })).toBe(true);
    expect(canDeleteDocument(editor, { ownerId: 'x' })).toBe(false);
    expect(canDeleteDocument(reader, { ownerId: 'r' })).toBe(false);
  });
});

describe('saneamiento de auditoría', () => {
  it('redacta claves sensibles y descarta objetos', () => {
    const out = sanitizeDetails({
      password: 'Prueba-Sintetica-2026',
      sessionToken: 'abc',
      code: '123456',
      recoveryCode: 'ABCDE-FGHIJ',
      apiKey: 'k',
      reason: 'bad_password',
      nested: { password: 'x' },
      size: 10,
    });
    expect(out).toEqual({
      password: '[REDACTED]',
      sessionToken: '[REDACTED]',
      code: '[REDACTED]',
      recoveryCode: '[REDACTED]',
      apiKey: '[REDACTED]',
      reason: 'bad_password',
      size: 10,
    });
  });
});
