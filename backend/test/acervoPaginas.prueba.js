/**
 * La copia local de a páginas (buscarPagina en lib/acervo.js): el total es el
 * exacto, pasar de página no repite ni saltea, los duplicados exactos cuentan
 * una vez, Mendoza suma lo de SAIJ de su provincia, el año sale de «dd/mm/aaaa
 * - Sentencia», y lo que traen las búsquedas en vivo entra a la copia.
 *
 *   node --test test/acervoPaginas.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acervo-pag-'));
process.env.DIR_ACERVO = path.join(tmp, 'base');
process.env.DIR_ACERVO_DATOS = path.join(tmp, 'tandas');
process.env.DIR_INDICE = path.join(tmp, 'indice');
fs.mkdirSync(process.env.DIR_ACERVO_DATOS, { recursive: true });
fs.mkdirSync(process.env.DIR_INDICE, { recursive: true });

const registros = [];
for (let i = 1; i <= 45; i++) registros.push({ id: `mza_${i}`, fuente: 'mendoza', caratula: `Actor ${i} c/ Empresa s/ despido`, tribunal: i % 3 ? 'SUPREMA CORTE DE JUSTICIA' : 'CAMARA DEL TRABAJO', fecha: `10/03/${2000 + (i % 25)} - Sentencia`, sumario: `El despido sin causa número ${i} obliga a indemnizar.` });
for (let i = 1; i <= 7; i++) registros.push({ id: `saij_m${i}`, fuente: 'saij', provincia: 'Mendoza', caratula: `Otro ${i} c/ Bodega s/ despido`, fecha: `01/01/2019`, sumario: `Sumario de despido ${i} en Mendoza.` });
registros.push({ id: 'saij_otra', fuente: 'saij', provincia: 'Córdoba', caratula: 'Ajeno c/ Fábrica s/ despido', fecha: '01/01/2019', sumario: 'Un despido de Córdoba.' });
// la misma ficha dos veces, con otro id: cuenta una sola vez
registros.push({ id: 'mza_dup', fuente: 'mendoza', caratula: 'Actor 1 c/ Empresa s/ despido', tribunal: 'SUPREMA CORTE DE JUSTICIA', fecha: '10/03/2001 - Sentencia', sumario: 'El despido sin causa número 1 obliga a indemnizar.' });
fs.writeFileSync(path.join(process.env.DIR_ACERVO_DATOS, 'todo-001.jsonl.gz'), zlib.gzipSync(registros.map((r) => JSON.stringify(r)).join('\n')));
fs.writeFileSync(path.join(process.env.DIR_ACERVO_DATOS, 'manifiesto.json'), JSON.stringify({ version: 'prueba-pag', archivos: ['todo-001.jsonl.gz'] }));
// lo que guardaron búsquedas anteriores en vivo (lib/indice.js)
fs.writeFileSync(path.join(process.env.DIR_INDICE, 'mendoza.json'), JSON.stringify({ registros: { mza_vivo: { id: 'mza_vivo', caratula: 'Guardado c/ Vivo s/ despido', fecha: '05/05/2024 - Auto', sumario: 'Un despido que trajo el sitio en vivo.' } } }));

const { prepararAcervo, buscarPagina, sumarVivos, anioDe, acervoCubre } = await import('../lib/acervo.js');
await prepararAcervo({ esperar: true });

test('el año de cada forma de fecha', () => {
  assert.equal(anioDe('27/07/2026 - Sentencia'), 2026);
  assert.equal(anioDe('2019-05-02'), 2019);
  assert.equal(anioDe('julio de 1998'), 1998);
  assert.equal(anioDe(''), null);
});

test('total exacto, y recorrer todas las páginas no repite ni saltea', () => {
  const vistos = new Set();
  let desde = 0, total = null, paginas = 0;
  while (desde !== null) {
    const p = buscarPagina('mendoza', 'despido', { desde, porPagina: 20 });
    total = p.total; paginas++;
    for (const r of p.resultados) { assert.ok(!vistos.has(r.id), `repetido ${r.id}`); vistos.add(r.id); }
    desde = p.siguienteDesde;
  }
  // 45 propios + 7 de SAIJ Mendoza + el guardado en vivo; sin el duplicado ni el de Córdoba
  assert.equal(total, 53);
  assert.equal(vistos.size, 53);
  assert.equal(paginas, 3);
  assert.ok(!vistos.has('saij_otra'));
  assert.ok(vistos.has('mza_vivo'), 'lo guardado por las búsquedas en vivo entra a la copia');
});

test('años y tribunal', () => {
  assert.equal(buscarPagina('mendoza', 'despido', { anioDesde: 2020 }).total, 45 - registros.filter((r) => r.fuente === 'mendoza' && r.id !== 'mza_dup' && anioDe(r.fecha) < 2020).length + 1);
  const sc = buscarPagina('mendoza', 'despido', { tribunal: 'SC', porPagina: 100 });
  assert.ok(sc.resultados.every((r) => !r.id.startsWith('mza_') || /SUPREMA/.test(r.tribunal || '') || r.id === 'mza_vivo' || !r.tribunal));
});

test('lo que trae el sitio en vivo se suma a la copia, sin repetir', async () => {
  assert.equal(await sumarVivos('mendoza', [{ id: 'mza_nuevo', caratula: 'Nuevo c/ Otro s/ despido', fecha: '01/02/2025', sumario: 'Otro despido.' }, { id: 'mza_1', caratula: 'ya estaba' }]), 1);
  assert.equal(buscarPagina('mendoza', 'despido').total, 54);
  assert.equal(acervoCubre('mendoza'), true);
  assert.equal(acervoCubre('corteidh'), false);
});
