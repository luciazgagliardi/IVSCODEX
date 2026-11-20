/**
 * Protocolo del buscador de jurisprudencia de Mendoza (consultar.js?v=20261104).
 * El paso "buscar" debe reenviar los MISMOS filtros que "armarSql" y nunca
 * el SQL: reenviarlo produce 403 del WAF en CC/CT y "búsqueda vencida" en SC.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarMza, filtrosFormulario } from '../lib/indiceMza.js';

const FICHA = `<div class="ficha" id="cc_1_2"><div class="materia">DERECHO CIVIL</div>
<div class="voces">DAÑO MORAL</div><div class="texto">Sumario</div>
<div class="expte">Expte: 58076 - PEREZ C/ GOMEZ</div><div class="fecha">Fecha: 15/12/2025</div>
<div class="trib">Tribunal: 2º CÁMARA EN LO CIVIL</div></div>`;

function simular(respuestas) {
  const pedidos = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, opciones) => {
    const cuerpo = new URLSearchParams(opciones.body);
    pedidos.push(cuerpo);
    const texto = respuestas[cuerpo.get('funcion')];
    return new Response(texto, { status: 200 });
  };
  return { pedidos, restaurar: () => { globalThis.fetch = original; } };
}

test('buscar reenvía los filtros del formulario y no el SQL', async () => {
  const sim = simular({ armarSql: '\r\n696@@SELECT f.id FROM cc_fallos AS f INNER JOIN cc_sumarios', buscar: FICHA });
  try {
    const r = await buscarMza({ q: 'daño moral', tribunal: 'CC', porPagina: 10 });
    assert.equal(r.total, 696);
    assert.equal(r.resultados.length, 1);
    const [armar, buscar] = sim.pedidos;
    assert.equal(buscar.get('funcion'), 'buscar');
    assert.equal(buscar.has('sql'), false);
    assert.equal(buscar.get('total'), '696');
    for (const [k, v] of Object.entries(filtrosFormulario({ libre: 'daño moral', tribunal: 'CC' }))) {
      assert.equal(armar.get(k), v, `armarSql.${k}`);
      assert.equal(buscar.get(k), v, `buscar.${k}`);
    }
  } finally { sim.restaurar(); }
});

test('"La busqueda vencio" es una falla de la fuente, no cero resultados', async () => {
  const sim = simular({ armarSql: '323@@SELECT 1', buscar: '\r\nLa busqueda vencio. Por favor vuelva a realizarla.' });
  try {
    await assert.rejects(buscarMza({ q: 'daño moral', tribunal: 'SC' }), (e) => e.codigo === 'INDICE_MZA_FALLA');
  } finally { sim.restaurar(); }
});
