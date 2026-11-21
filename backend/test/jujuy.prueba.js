/**
 * Poder Judicial de Jujuy: forma de la consulta, registros y paginación,
 * contra respuestas con la forma real de su API (verificada el 20/11/2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarJujuy, cuerpoConsulta, registroDe, vocesDe } from '../lib/indiceJujuy.js';
import { fuentePorSlug } from '../lib/fuentes.js';
import { informacionFuente } from '../lib/fuentesInfo.js';

const FILA = {
  id_documento: 535558, serie: 'CF', numero_expediente: 22507, anio: 2026, fecha: '2026-11-12T00:00:00.000Z',
  sumario: '<p><span>Confirm&oacute; la responsabilidad del Estado provincial. (meb)</span></p>',
  tipo_documento: 'SENTENCIAS', organo: 'Suprema Corte de Justicia (S.T.J.) - Sala I-Vocalía 1',
  tesauros: "['DAÑOS Y PERJUICIOS','PERDIDA DE LA CHANCE','DAÑO MORAL']",
};

test('el modo de búsqueda se traduce como lo hace el buscador oficial', () => {
  assert.deepEqual(cuerpoConsulta('daño moral', 'todas'), { palabras: ['daño', 'moral'], filtroPalabras: 2 });
  assert.deepEqual(cuerpoConsulta('daño moral', 'alguna'), { palabras: ['daño', 'moral'], filtroPalabras: 1 });
  assert.deepEqual(cuerpoConsulta('"daño moral"', 'exacta'), { palabras: ['daño moral'], filtroPalabras: 2 });
});

test('registro: datos publicados, sin carátula inventada, con enlace al visor oficial', () => {
  const r = registroDe(FILA);
  assert.equal(r.id, 'jujuy_535558');
  assert.equal(r.caratula, 'Sentencias · Expte. CF-22507/2026');
  assert.equal(r.fecha, '12/11/2026');
  assert.equal(r.sumario, 'Confirmó la responsabilidad del Estado provincial. (meb)');
  assert.deepEqual(r.voces, ['DAÑOS Y PERJUICIOS', 'PERDIDA DE LA CHANCE', 'DAÑO MORAL']);
  assert.equal(r.linkFallo, 'https://jurisprudencia.justiciajujuy.gov.ar/public/documento-sentencia?id=535558');
  assert.deepEqual(vocesDe(''), []);
});

test('pagina con offset = número de página (empieza en 1) y respeta el total del sitio', async () => {
  const pedidos = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    pedidos.push({ url: String(url), cuerpo: JSON.parse(op.body) });
    const pag = Number(new URL(url).searchParams.get('offset'));
    const filas = Array.from({ length: 20 }, (_, i) => ({ ...FILA, id_documento: pag * 100 + i }));
    return new Response(JSON.stringify({ response: filas, results: 45 }), { status: 200 });
  };
  try {
    const p1 = await buscarJujuy({ q: 'daño moral', porPagina: 20 });
    assert.equal(p1.totalFuente, 45);
    assert.equal(p1.resultados[0].id, 'jujuy_100');
    assert.match(pedidos[0].url, /offset=1&limit=20/);
    const p2 = await buscarJujuy({ q: 'daño moral', porPagina: 20, desde: p1.siguienteDesde });
    assert.equal(p2.resultados[0].id, 'jujuy_200');
    assert.match(pedidos.at(-1).url, /offset=2&limit=20/);
  } finally { globalThis.fetch = original; }
});

test('una respuesta con forma inesperada es una falla, no cero resultados', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>mantenimiento</html>', { status: 200 });
  try {
    await assert.rejects(buscarJujuy({ q: 'daño' }), (e) => e.codigo === 'INDICE_FUENTE_FALLA' || /jujuy/.test(e.message));
  } finally { globalThis.fetch = original; }
});

test('registrada en el catálogo con su procedencia y sus límites', () => {
  assert.ok(fuentePorSlug('jujuy'));
  const info = informacionFuente('jujuy');
  assert.match(info.limite, /Familia, Menores y Penales/);
  assert.match(info.limite, /auténticos/);
});

test('Juristeca: el rango de años se respeta aunque el portal lo ignore (F-04)', async () => {
  const { filtrarPorAnio } = await import('../lib/indiceJuristeca.js');
  const lista = [{ fecha: '02/10/2026' }, { fecha: '15/05/2023' }, { fecha: '' }, { fecha: '31/12/2024' }];
  assert.deepEqual(filtrarPorAnio(lista, 2023, 2024).map((r) => r.fecha), ['15/05/2023', '', '31/12/2024']);
  assert.equal(filtrarPorAnio(lista, null, null).length, 4);
});
