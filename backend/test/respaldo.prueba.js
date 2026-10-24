/**
 * El respaldo de fallos (backend/respaldo/<base>.json.gz, armado con
 * scripts/armarRespaldo.mjs): cuando un buscador oficial no responde, la ruta
 * de búsqueda recurre a buscarEnIndice(), que tiene que encontrar en el
 * respaldo aunque el índice local del servidor esté vacío (disco nuevo,
 * servidor recién desplegado).
 *
 *   node --test test/respaldo.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_RESPALDO = path.join(AQUI, '..', 'respaldo');
// índice local vacío: sólo cuenta el respaldo
process.env.DIR_INDICE = fs.mkdtempSync(path.join(os.tmpdir(), 'indice-vacio-'));
const { buscarEnIndice, estadoIndice } = await import('../lib/indice.js');

const BASES = ['saij', 'csjn', 'scba', 'caba', 'dialnet', 'mendozalegal', 'mendoza'];
const conteos = JSON.parse(fs.readFileSync(path.join(DIR_RESPALDO, 'conteos.json'), 'utf8'));

test('cada base tiene su respaldo, con registros completos', () => {
  for (const b of BASES) {
    const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR_RESPALDO, `${b}.json.gz`))));
    assert.equal(d.registros.length, conteos[b], `${b}: el conteo coincide con el archivo`);
    // Mendoza Legal es una revista con una selección acotada de fallos; las demás, miles
    assert.ok(d.registros.length >= (b === 'mendozalegal' ? 100 : 700), `${b}: ${d.registros.length} fallos`);
    const ids = new Set(d.registros.map((r) => r.id));
    assert.equal(ids.size, d.registros.length, `${b}: sin repetidos`);
    for (const r of d.registros) assert.ok(r.id && (r.caratula || r.sumario), `${b}: registro con carátula o sumario`);
    // JUBA (SCBA) publica sumarios sin fallo asociado: esos no traen enlace al texto, igual que en la búsqueda en vivo
    const conEnlace = d.registros.filter((r) => r.linkFicha || r.linkFallo).length / d.registros.length;
    assert.ok(conEnlace >= 0.6, `${b}: ${Math.round(conEnlace * 100)} % con enlace a la fuente oficial`);
  }
});

test('con el índice vacío, una base caída sigue devolviendo fallos con el pasaje', async () => {
  for (const [b, q] of [['saij', 'daño moral'], ['scba', 'despido'], ['csjn', 'amparo'], ['caba', 'daños y perjuicios'], ['mendoza', 'daño moral']]) {
    const r = await buscarEnIndice(b, q, { modo: 'todas' });
    assert.ok(r.length >= 5, `${b} «${q}»: ${r.length} resultados del respaldo`);
  }
});

test('el estado de cada base informa el respaldo sin cargarlo', async () => {
  const e = await estadoIndice('saij');
  assert.equal(e.respaldo, conteos.saij);
  assert.equal(e.guardados, 0);
});
