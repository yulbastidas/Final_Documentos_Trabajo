import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  csvCell,
  reportCsv,
  validateFile,
} from '../../src/lib/presentation.ts';

test('CSV neutraliza fórmulas y escapa comillas sin perder los datos', () => {
  for (const value of ['=1+1', ' +CMD', '\t@SUM(A1)', '-10', '\n=2'])
    assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Texto "seguro"'), '"Texto ""seguro"""');
});
test('validador rechaza vacío, exceso de tamaño y extensión o MIME inesperados', () => {
  assert.match(
    validateFile({ name: 'demo.pdf', type: 'application/pdf', size: 0 }),
    /vacío/,
  );
  assert.match(
    validateFile({
      name: 'demo.pdf',
      type: 'application/pdf',
      size: 10 * 1024 * 1024 + 1,
    }),
    /10 MB/,
  );
  assert.match(
    validateFile({
      name: 'demo.exe',
      type: 'application/octet-stream',
      size: 10,
    }),
    /PDF o TXT/,
  );
  assert.match(
    validateFile({ name: 'demo.pdf', type: 'text/plain', size: 10 }),
    /tipo/,
  );
  assert.equal(
    validateFile({ name: 'demo.PDF', type: 'application/pdf', size: 10 }),
    null,
  );
});
test('reporte indica demostración y neutraliza títulos suministrados por el usuario', () => {
  const output = reportCsv(
    [
      {
        id: '1',
        title: '=1+1',
        filename: 'demo.txt',
        category: 'Interno',
        owner: 'Demo',
        size: 20,
        updatedAt: '2026-11-03T12:00:00Z',
        favorite: false,
        source: 'local',
      },
    ],
    [],
  );
  assert.match(output, /NO ES UN REPORTE DE AUDITORÍA REAL/);
  assert.ok(output.includes('"\'=1+1"'));
  assert.ok(output.startsWith('\ufeff'));
});
