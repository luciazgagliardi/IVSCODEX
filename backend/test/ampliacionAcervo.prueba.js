import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { siguienteCursor, combinarRegistro, idDocumentalValido } from '../lib/avanceCosecha.js';
import { cookieDeSesion } from '../lib/sesionMza.js';

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

test('ids reales de Mendoza, CABA, SCBA y Río Negro se incorporan, no se descartan', () => {
  for(const id of ['sc_1014929_35314', 'mza_oficial_12399000248', 'caba_00123', 'juristeca-42',
    'scba_987654', 'rionegro_16482', 'aBcDEF123'])
    assert.equal(idDocumentalValido(id), true, id);
  for(const id of [null, '', ' ', '../escape', 'x', 'x'.repeat(161)])
    assert.equal(idDocumentalValido(id), false, String(id));
});

test('la búsqueda judicial conserva cookie PHP al pedir las fichas', () => {
  const sesion=cookieDeSesion(new Headers({'set-cookie':'PHPSESSID=abcd1234; path=/; HttpOnly'}));
  assert.equal(sesion,'PHPSESSID=abcd1234');
  assert.equal(cookieDeSesion(new Headers(),sesion),sesion);
  assert.equal(cookieDeSesion(new Headers({'set-cookie':'evil=invalid;other=value'}),sesion),'evil=invalid');
  assert.equal(cookieDeSesion(new Headers({'set-cookie':'no-es-cookie'}),sesion),sesion);
});
