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

test('la cosecha cubre fuentes habilitadas y detiene reintentos ante bloqueos y timeouts', () => {
  const archivo = fs.readFileSync(new URL('../scripts/ampliarFuentes.mjs', import.meta.url), 'utf8');
  const armado = fs.readFileSync(new URL('../scripts/armarAcervo.mjs', import.meta.url), 'utf8');
  const workflow = fs.readFileSync(new URL('../../.github/workflows/ampliacion-integral.yml', import.meta.url), 'utf8');
  const corte = fs.readFileSync(new URL('../scripts/ampliarCorteidh.mjs', import.meta.url), 'utf8');
  for (const slug of ['mendoza', 'caba', 'scba', 'juristeca', 'santafe', 'rionegro', 'dialnet', 'mendozalegal', 'jujuy',
    'chubut', 'tfn', 'santacruz', 'hudoc']) {
    assert.ok(archivo.includes(slug + ': {'), slug);
  }
  assert.match(archivo, /avanzarIndiceTerminos/);
  assert.match(archivo, /esReintentable/);
  assert.match(archivo, /process\.exitCode = 1/);
  assert.doesNotMatch(archivo, /indiceTerminos = \(indiceInicial \+ ventana\.length\)/);
  for (const slug of ['chubut', 'tfn', 'santacruz', 'hudoc']) assert.ok(workflow.includes(slug), 'falta ' + slug + ' en la matriz');
  assert.ok(armado.includes("'corteidh'"));
  assert.ok(armado.includes("'jujuy'"));
  assert.ok(armado.includes('DIR_BASE'));
  assert.ok(archivo.includes('avance-'));
  assert.ok(archivo.includes('MAX_PAGINAS'));
  assert.ok(archivo.includes('MAX_TERMINOS'));
  assert.ok(archivo.includes('PAGINAS_POR_TAREA'));
  assert.ok(archivo.includes('TimeoutError|AbortError'));
  assert.ok(archivo.includes('ECONNRESET'));
  assert.ok(archivo.includes('ECONNABORTED'));
  assert.ok(archivo.includes('rechazosDeAcceso = 0;'));
  assert.ok(archivo.includes('if (pareceBloqueoDeRed(estado.ultimoError)) rechazosDeAcceso++'));
  assert.ok(archivo.includes('cursorPreservado: true'));
  assert.ok(corte.includes('listarTodo()'));
  assert.ok(workflow.includes('  corteidh:'));
  assert.ok(workflow.includes('node scripts/ampliarCorteidh.mjs'));
  assert.match(corte, /process\.exitCode = 1/);
  assert.doesNotMatch(corte, /process\.exit\(0\)/);
  assert.match(workflow, /needs: \[pruebas, fuentes, saij, saij_provincial, corteidh\]/);
});
test('ids reales de Mendoza, CABA, SCBA y Río Negro se incorporan, no se descartan', () => {
  for(const id of ['sc_1014929_35314', 'mza_oficial_12399000248', 'caba_00123', 'juristeca-42',
    'scba_987654', 'rionegro_16482', 'jujuy_535558', 'aBcDEF123'])
    assert.equal(idDocumentalValido(id), true, id);
  for(const id of [null, '', ' ', '../escape', 'x', 'x'.repeat(161)])
    assert.equal(idDocumentalValido(id), false, String(id));
});

test('el resumen de la cosecha cuenta las raíces provinciales y no informa cero falso', () => {
  const saij = fs.readFileSync(new URL('../scripts/cosecharSaij.mjs', import.meta.url), 'utf8');
  assert.match(saij, /const nivelesRaiz = PROVINCIA \? 3 : 2/);
  assert.match(saij, /k\.split\('\|'\)\.length === nivelesRaiz/);
  assert.match(saij, /!PROVINCIA \|\| k\.includes\(EXTRA\[0\]\)/);
});
test('la búsqueda judicial conserva cookie PHP al pedir las fichas', () => {
  const sesion=cookieDeSesion(new Headers({'set-cookie':'PHPSESSID=abcd1234; path=/; HttpOnly'}));
  assert.equal(sesion,'PHPSESSID=abcd1234');
  assert.equal(cookieDeSesion(new Headers(),sesion),sesion);
  assert.equal(cookieDeSesion(new Headers({'set-cookie':'evil=invalid;other=value'}),sesion),'evil=invalid');
  assert.equal(cookieDeSesion(new Headers({'set-cookie':'no-es-cookie'}),sesion),sesion);
});
