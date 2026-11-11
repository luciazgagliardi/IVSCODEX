import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { siguienteCursor, combinarRegistro } from '../lib/avanceCosecha.js';

test('no confundir un límite local con el agotamiento de una fuente', () => {
  assert.deepEqual(siguienteCursor(20, { siguienteDesde: 40 }), { agotada: false, desde: 40 });
  assert.deepEqual(siguienteCursor(40, { siguienteDesde: null }), { agotada: true });
  assert.deepEqual(siguienteCursor(0, { siguienteDesde: 'id-990' }), { agotada: false, desde: 'id-990' });
  assert.throws(() => siguienteCursor(20, { siguienteDesde: 20 }), /Cursor/);
  assert.throws(() => siguienteCursor(30, { siguienteDesde: 10 }), /Cursor/);
  assert.deepEqual(siguienteCursor(3100, { siguienteDesde: 2980 }, { cursorDescendente: true }), { agotada: false, desde: 2980 });
  assert.throws(() => siguienteCursor(2980, { siguienteDesde: 3100 }, { cursorDescendente: true }), /Cursor/);
  assert.throws(() => siguienteCursor('id-990', { siguienteDesde: 'id-990' }), /Cursor/);
  assert.throws(() => siguienteCursor(0, { siguienteDesde: NaN }), /Cursor/);
});

test('conservar textos, enlaces y metadatos más completos al deduplicar', () => {
  const anterior = { id: 'mza_10', sumario: 'Texto largo de sentencia', linkFallo: 'https://oficial/10', expediente: '10' };
  const nuevo = { id: 'mza_10', sumario: 'Breve', linkFallo: '', tribunal: 'Suprema Corte de Mendoza' };
  assert.deepEqual(combinarRegistro(anterior, nuevo), { ...anterior, tribunal: nuevo.tribunal });
  assert.equal(combinarRegistro(null, nuevo), nuevo);
});

test('la expansión contempla las ocho fuentes paginadas, más SAIJ y Corte IDH', () => {
  const archivo = fs.readFileSync(new URL('../scripts/ampliarFuentes.mjs', import.meta.url), 'utf8');
  const corte = fs.readFileSync(new URL('../scripts/ampliarCorteidh.mjs', import.meta.url), 'utf8');
  const armado = fs.readFileSync(new URL('../scripts/armarAcervo.mjs', import.meta.url), 'utf8');
  for (const slug of ['mendoza', 'caba', 'scba', 'juristeca', 'santafe', 'rionegro', 'dialnet', 'mendozalegal']) {
    assert.match(archivo, new RegExp('\\b' + slug + ': \\{'));
  }
  assert.match(corte, /listarTodo\(\)/);
  assert.match(corte, /extraerDesdeBuffer/);
  assert.match(armado, /'corteidh'/);
  assert.match(armado, /DIR_BASE/);
  assert.match(archivo, /avance-/);
  assert.match(archivo, /MAX_PAGINAS/);
});
